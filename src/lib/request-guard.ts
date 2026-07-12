export function isSameOriginRequest(req: Request): boolean {
  const host = req.headers.get("host");
  if (!host) return false;

  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    return false;
  }

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host.toLowerCase() === host.toLowerCase();
    } catch {
      return false;
    }
  }

  const referer = req.headers.get("referer");
  if (!referer) return false;

  try {
    return new URL(referer).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

export function isCrossSiteRequest(req: Request): boolean {
  const host = req.headers.get("host");
  if (!host) return true;

  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return true;

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host.toLowerCase() !== host.toLowerCase();
    } catch {
      return true;
    }
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host.toLowerCase() !== host.toLowerCase();
    } catch {
      return true;
    }
  }

  return false;
}
