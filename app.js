function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadProfile() {
  const el = document.getElementById("profile");
  if (!el) return;

  try {
    const res = await fetch("/api/me", {
      credentials: "same-origin"
    });

    const data = await res.json();

    if (!res.ok) {
      el.innerHTML = `<p>${escapeHtml(data.error || "Не авторизован")}</p>`;
      return;
    }

    el.innerHTML = `
      <div class="profile-card">
        ${data.picture ? `<img src="${escapeHtml(data.picture)}" alt="avatar" class="avatar">` : ""}
        <div>
          <div><b>${escapeHtml(data.name || "Без имени")}</b></div>
          <div>${escapeHtml(data.email || "")}</div>
        </div>
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<p>Ошибка загрузки профиля</p>`;
  }
}

async function loadEmails() {
  const el = document.getElementById("emails");
  if (!el) return;

  try {
    const res = await fetch("/api/emails", {
      credentials: "same-origin"
    });

    const data = await res.json();

    if (!res.ok) {
      el.innerHTML = `<p>${escapeHtml(data.error || "Не удалось загрузить письма")}</p>`;
      return;
    }

    if (!data.messages || !Array.isArray(data.messages) || data.messages.length === 0) {
      el.innerHTML = `<p>Писем не найдено</p>`;
      return;
    }

    el.innerHTML = data.messages.map(msg => `
  <article class="mail-item">
    <div class="mail-top">
      <div class="mail-subject">${escapeHtml(msg.subject || "(Без темы)")}</div>
      <div class="mail-date">${escapeHtml(msg.date || "")}</div>
    </div>
    <div class="mail-from">${escapeHtml(msg.from || "")}</div>
    <div class="mail-snippet">${escapeHtml(msg.snippet || "")}</div>
  </article>
`).join("");
  } catch (e) {
    el.innerHTML = `<p>Ошибка загрузки писем</p>`;
  }
}

loadProfile();
loadEmails();
