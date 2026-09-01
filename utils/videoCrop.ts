import { execFile } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import os from "os";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";

const execFileAsync = promisify(execFile);

// YouTube Shorts classification is based on the video's actual frame
// shape, not any upload flag or the "#Shorts" tag — a horizontal video
// never becomes a Short no matter what metadata is sent (confirmed live:
// a 1920x1080 clip uploaded with "#Shorts" in the title still landed in
// the channel's regular Videos tab, not Shorts). So a "Short" upload
// center-crops to 9:16 first. The crop filter's min()-based expressions
// work whether the source is landscape, portrait, or already 9:16 —
// an already-vertical source just crops to itself (near no-op).
export async function cropVideoToVertical(videoUrl: string): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
  const workDir = os.tmpdir();
  const inputPath = path.join(workDir, `short-in-${randomUUID()}.mp4`);
  const outputPath = path.join(workDir, `short-out-${randomUUID()}.mp4`);

  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok || !videoResponse.body) {
    throw new Error(`Couldn't fetch the video file from storage (${videoResponse.status}).`);
  }
  const buffer = Buffer.from(await videoResponse.arrayBuffer());
  await fs.writeFile(inputPath, buffer);

  async function cleanup() {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }

  try {
    await execFileAsync(
      ffmpegPath.path,
      [
        "-y",
        "-i",
        inputPath,
        "-vf",
        "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)'",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "20",
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      { maxBuffer: 1024 * 1024 * 50 }
    );
  } catch (error) {
    await cleanup();
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to crop video to vertical for Shorts: ${message}`);
  }

  return { filePath: outputPath, cleanup };
}
