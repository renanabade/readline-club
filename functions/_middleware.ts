import legacy from "../worker/legacy-redirect";

export function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
}) {
  const hostname = new URL(context.request.url).hostname;
  if (
    hostname === "readlineclub.pages.dev" ||
    hostname === "www.readline.club"
  ) {
    return legacy.fetch(context.request);
  }
  return context.next();
}
