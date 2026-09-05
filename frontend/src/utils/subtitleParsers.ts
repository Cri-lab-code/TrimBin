import { TranscriptSegment } from '@/global';

export const formatTimestamp = (seconds?: number): string => {
  if (seconds === undefined || isNaN(seconds) || seconds < 0) return '00:00.0';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
};

export const formatSrtTime = (seconds?: number): string => {
  if (seconds === undefined || isNaN(seconds) || seconds < 0) return '00:00:00,000';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
};

export const formatVttTime = (seconds?: number): string => {
  if (seconds === undefined || isNaN(seconds) || seconds < 0) return '00:00:00.000';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

export const buildSrtContent = (segments: TranscriptSegment[]): string => {
  if (!Array.isArray(segments)) return '';
  return segments
    .filter(Boolean)
    .map((seg, idx) => {
      return `${idx + 1}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n${seg.text || ''}\n`;
    })
    .join('\n');
};

export const buildVttContent = (segments: TranscriptSegment[]): string => {
  if (!Array.isArray(segments)) return 'WEBVTT\n\n';
  const header = 'WEBVTT\n\n';
  const body = segments
    .filter(Boolean)
    .map((seg, idx) => {
      return `${idx + 1}\n${formatVttTime(seg.start)} --> ${formatVttTime(seg.end)}\n${seg.text || ''}\n`;
    })
    .join('\n');
  return header + body;
};
