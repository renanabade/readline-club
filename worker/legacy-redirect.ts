export default {
  fetch(request: Request): Response {
    if (!["GET", "HEAD"].includes(request.method)) {
      return Response.json(
        {
          error:
            "O clube mudou para https://readline.club. Atualize a página e entre novamente.",
        },
        {
          status: 409,
          headers: {
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }
    const original = new URL(request.url);
    const target = new URL("https://readline.club");
    target.pathname = original.pathname;
    target.search = original.search;
    return Response.redirect(target.toString(), 308);
  },
};
