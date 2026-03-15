export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const cookie = request.headers.get("Cookie") || "";
    const session = parseSession(cookie);

    if (!session?.accessToken) {
      return json({ error: "Не авторизован" }, 401);
    }

    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15",
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    const listData = await listRes.json();

    if (!listRes.ok) {
      return json(
        { error: listData.error?.message || "Не удалось получить список писем" },
        listRes.status
      );
    }

    const ids = Array.isArray(listData.messages) ? listData.messages : [];

    if (ids.length === 0) {
      return json({ messages: [] });
    }

    const fullMessages = await Promise.all(
      ids.map(async ({ id }) => {
        const res = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages/" +
            encodeURIComponent(id) +
            "?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date",
          {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
            },
          }
        );

        const data = await res.json();

        if (!res.ok) {
          return {
            subject: "(Ошибка загрузки письма)",
            from: "",
            date: "",
            snippet: data.error?.message || "",
          };
        }

        const headers = data.payload?.headers || [];

        return {
          subject: getHeaderValue(headers, "Subject") || "(Без темы)",
          from: getHeaderValue(headers, "From") || "",
          date: getHeaderValue(headers, "Date") || "",
          snippet: typeof data.snippet === "string" ? data.snippet : "",
        };
      })
    );

    return json({ messages: fullMessages });
  } catch (error) {
    return json({ error: "Внутренняя ошибка сервера" }, 500);
  }
}

function getHeaderValue(headers, name) {
  const header = headers.find(
    (h) => String(h?.name || "").toLowerCase() === name.toLowerCase()
  );
  return typeof header?.value === "string" ? header.value : "";
}

function parseSession(cookieHeader) {
  const cookies = Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const eqIndex = part.indexOf("=");
        if (eqIndex === -1) return [part, ""];
        return [part.slice(0, eqIndex), decodeURIComponent(part.slice(eqIndex + 1))];
      })
  );

  if (!cookies.session) return null;

  try {
    return JSON.parse(cookies.session);
  } catch {
    return null;
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
    },
  });
}
