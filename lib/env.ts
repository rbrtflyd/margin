/** True when a Convex deployment URL is present. Until then the app runs signed-out. */
export function isConvexConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
}
