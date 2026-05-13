export function logApiDuration(path: string, startedAt: number) {
  const duration = Math.round(performance.now() - startedAt);
  console.log(`[API] ${path} duration=${duration}ms`);
}
