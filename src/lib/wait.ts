/** "2h 5m" / "12 min" — pure, so the server's explain() and the browser's quota message agree. */
export function formatWait(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}
