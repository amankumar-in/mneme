/**
 * Resolve a static asset URL that works on both the production server
 * and the phone's local server (where __LATERBOX_PRODUCTION__ is injected).
 */
export function assetUrl(filename: string): string {
  const base = (window as any).__LATERBOX_PRODUCTION__ || '/web/'
  return base + filename
}
