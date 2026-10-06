export function parseYouTubeId(input: string): string | null {
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
  try {
    const u = new URL(input);
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "www.youtube-nocookie.com",
      ].includes(host)
    ) {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else if (/^\/(embed|shorts|live)\//.test(u.pathname))
        id = u.pathname.split("/")[2];
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
