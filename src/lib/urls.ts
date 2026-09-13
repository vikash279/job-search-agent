const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "source",
]);

export function canonicalizeUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (
      (url.protocol === "http:" && url.port === "80") ||
      (url.protocol === "https:" && url.port === "443")
    ) {
      url.port = "";
    }
    const params = [...url.searchParams.entries()]
      .filter(([key]) => !TRACKING_PARAMS.has(key.toLowerCase()))
      .sort(([a], [b]) => a.localeCompare(b));
    url.search = "";
    for (const [key, value] of params) {
      url.searchParams.append(key, value);
    }
    let href = url.toString();
    if (href.endsWith("/") && url.pathname === "/") {
      href = href.slice(0, -1);
    }
    return href;
  } catch {
    return raw.trim();
  }
}

export function urlsLikelySame(a: string, b: string): boolean {
  return canonicalizeUrl(a) === canonicalizeUrl(b);
}
