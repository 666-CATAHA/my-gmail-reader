function parseCookies(cookieHeader = "") {
  const out = {};
  for (const part of cookieHeader.split(";")) {
    const i = part.indexOf("=");
    if (i !== -1) {
      const key = part.slice(0, i).trim();
      const val = part.slice(i + 1).trim();
      out[key] = val;
    }
  }
  return out;
}

function decodeBase64Unicode(str) {
  const bin = atob(str);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifySession(raw, secret) {
  if (!raw || !raw.includes(".")) return null;

  const [payload, signature] = raw.split(".");
  const expected = await sha256(payload + secret);

  if (signature !== expected) return null;

  try {
    return JSON.parse(decodeBase64Unicode(payload));
  } catch {
    return null;
  }
}

function getHeader(headers, name) {
  const found = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
  return found?.value || "";
}

export async function onRequestGet(context) {
  const cookieHeader = context.request.headers.get("Cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const session = await verifySession(cookies.session, context.env.SESSION_SECRET);

  if (!session?.access_token) {
    return Response.json({ error: "Не авторизован" }, { status: 401 });
  }

  const listRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10", {
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
  });

  const listData = await listRes.json();

  if (!listRes.ok) {
    return Response.json(
      { error: listData.error?.message || "Ошибка Gmail API", raw: listData },
      { status: listRes.status }
    );
  }

  const ids = listData.messages || [];
  const messages = [];

  for (const item of ids) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      }
    );

    const msgData = await msgRes.json();
    if (!msgRes.ok) continue;

    const headers = msgData.payload?.headers || [];

    messages.push({
      id: msgData.id || "",
      subject: getHeader(headers, "Subject") || "(Без темы)",
      from: getHeader(headers, "From") || "",
      date: getHeader(headers, "Date") || "",
      snippet: msgData.snippet || ""
    });
  }

  return Response.json({ messages });
}
