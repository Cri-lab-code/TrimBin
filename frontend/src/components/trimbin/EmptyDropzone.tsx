import React from 'react';
import { Film, UploadCloud } from 'lucide-react';

interface EmptyDropzoneProps {
  isDragging: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onClick: () => void;
}

export const EmptyDropzone: React.FC<EmptyDropzoneProps> = ({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
}) => {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      className="relative z-20 w-full max-w-[620px] flex flex-col items-center justify-center cursor-pointer select-none group py-8 px-6 rounded-lg transition-all duration-300"
    >
      {/* Large Direct Vector Icon (No Circle) */}
      <div className="relative flex flex-col items-center justify-center mb-2">
        <div
          className={`relative transition-transform duration-300 ${
            isDragging ? 'scale-115 -translate-y-2' : 'group-hover:scale-110 group-hover:-translate-y-1'
          }`}
        >
          {/* Subtle Ambient Glow behind icon */}
          <div
            className={`absolute -inset-4 rounded-full transition-opacity duration-500 pointer-events-none ${
              isDragging ? 'opacity-90' : 'opacity-25 group-hover:opacity-60'
            }`}
            style={{
              background:
                'var(--halo-amber)',
            }}
          />

          <Film
            className={`w-24 h-24 drop-shadow-subtle transition-colors duration-300 ${
              isDragging ? 'text-amber-300' : 'text-slate-300 group-hover:text-amber-400'
            }`}
            strokeWidth={1.35}
          />
          <UploadCloud
            className="w-7 h-7 absolute -bottom-1 -right-1 text-amber-400 bg-[var(--bg-inset)] rounded-full p-1 border border-[var(--accent-amber-border)] shadow-panel-bevel"
            strokeWidth={2.4}
          />
        </div>
      </div>

      {/* Professional Typographic Hierarchy */}
      <div className="relative z-10 flex flex-col items-center text-center mt-4 space-y-1">
        <h2
          className={`font-sans font-bold text-sm tracking-wider uppercase transition-colors duration-200 ${
            isDragging ? 'text-amber-300' : 'text-slate-100 group-hover:text-amber-200'
          }`}
        >
          Drop Media or Reel to Begin
        </h2>
        <p className="font-sans text-xs text-slate-400 group-hover:text-slate-300 transition-colors flex items-center gap-1.5">
          <span>Click to browse from local drive</span>
          <span className="text-slate-600">•</span>
          <span className="text-amber-400/90 font-mono text-[11px]">Auto-Editor & Whisper Rough-Cutter</span>
        </p>
      </div>

      {/* Format Chips */}
      <div className="relative z-10 flex items-center justify-center gap-1.5 mt-5 flex-wrap">
        {[
          { ext: 'MP4', desc: 'H.264 / HEVC' },
          { ext: 'MOV', desc: 'ProRes / DNx' },
          { ext: 'MKV', desc: 'Multi-Track' },
          { ext: 'WAV', desc: 'Broadcast Audio' },
          { ext: 'MP3', desc: 'Audio Stream' },
        ].map((item) => (
          <div
            key={item.ext}
            className="px-2.5 py-1 rounded-[3px] bg-[var(--bg-panel-sub)] border border-[var(--border-default)] group-hover:border-slate-600/70 text-slate-300 flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span className="font-mono text-[10px] font-bold text-amber-300/90">{item.ext}</span>
            <span className="text-[9px] font-sans text-slate-400 font-medium">{item.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
