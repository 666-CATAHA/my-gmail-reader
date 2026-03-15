async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function b64encode(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new Response("Нет code от Google", { status: 400 });
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: context.env.GOOGLE_CLIENT_ID,
      client_secret: context.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/auth/callback`,
      grant_type: "authorization_code"
    })
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    return new Response(
      `Token exchange failed:\n${JSON.stringify(tokenData, null, 2)}`,
      { status: 500, headers: { "Content-Type": "text/plain; charset=UTF-8" } }
    );
  }

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`
    }
  });

  const profileData = await profileRes.json();

  if (!profileRes.ok) {
    return new Response(
      `Profile fetch failed:\n${JSON.stringify(profileData, null, 2)}`,
      { status: 500, headers: { "Content-Type": "text/plain; charset=UTF-8" } }
    );
  }

  const session = {
    email: profileData.email || "",
    name: profileData.name || "",
    given_name: profileData.given_name || "",
    family_name: profileData.family_name || "",
    picture: profileData.picture || "",
    access_token: tokenData.access_token || ""
  };

  const payload = b64encode(session);
  const signature = await sha256(payload + context.env.SESSION_SECRET);
  const cookieValue = `${payload}.${signature}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/app",
      "Set-Cookie": `session=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
    }
  });
}
