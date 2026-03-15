async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    out[key] = val;
  }
  return out;
}

async function getSession(request, env) {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const raw = cookies.session;
  if (!raw || !raw.includes(".")) return null;

  const [payloadB64, sig] = raw.split(".");
  const expected = await sha256(payloadB64 + env.SESSION_SECRET);
  if (sig !== expected) return null;

  try {
    const json = decodeURIComponent(escape(atob(payloadB64)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getHeader(headers, name) {
  return headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

const parsedMessages = fullMessages.map(msg => {
  const headers = msg.payload?.headers || [];
  return {
    subject: getHeader(headers, "Subject") || "(Без темы)",
    from: getHeader(headers, "From") || "",
    date: getHeader(headers, "Date") || "",
    snippet: msg.snippet || ""
  };
});

return Response.json({ messages: parsedMessages });

export async function onRequestGet(context) {
  const session = await getSession(context.request, context.env);
  if (!session?.access_token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const listRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10",
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    }
  );

  const listData = await listRes.json();
  if (!listRes.ok) {
    return Response.json(listData, { status: listRes.status });
  }

  const messages = [];
  for (const item of listData.messages || []) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      }
    );

    const msg = await msgRes.json();
    if (!msgRes.ok) continue;

    const headers = msg.payload?.headers || [];
    messages.push({
      id: msg.id,
      threadId: msg.threadId,
      snippet: msg.snippet || "",
      subject: getHeader(headers, "Subject"),
      from: getHeader(headers, "From"),
      date: getHeader(headers, "Date")
    });
  }

  return Response.json({ messages });
}
