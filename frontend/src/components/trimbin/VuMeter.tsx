import React, { useEffect, useRef } from 'react';

interface VuMeterProps {
  isPlaying?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement> | null;
  level?: number;
  label?: string;
  isDual?: boolean;
  className?: string;
}

const mediaSourceMap = new WeakMap<
  HTMLMediaElement,
  {
    audioCtx: AudioContext;
    analyserL: AnalyserNode;
    analyserR: AnalyserNode;
    splitter: ChannelSplitterNode;
  }
>();

export const VuMeter: React.FC<VuMeterProps> = React.memo(({
  isPlaying = false,
  videoRef,
  level,
  label = 'AUDIO VU METER',
  isDual = true,
  className = '',
}) => {
  const needleLRef = useRef<HTMLDivElement | null>(null);
  const needleRRef = useRef<HTMLDivElement | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const velLRef = useRef<number>(0);
  const velRRef = useRef<number>(0);
  const currentLRef = useRef<number>(-36);
  const currentRRef = useRef<number>(-36);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const video = videoRef?.current;

    if (video && video.src && !video.src.endsWith('index.html')) {
      let nodes = mediaSourceMap.get(video);
      if (!nodes) {
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            const audioCtx = new AudioContextClass();
            const source = audioCtx.createMediaElementSource(video);
            const splitter = audioCtx.createChannelSplitter(2);
            const analyserL = audioCtx.createAnalyser();
            const analyserR = audioCtx.createAnalyser();

            analyserL.fftSize = 256;
            analyserL.smoothingTimeConstant = 0.2;
            analyserR.fftSize = 256;
            analyserR.smoothingTimeConstant = 0.2;

            source.connect(splitter);
            splitter.connect(analyserL, 0);
            splitter.connect(analyserR, 1);
            source.connect(audioCtx.destination);

            nodes = { audioCtx, analyserL, analyserR, splitter };
            mediaSourceMap.set(video, nodes);
          }
        } catch (err) {
          // Ignore duplicate source connection error
        }
      }
      if (nodes && isPlaying && nodes.audioCtx.state === 'suspended') {
        nodes.audioCtx.resume().catch(() => {});
      }
    }

    const dataL = new Uint8Array(128);
    const dataR = new Uint8Array(128);

    const updateNeedles = (time: number) => {
      if (time - lastTimeRef.current >= 15) {
        lastTimeRef.current = time;

        let targetL = -36;
        let targetR = -36;

        const currentVideo = videoRef?.current;
        const isActuallyPlaying =
          isPlaying &&
          currentVideo &&
          !currentVideo.paused &&
          !currentVideo.muted &&
          currentVideo.readyState >= 2 &&
          currentVideo.currentTime > 0;

        if (isActuallyPlaying && currentVideo) {
          const nodes = mediaSourceMap.get(currentVideo);
          if (nodes) {
            if (nodes.audioCtx.state === 'suspended') {
              nodes.audioCtx.resume().catch(() => {});
            }

            nodes.analyserL.getByteTimeDomainData(dataL);
            let sumL = 0;
            let peakL = 0;
            for (let i = 0; i < dataL.length; i++) {
              const v = (dataL[i] - 128) / 128;
              sumL += v * v;
              const absV = Math.abs(v);
              if (absV > peakL) peakL = absV;
            }
            const rmsL = Math.sqrt(sumL / dataL.length);

            nodes.analyserR.getByteTimeDomainData(dataR);
            let sumR = 0;
            let peakR = 0;
            for (let i = 0; i < dataR.length; i++) {
              const v = (dataR[i] - 128) / 128;
              sumR += v * v;
              const absV = Math.abs(v);
              if (absV > peakR) peakR = absV;
            }
            const rmsR = Math.sqrt(sumR / dataR.length);

            if (rmsL > 0.003 || peakL > 0.006) {
              const combinedL = 0.65 * rmsL + 0.35 * peakL;
              const normL = Math.min(1.0, Math.max(0.0, combinedL * 3.4));
              targetL = -36 + normL * 72;
            } else {
              targetL = -36;
            }

            if (rmsR > 0.003 || peakR > 0.006) {
              const combinedR = 0.65 * rmsR + 0.35 * peakR;
              const normR = Math.min(1.0, Math.max(0.0, combinedR * 3.4));
              targetR = -36 + normR * 72;
            } else {
              targetR = -36;
            }
          }
        } else if (level !== undefined && level > 0) {
          targetL = -36 + Math.max(0, Math.min(1, level)) * 72;
          targetR = targetL;
        } else {
          targetL = -36;
          targetR = -36;
        }

        const spring = 0.42;
        const friction = 0.62;

        velLRef.current = (velLRef.current + (targetL - currentLRef.current) * spring) * friction;
        currentLRef.current += velLRef.current;
        if (Math.abs(targetL - currentLRef.current) < 0.08 && Math.abs(velLRef.current) < 0.08) {
          velLRef.current = 0;
          currentLRef.current = targetL;
        }

        velRRef.current = (velRRef.current + (targetR - currentRRef.current) * spring) * friction;
        currentRRef.current += velRRef.current;
        if (Math.abs(targetR - currentRRef.current) < 0.08 && Math.abs(velRRef.current) < 0.08) {
          velRRef.current = 0;
          currentRRef.current = targetR;
        }

        if (needleLRef.current) {
          needleLRef.current.style.transform = `rotate(${currentLRef.current}deg) translateZ(0)`;
        }
        if (needleRRef.current) {
          needleRRef.current.style.transform = `rotate(${currentRRef.current}deg) translateZ(0)`;
        }
      }

      animationFrameRef.current = requestAnimationFrame(updateNeedles);
    };

    animationFrameRef.current = requestAnimationFrame(updateNeedles);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, videoRef, level]);

  return (
    <div className={`panel-surface p-2 flex flex-col gap-1.5 ${className}`}>
      {/* Header Label Bar */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] font-sans font-bold text-[var(--text-primary)] tracking-wider uppercase">
          {label}
        </span>
        <span className="text-[8.5px] font-mono text-[var(--text-accent)] font-bold">
          2-CH ANALOG
        </span>
      </div>

      {/* Unified Extra-Large Warm-Backlit Chamber (FiiO R2R Tube DAC Style) */}
      <div
        className="relative w-full h-[80px] rounded-[4px] overflow-hidden select-none box-border shadow-vu-chassis"
        style={{
          background:
            'radial-gradient(ellipse at 50% 25%, var(--vu-backlight-top) 0%, var(--vu-backlight-mid) 45%, var(--vu-backlight-bottom) 78%, var(--vu-backlight-deep) 100%)',
          border: '1.5px solid var(--vu-bezel-outer)',
          boxShadow:
            'inset 0 3px 6px rgba(0, 0, 0, 0.75), inset 0 -2px 4px rgba(0, 0, 0, 0.5), 0 0 16px var(--vu-backlight-glow)',
        }}
      >
        {/* Subtle Glass Reflection Sheen */}
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background:
              'linear-gradient(135deg, var(--vu-glass-sheen) 0%, rgba(255, 255, 255, 0.02) 40%, transparent 60%)',
          }}
        />

        {/* 4 Corner Fastener Screws */}
        <div className="absolute top-1 left-1 w-1 h-1 rounded-full bg-[var(--vu-rivet)] shadow-inner opacity-70 z-20" />
        <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-[var(--vu-rivet)] shadow-inner opacity-70 z-20" />
        <div className="absolute bottom-1 left-1 w-1 h-1 rounded-full bg-[var(--vu-rivet)] shadow-inner opacity-70 z-20" />
        <div className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-[var(--vu-rivet)] shadow-inner opacity-70 z-20" />

        {/* High-Fidelity SVG Dual-Scale Markings & Calibration Graphics */}
        <svg
          className="w-full h-full absolute inset-0 pointer-events-none z-10"
          viewBox="0 0 280 80"
          preserveAspectRatio="none"
        >
          {/* ================= LEFT CHANNEL (CH 1 L) ================= */}
          {/* Main dB Arc (Black from -50dB to 0dB, Red from 0dB to +5dB) */}
          <path
            d="M 22 56 A 62 62 0 0 1 106 32"
            fill="none"
            stroke="var(--vu-scale-ink)"
            strokeWidth="1.4"
          />
          <path
            d="M 106 32 A 62 62 0 0 1 128 48"
            fill="none"
            stroke="var(--vu-scale-red)"
            strokeWidth="2.0"
          />

          {/* Left Primary Scale Ticks */}
          <line x1="24" y1="54" x2="27" y2="50" stroke="var(--vu-scale-ink)" strokeWidth="1.2" />
          <line x1="38" y1="44" x2="41" y2="40" stroke="var(--vu-scale-ink)" strokeWidth="1.2" />
          <line x1="56" y1="36" x2="58" y2="31" stroke="var(--vu-scale-ink)" strokeWidth="1.2" />
          <line x1="76" y1="32" x2="77" y2="27" stroke="var(--vu-scale-ink)" strokeWidth="1.2" />
          <line x1="94" y1="31" x2="94" y2="26" stroke="var(--vu-scale-ink)" strokeWidth="1.2" />
          <line x1="106" y1="32" x2="106" y2="26" stroke="var(--vu-scale-red)" strokeWidth="1.8" />
          <line x1="118" y1="39" x2="119" y2="34" stroke="var(--vu-scale-red)" strokeWidth="1.8" />
          <line x1="128" y1="47" x2="130" y2="42" stroke="var(--vu-scale-red)" strokeWidth="1.8" />

          {/* Left Scale Numerals */}
          <text x="21" y="62" fontSize="5.5" fontFamily="'IBM Plex Mono', monospace" fontWeight="bold" fill="var(--vu-scale-ink)">50</text>
          <text x="35" y="52" fontSize="5.5" fontFamily="'IBM Plex Mono', monospace" fontWeight="bold" fill="var(--vu-scale-ink)">30</text>
          <text x="53" y="44" fontSize="5.5" fontFamily="'IBM Plex Mono', monospace" fontWeight="bold" fill="var(--vu-scale-ink)">20</text>
          <text x="73" y="40" fontSize="5.5" fontFamily="'IBM Plex Mono', monospace" fontWeight="bold" fill="var(--vu-scale-ink)">10</text>
          <text x="92" y="39" fontSize="5.5" fontFamily="'IBM Plex Mono', monospace" fontWeight="bold" fill="var(--vu-scale-ink)">5</text>
          <text x="105" y="40" fontSize="5.5" fontFamily="'IBM Plex Mono', monospace" fontWeight="bold" fill="var(--vu-scale-red)">0</text>
          <text x="119" y="47" fontSize="5.5" fontFamily="'IBM Plex Mono', monospace" fontWeight="bold" fill="var(--vu-scale-red)">+5</text>

          {/* Left Sub-Scale (Power / Percent) */}
          <path d="M 28 62 A 52 52 0 0 1 122 55" fill="none" stroke="var(--vu-scale-ink-subtle)" strokeWidth="0.6" strokeDasharray="1 2" />
          <text x="32" y="66" fontSize="4.0" fontFamily="'IBM Plex Mono', monospace" fill="var(--vu-scale-ink-subtle)">0 0.01</text>
          <text x="56" y="58" fontSize="4.0" fontFamily="'IBM Plex Mono', monospace" fill="var(--vu-scale-ink-subtle)">0.1</text>
          <text x="77" y="52" fontSize="4.0" fontFamily="'IBM Plex Mono', monospace" fill="var(--vu-scale-ink-subtle)">1</text>
          <text x="96" y="52" fontSize="4.0" fontFamily="'IBM Plex Mono', monospace" fill="var(--vu-scale-ink-subtle)">10 100</text>

          {/* Left Channel Legends */}
          <text x="72" y="66" fontSize="7.0" fontFamily="'Barlow', sans-serif" fontWeight="800" fill="var(--vu-scale-ink)" textAnchor="middle">dB</text>
          <text x="72" y="74" fontSize="4.2" fontFamily="'Barlow', sans-serif" fontWeight="700" letterSpacing="0.08em" fill="var(--vu-scale-ink-subtle)" textAnchor="middle">PEAK LEVEL (L)</text>

          {/* ================= CENTER BRAND & VU BADGE ================= */}
          <text x="140" y="22" fontSize="6.5" fontFamily="'Barlow', sans-serif" fontWeight="800" letterSpacing="0.18em" fill="var(--vu-scale-ink)" textAnchor="middle" opacity="0.85">TRIMBIN</text>
          <text x="140" y="58" fontSize="10.5" fontFamily="'Barlow', sans-serif" fontWeight="900" letterSpacing="0.12em" fill="var(--vu-scale-ink)" textAnchor="middle">VU</text>

          {/* ================= RIGHT CHANNEL (CH 2 R - SAME DIRECTION AS LEFT) ================= */}
          {/* Main dB Arc (Black from -50dB to 0dB, Red from 0dB to +5dB) */}
          <path
            d="M 158 56 A 62 62 0 0 1 242 32"
            fill="none"
            stroke="var(--vu-scale-ink)"
            strokeWidth="1.4"
          />
          <path
            d="M 242 32 A 62 62 0 0 1 264 48"
            fill="none"
            stroke="var(--vu-scale-red)"
            strokeWidth="2.0"
          />

          {/* Right Primary Scale Ticks */}
          <line x1="160" y1="54" x2="163" y2="50" stroke="var(--vu-scale-ink)" strokeWidth="1.2" />
          <line x1="174" y1="44" x2="177" y2="40" stroke="var(--vu-scale-ink)" strokeWidth="1.2" />
          <line x1="192" y1="36" x2="194" y2="31" stroke="var(--vu-scale-ink)" strokeWidth="1.2" />
          <line x1="212" y1="32" x2="213" y2="27" stroke="var(--vu-scale-ink)" strokeWidth="1.2" />
          <line x1="230" y1="31" x2="230" y2="26" stroke="var(--vu-scale-ink)" strokeWidth="1.2" />
          <line x1="242" y1="32" x2="242" y2="26" stroke="var(--vu-scale-red)" strokeWidth="1.8" />
          <line x1="254" y1="39" x2="255" y2="34" stroke="var(--vu-scale-red)" strokeWidth="1.8" />
          <line x1="264" y1="47" x2="266" y2="42" stroke="var(--vu-scale-red)" strokeWidth="1.8" />

          {/* Right Scale Numerals (Identical Left-to-Right layout as Left Channel) */}
          <text x="157" y="62" fontSize="5.5" fontFamily="'IBM Plex Mono', monospace" fontWeight="bold" fill="var(--vu-scale-ink)">50</text>
          <text x="171" y="52" fontSize="5.5" fontFamily="'IBM Plex Mono', monospace" fontWeight="bold" fill="var(--vu-scale-ink)">30</text>
          <text x="189" y="44" fontSize="5.5" fontFamily="'IBM Plex Mono', monospace" fontWeight="bold" fill="var(--vu-scale-ink)">20</text>
          <text x="209" y="40" fontSize="5.5" fontFamily="'IBM Plex Mono', monospace" fontWeight="bold" fill="var(--vu-scale-ink)">10</text>
          <text x="228" y="39" fontSize="5.5" fontFamily="'IBM Plex Mono', monospace" fontWeight="bold" fill="var(--vu-scale-ink)">5</text>
          <text x="241" y="40" fontSize="5.5" fontFamily="'IBM Plex Mono', monospace" fontWeight="bold" fill="var(--vu-scale-red)">0</text>
          <text x="255" y="47" fontSize="5.5" fontFamily="'IBM Plex Mono', monospace" fontWeight="bold" fill="var(--vu-scale-red)">+5</text>

          {/* Right Sub-Scale (Power / Percent) */}
          <path d="M 164 62 A 52 52 0 0 1 258 55" fill="none" stroke="var(--vu-scale-ink-subtle)" strokeWidth="0.6" strokeDasharray="1 2" />
          <text x="168" y="66" fontSize="4.0" fontFamily="'IBM Plex Mono', monospace" fill="var(--vu-scale-ink-subtle)">0 0.01</text>
          <text x="192" y="58" fontSize="4.0" fontFamily="'IBM Plex Mono', monospace" fill="var(--vu-scale-ink-subtle)">0.1</text>
          <text x="213" y="52" fontSize="4.0" fontFamily="'IBM Plex Mono', monospace" fill="var(--vu-scale-ink-subtle)">1</text>
          <text x="232" y="52" fontSize="4.0" fontFamily="'IBM Plex Mono', monospace" fill="var(--vu-scale-ink-subtle)">10 100</text>

          {/* Right Channel Legends */}
          <text x="208" y="66" fontSize="7.0" fontFamily="'Barlow', sans-serif" fontWeight="800" fill="var(--vu-scale-ink)" textAnchor="middle">dB</text>
          <text x="208" y="74" fontSize="4.2" fontFamily="'Barlow', sans-serif" fontWeight="700" letterSpacing="0.08em" fill="var(--vu-scale-ink-subtle)" textAnchor="middle">PEAK LEVEL (R)</text>
        </svg>

        {/* Left Needle Pivot Assembly (X = 72 / 280 = 25.7%) */}
        <div
          className="absolute bottom-0 pointer-events-none z-15"
          style={{ left: '25.7%', transform: 'translateX(-50%)' }}
        >
          <div
            ref={needleLRef}
            className="w-[1.6px] h-12 origin-bottom"
            style={{
              background: 'linear-gradient(to top, var(--vu-needle-body) 0%, var(--vu-needle-body) 70%, var(--vu-needle-tip) 100%)',
              boxShadow: '0 0 2px rgba(0, 0, 0, 0.8), 0 0 4px rgba(220, 38, 38, 0.4)',
              transform: 'rotate(-36deg) translateZ(0)',
              transformOrigin: 'bottom center',
              willChange: 'transform',
            }}
          />
          {/* Mechanical Pivot Cap */}
          <div
            className="w-3.5 h-3.5 rounded-full absolute -bottom-1 -left-[5px]"
            style={{
              background: 'radial-gradient(circle at 35% 35%, #4a2810 0%, var(--vu-needle-pivot) 70%, #000000 100%)',
              border: '1px solid var(--vu-needle-pivot-rim)',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.95), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
            }}
          />
        </div>

        {/* Right Needle Pivot Assembly (X = 208 / 280 = 74.3%) */}
        <div
          className="absolute bottom-0 pointer-events-none z-15"
          style={{ left: '74.3%', transform: 'translateX(-50%)' }}
        >
          <div
            ref={needleRRef}
            className="w-[1.6px] h-12 origin-bottom"
            style={{
              background: 'linear-gradient(to top, var(--vu-needle-body) 0%, var(--vu-needle-body) 70%, var(--vu-needle-tip) 100%)',
              boxShadow: '0 0 2px rgba(0, 0, 0, 0.8), 0 0 4px rgba(220, 38, 38, 0.4)',
              transform: 'rotate(-36deg) translateZ(0)',
              transformOrigin: 'bottom center',
              willChange: 'transform',
            }}
          />
          {/* Mechanical Pivot Cap */}
          <div
            className="w-3.5 h-3.5 rounded-full absolute -bottom-1 -left-[5px]"
            style={{
              background: 'radial-gradient(circle at 35% 35%, #4a2810 0%, var(--vu-needle-pivot) 70%, #000000 100%)',
              border: '1px solid var(--vu-needle-pivot-rim)',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.95), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
            }}
          />
        </div>
      </div>
    </div>
  );
});

VuMeter.displayName = 'VuMeter';
