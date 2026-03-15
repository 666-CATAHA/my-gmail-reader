export async function onRequestGet(context) {
  const { request } = context;

  try {
    const cookieHeader = request.headers.get("Cookie") || "";

    return new Response(JSON.stringify({
      ok: true,
      cookieHeader
    }, null, 2), {
      headers: {
        "content-type": "application/json; charset=UTF-8"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "debug failed",
      details: String(error)
    }, null, 2), {
      status: 500,
      headers: {
        "content-type": "application/json; charset=UTF-8"
      }
    });
  }
}
