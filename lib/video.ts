import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { execYtDlp, explainYtDlpFailure, TranscribeError } from "./ytdlp";
import { recordProxyBytes } from "./usage";

export async function downloadStudioVideo(
  url: string,
  directory: string,
  maxHeight = 1080
): Promise<string> {
  const height = `[height<=${maxHeight}]`;
  const format = `bv*${height}[ext=mp4]+ba[ext=m4a]/bv*${height}+ba/b${height}/b`;
  const skipProxy = process.env.YT_DLP_PROXY_SKIP_DOWNLOADS === "1";

  try {
    await execYtDlp(
      url,
      [
        "-f",
        format,
        "--merge-output-format",
        "mp4",
        "-o",
        path.join(directory, "source.%(ext)s"),
      ],
      { maxBuffer: 16 * 1024 * 1024, timeout: 600_000, skipProxy }
    );
  } catch (error: any) {
    if (error instanceof TranscribeError) throw error;
    throw explainYtDlpFailure(String(error?.stderr || error?.message || ""));
  }

  const file = (await readdir(directory)).find((name) => name.startsWith("source."));
  if (!file) throw new TranscribeError("Video download produced no file.", 502);
  const filePath = path.join(directory, file);
  if (!skipProxy) recordProxyBytes((await stat(filePath)).size);
  return filePath;
}
