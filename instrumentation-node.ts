import { runRenderWorkerOnce } from "@/lib/render-worker";

export function registerNodeInstrumentation() {
  if (process.env.RENDER_WORKER_ENABLED === "false") return;
  if (!process.env.INSFORGE_API_KEY) {
    console.warn("Render worker disabled: INSFORGE_API_KEY is missing.");
    return;
  }

  const state = globalThis as typeof globalThis & { __cwapaRenderWorker?: ReturnType<typeof setInterval> };
  if (state.__cwapaRenderWorker) return;
  const tick = () => void runRenderWorkerOnce();
  setTimeout(tick, 1_500).unref();
  state.__cwapaRenderWorker = setInterval(tick, 5_000);
  state.__cwapaRenderWorker.unref();
}
