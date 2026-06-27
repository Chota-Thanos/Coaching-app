export function deriveContentFamily(contentKind: string, explicitFamily?: string): string {
  if (explicitFamily) return explicitFamily;
  return ["daily_current_affairs", "prelims_pyq"].includes(contentKind) ? "prelims" : "mains";
}
