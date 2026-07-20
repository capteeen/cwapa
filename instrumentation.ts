export async function register() {
  // Next builds instrumentation for both Node and Edge. Keep Node-only modules
  // behind this exact runtime branch so webpack never follows them for Edge.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNodeInstrumentation } = await import("./instrumentation-node");
    registerNodeInstrumentation();
  }
}
