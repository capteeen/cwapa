import type { TranscriptSegment } from "./whisper";

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function srtTimestamp(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = String(Math.floor(ms / 3_600_000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, "0");
  const s = String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0");
  const milli = String(ms % 1000).padStart(3, "0");
  return `${h}:${m}:${s},${milli}`;
}

export function toSrt(segments: TranscriptSegment[]): string {
  return segments
    .map(
      (seg, i) =>
        `${i + 1}\n${srtTimestamp(seg.start)} --> ${srtTimestamp(seg.end)}\n${seg.text}\n`
    )
    .join("\n");
}
