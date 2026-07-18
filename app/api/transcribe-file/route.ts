import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import { transcribeWithWhisper } from "@/lib/whisper";
import { TranscribeError } from "@/lib/ytdlp";

export const runtime = "nodejs";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 200 * 1024 * 1024);

export async function POST(req: NextRequest) {
  let file: File | null = null;
  try {
    const form = await req.formData();
    const entry = form.get("file");
    if (entry instanceof File) file = entry;
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "Attach an audio or video file." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File is too large — the limit is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.` },
      { status: 422 }
    );
  }

  const dir = await mkdtemp(path.join(tmpdir(), "cwapa-up-"));
  try {
    const sourcePath = path.join(dir, "source");
    await writeFile(sourcePath, Buffer.from(await file.arrayBuffer()));

    // Normalize to the small mono mp3 the Whisper API wants; this also
    // rejects non-media uploads with a clear error.
    const audioPath = path.join(dir, "audio.mp3");
    try {
      await execFileAsync(
        FFMPEG,
        ["-y", "-i", sourcePath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", audioPath],
        { maxBuffer: 16 * 1024 * 1024, timeout: 600_000 }
      );
    } catch (err: any) {
      if (err?.code === "ENOENT") {
        throw new TranscribeError("ffmpeg is not installed on the server.", 500);
      }
      throw new TranscribeError(
        "Couldn't read that file as audio or video. Supported: MP4, MOV, MP3, WAV, M4A, WEBM and similar.",
        422
      );
    }

    const { readFile } = await import("node:fs/promises");
    const audio = await readFile(audioPath);
    const transcript = await transcribeWithWhisper(audio);

    return NextResponse.json({
      platform: null,
      meta: {
        title: file.name.replace(/\.[^.]+$/, "") || "Uploaded file",
        uploader: "Uploaded file",
        durationSeconds: 0,
        thumbnail: null,
        webpageUrl: "",
      },
      transcript,
      source: "whisper",
    });
  } catch (err) {
    if (err instanceof TranscribeError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("transcribe-file failed:", err);
    return NextResponse.json(
      { error: "Something went wrong while transcribing. Try again." },
      { status: 500 }
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
