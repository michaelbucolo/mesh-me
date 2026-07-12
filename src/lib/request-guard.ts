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

export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through to empty object
  }
  return {};
}

export async function readFormData(req: Request): Promise<FormData | null> {
  try {
    return await req.formData();
  } catch {
    return null;
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
