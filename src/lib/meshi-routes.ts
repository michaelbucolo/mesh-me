// Routes where the global Meshi companion (and its delivery arrivals) must not
// appear: public marketing and auth pages have their own Meshi identity moments.
const MESHI_PUBLIC_ROUTES = new Set([
  "/",
  "/about",
  "/features",
  "/innovation",
  "/login",
  "/privacy",
  "/reset-password",
  "/roadmap",
  "/signup",
  "/terms",
  "/trust",
  "/vision",
]);

export function shouldHideGlobalMeshi(pathname: string) {
  return MESHI_PUBLIC_ROUTES.has(pathname) || pathname.startsWith("/login/");
}
