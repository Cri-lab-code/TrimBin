#!/usr/bin/env python3
"""Whisper speech transcription helper service for TrimBin."""

import sys
import os
import json
import string
import argparse
import time
import threading

for v in ["3.9", "3.10", "3.11", "3.12", "3.13"]:
    p = os.path.expanduser(f"~/Library/Python/{v}/lib/python/site-packages")
    if os.path.exists(p) and p not in sys.path:
        sys.path.insert(0, p)

extra_paths = [
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
    os.path.expanduser("~/.local/bin"),
    os.path.expanduser("~/Library/Python/3.9/bin"),
    os.path.expanduser("~/Library/Python/3.10/bin"),
    os.path.expanduser("~/Library/Python/3.11/bin"),
    os.path.expanduser("~/Library/Python/3.12/bin"),
    os.path.expanduser("~/Library/Python/3.13/bin"),
]
current_path = os.environ.get("PATH", "")
os.environ["PATH"] = ":".join(extra_paths) + ":" + current_path


def report_progress(percent, message):
    print(f"PROGRESS:{percent}:{message}", flush=True)


def main():
    parser = argparse.ArgumentParser(description="TrimBin Whisper Transcription Helper")
    parser.add_argument("--input", required=True, help="Input media file path")
    parser.add_argument("--model", default="base", help="Whisper model (tiny, base, turbo, small, medium)")
    parser.add_argument("--language", default="auto", help="Language code (it, en, es, auto, etc.)")
    parser.add_argument("--output", required=True, help="Output JSON path")

    args = parser.parse_args()

    input_file = args.input
    raw_model = args.model or "base"
    language = args.language or "auto"
    output_path = args.output

    if not os.path.exists(input_file):
        err = {"success": False, "error": f"Media file not found: {input_file}"}
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(err, f, ensure_ascii=False)
        print(f"RESULT_FILE:{output_path}", flush=True)
        sys.exit(1)

    report_progress(10, "Initializing neural transcription environment...")

    # Load required ML libraries with pip fallback
    try:
        import torch
        import numpy
        import whisper
        import tqdm
    except ImportError as e:
        report_progress(12, "Installing required Whisper modules...")
        import subprocess
        try:
            subprocess.check_call([
                sys.executable, "-m", "pip", "install", "--user",
                "openai-whisper", "torch", "numpy<2.0.0", "tqdm"
            ])
            import torch
            import numpy
            import whisper
            import tqdm
        except Exception as install_err:
            err = {
                "success": False,
                "error": f"Whisper Python package missing ({str(e)}). Run in terminal: pip install openai-whisper \nDetails: {str(install_err)}"
            }
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(err, f, ensure_ascii=False)
            print(f"RESULT_FILE:{output_path}", flush=True)
            sys.exit(1)

    try:
        num_cores = os.cpu_count() or 8
        torch.set_num_threads(num_cores)
    except Exception:
        pass

    model_map = {
        "tiny": "tiny",
        "base": "base",
        "turbo": "turbo",
        "large-v3-turbo": "large-v3-turbo",
        "studio": "turbo",
        "small": "small",
        "medium": "medium",
    }
    model_name = model_map.get(raw_model.lower(), raw_model)

    report_progress(18, f"Loading neural model weights ({model_name})...")

    stop_heartbeat = False
    last_pct = 20

    def heartbeat_worker():
        start_t = time.time()
        while not stop_heartbeat:
            time.sleep(1.0)
            elapsed = int(time.time() - start_t)
            elapsed_str = f"{elapsed//60:02d}:{elapsed%60:02d}"
            if last_pct < 95:
                report_progress(last_pct, f"Transcribing audio ({elapsed_str} elapsed)...")

    # Hook tqdm progress bar for real-time percentage updates
    try:
        orig_tqdm = tqdm.tqdm
        def custom_tqdm(*t_args, **t_kwargs):
            t_kwargs['disable'] = False
            p = orig_tqdm(*t_args, **t_kwargs)
            orig_update = p.update
            def new_update(n=1):
                nonlocal last_pct
                try:
                    orig_update(n)
                    if p.total and p.total > 0:
                        pct = min(94, 20 + int((p.n / p.total) * 75))
                        last_pct = pct
                        cur_sec = int(p.n / 100)
                        tot_sec = int(p.total / 100)
                        cur_str = f"{cur_sec//3600:02d}:{(cur_sec%3600)//60:02d}:{cur_sec%60:02d}"
                        tot_str = f"{tot_sec//3600:02d}:{(tot_sec%3600)//60:02d}:{tot_sec%60:02d}"
                        report_progress(pct, f"Transcribing [{cur_str} / {tot_str}] ({pct}%)")
                except Exception:
                    pass
            p.update = new_update
            return p

        whisper.transcribe.__globals__['tqdm'].tqdm = custom_tqdm
    except Exception:
        pass

    hb_thread = threading.Thread(target=heartbeat_worker, daemon=True)
    hb_thread.start()

    try:
        try:
            model = whisper.load_model(model_name)
        except Exception as load_err:
            if model_name in ["turbo", "large-v3-turbo"]:
                model_name = "medium"
                report_progress(19, "Fallback to medium neural model...")
                model = whisper.load_model(model_name)
            else:
                raise load_err

        last_pct = 25
        report_progress(25, "Decoding audio stream and transcribing...")

        kwargs = {
            "fp16": False,
            "verbose": False,
            "condition_on_previous_text": False,
            "no_speech_threshold": 0.6,
            "logprob_threshold": -1.0,
            "compression_ratio_threshold": 2.4,
        }
        if language and language not in ["auto", "Auto-Detect"]:
            kwargs["language"] = language

        start_t = time.time()
        result = model.transcribe(input_file, **kwargs)
        elapsed = time.time() - start_t

        stop_heartbeat = True

        raw_segments = result.get("segments", [])
        formatted_segments = []
        valid_id = 1
        junk_chars = string.punctuation + " \t\n…·•~"

        for seg in raw_segments:
            t = (seg.get("text") or "").strip()
            if not t:
                continue
            clean_text = t.strip(junk_chars)
            if not clean_text or len(clean_text) == 0:
                continue
            if seg.get("no_speech_prob", 0.0) > 0.85:
                continue

            formatted_segments.append({
                "id": valid_id,
                "start": round(float(seg.get("start", 0)), 2),
                "end": round(float(seg.get("end", 0)), 2),
                "text": t
            })
            valid_id += 1

        detected_lang = result.get("language", language)
        full_text = result.get("text", "").strip()

        output_data = {
            "success": True,
            "fullText": full_text,
            "segments": formatted_segments,
            "language": detected_lang,
            "duration": formatted_segments[-1]["end"] if formatted_segments else 0
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)

        report_progress(100, f"Transcription completed: {len(formatted_segments)} segments ({round(elapsed, 1)}s)!")
        print(f"RESULT_FILE:{output_path}", flush=True)

    except Exception as e:
        stop_heartbeat = True
        err = {
            "success": False,
            "error": f"Transcription error: {str(e)}"
        }
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(err, f, ensure_ascii=False)
        print(f"RESULT_FILE:{output_path}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
