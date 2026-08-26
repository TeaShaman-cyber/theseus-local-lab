export function shouldQueueResearch(_event, env = process.env) {
  return env.THESEUS_HOOK_RESEARCH === "1";
}
