import { Hono } from "hono";
import type { AppEnv } from "../env";
import { missing } from "../errors";
import { filePath, fileKey } from "../lib/files";
const files = new Hono<AppEnv>();
files.get("/:key", async (c) => {
  const url = c.env.APP_ORIGIN + filePath + c.req.param("key");
  const key = fileKey(url, c.env.APP_ORIGIN);
  // Only serve objects still attached to a material.
  const resource =
    key &&
    (await c.env.DB.prepare("SELECT title FROM resources WHERE url=?")
      .bind(url)
      .first<{ title: string }>());
  const object = resource && (await c.env.FILES?.get(key));
  if (!object) return missing();
  const type = object.customMetadata?.type === "epub" ? "epub" : "pdf";
  const name =
    resource.title
      .normalize("NFD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "material";
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType || "application/pdf",
      "content-length": String(object.size),
      // PDFs open in the browser; EPUBs go to the reader app.
      "content-disposition": `${type === "pdf" ? "inline" : "attachment"}; filename="${name}.${type}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
export { files };
