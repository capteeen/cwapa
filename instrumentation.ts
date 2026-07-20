export async function register() {
  // Keep Node-only FFmpeg and filesystem modules out of Next's Edge
  // instrumentation bundle. Next statically eliminates this whole branch.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.RENDER_WORKER_ENABLED === "false") return;
    if (!process.env.INSFORGE_API_KEY) {
      console.warn("Render worker disabled: INSFORGE_API_KEY is missing.");
      return;
    }
    const { runRenderWorkerOnce } = await import("./lib/render-worker");
    const state = globalThis as typeof globalThis & { __cwapaRenderWorker?: ReturnType<typeof setInterval> };
    if (state.__cwapaRenderWorker) return;
    const tick = () => void runRenderWorkerOnce();
    setTimeout(tick, 1_500).unref();
    state.__cwapaRenderWorker = setInterval(tick, 5_000);
    state.__cwapaRenderWorker.unref();
  }
}
