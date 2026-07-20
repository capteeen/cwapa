import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { getInsForgeAdminClient } from "@/lib/insforge-server";
import { renderCaptionedVideo } from "@/lib/rendering";

interface ClaimedJob {
  id: string;
  user_id: string;
  source_url: string;
  title: string;
  style: unknown;
  segments: unknown;
  attempt_count: number;
}

const workerId = `${process.env.RAILWAY_REPLICA_ID || "local"}-${randomUUID().slice(0, 8)}`;
let active = false;

function errorDetails(reason: unknown) {
  const error = reason as any;
  return {
    code: String(error?.code || error?.name || "RENDER_FAILED").slice(0, 80),
    message: String(error?.message || "Caption rendering failed.").slice(0, 1000),
  };
}

export async function runRenderWorkerOnce(): Promise<boolean> {
  if (active) return false;
  active = true;
  let job: ClaimedJob | null = null;
  try {
    const admin = getInsForgeAdminClient();
    const claimed = await admin.database.rpc("claim_render_job", { p_worker_id: workerId, p_lease_seconds: 1200 });
    if (claimed.error) throw claimed.error;
    job = (Array.isArray(claimed.data) ? claimed.data[0] : claimed.data) as ClaimedJob | null;
    if (!job?.id) return false;

    const progress = async (value: number) => {
      const result = await admin.database.rpc("update_render_progress", {
        p_job_id: job!.id, p_worker_id: workerId, p_progress: value,
      });
      if (result.error) console.warn("render progress update failed", result.error);
    };
    const rendered = await renderCaptionedVideo(job.source_url, job.segments, job.style, progress);
    try {
      const buffer = await readFile(rendered.outputPath);
      const safeTitle = job.title.replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "captioned";
      const key = `${job.user_id}/${job.id}/attempt-${job.attempt_count}-${safeTitle}.mp4`;
      const upload = await admin.storage.from("renders").upload(key, new File([buffer], `${safeTitle}.mp4`, { type: "video/mp4" }));
      if (upload.error || !upload.data?.url || !upload.data?.key) throw upload.error || new Error("Render upload failed.");
      const completed = await admin.database.rpc("complete_render_job", {
        p_job_id: job.id, p_worker_id: workerId, p_output_url: upload.data.url,
        p_output_key: upload.data.key, p_output_bytes: rendered.size,
      });
      if (completed.error) throw completed.error;
    } finally {
      await rendered.cleanup().catch(() => {});
    }
    return true;
  } catch (reason) {
    console.error("render worker failed", reason);
    if (job?.id) {
      const details = errorDetails(reason);
      try {
        await getInsForgeAdminClient().database.rpc("fail_render_job", {
          p_job_id: job.id, p_worker_id: workerId,
          p_error_code: details.code, p_error_message: details.message,
        });
      } catch (reportError) {
        console.error("render failure could not be persisted", reportError);
      }
    }
    return Boolean(job);
  } finally {
    active = false;
  }
}
