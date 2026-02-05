(() => {
  const $ = (s) => document.querySelector(s);

  const KEY = "clipboard_manager_v1";
  let items = load();

  // UI refs
  const textEl = $("#text");
  const tagsEl = $("#tags");
  const pinEl = $("#pin");
  const listEl = $("#list");
  const statsEl = $("#stats");
  const searchEl = $("#search");
  const filterEl = $("#filter");
  const sortEl = $("#sort");
  const toastEl = $("#toast");
  const fileEl = $("#file");

  // ---------- Helpers ----------
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(items));
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.remove("show"), 900);
  }

  function escapeHtml(value) {
    const s = String(value ?? "");
    return s.replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m]));
  }

  function normalizeTags(tagStr) {
    return String(tagStr ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => t.replace(/\s+/g, " "))
      .map((t) => t.toLowerCase());
  }

  function snippetTitle(text) {
    const t = String(text ?? "").trim().replace(/\s+/g, " ");
    return t.length <= 42 ? t : t.slice(0, 42) + "…";
  }

  // ---------- CRUD ----------
  function addItem() {
    const text = textEl.value.trim();
    if (!text) return showToast("Nothing to save");

    const tags = normalizeTags(tagsEl.value);
    const pinned = pinEl.value === "yes";

    items.unshift({
      id: crypto.randomUUID(),
      text,
      tags,
      pinned,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    });

    save();
    textEl.value = "";
    tagsEl.value = "";
    pinEl.value = "no";
    render();
    showToast("Saved");
    textEl.focus();
  }

  function delItem(id) {
    items = items.filter((x) => x.id !== id);
    save();
    render();
    showToast("Deleted");
  }

  function togglePin(id) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    it.pinned = !it.pinned;
    it.updatedAt = nowISO();
    save();
    render();
    showToast(it.pinned ? "Pinned" : "Unpinned");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied");
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      showToast("Copied");
    }
  }

  function editItem(id) {
    const it = items.find((x) => x.id === id);
    if (!it) return;

    const newText = prompt("Edit text:", it.text);
    if (newText === null) return;

    const trimmed = newText.trim();
    if (!trimmed) return showToast("Empty text not saved");

    const newTags = prompt("Edit tags (comma separated):", (it.tags || []).join(", "));
    if (newTags === null) return;

    it.text = trimmed;
    it.tags = normalizeTags(newTags);
    it.updatedAt = nowISO();

    save();
    render();
    showToast("Updated");
  }

  // ---------- View ----------
  function getView() {
    const q = searchEl.value.trim().toLowerCase();
    const filter = filterEl.value;
    const sort = sortEl.value;

    let view = [...items];

    if (filter === "pinned") view = view.filter((x) => x.pinned);
    if (filter === "unpinned") view = view.filter((x) => !x.pinned);

    if (q) {
      view = view.filter((x) => {
        const inText = x.text.toLowerCase().includes(q);
        const inTags = (x.tags || []).some((t) => t.includes(q));
        return inText || inTags;
      });
    }

    // base sorting
    if (sort === "new") view.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === "old") view.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (sort === "az") view.sort((a, b) => a.text.localeCompare(b.text));

    // ✅ pinned always on top (except when filtering unpinned)
    if (filter !== "unpinned") {
      view.sort((a, b) => (a.pinned === b.pinned ? 0 : (a.pinned ? -1 : 1)));
    }

    return view;
  }

  function render() {
    statsEl.textContent = `${items.length} saved • pinned ${items.filter((x) => x.pinned).length}`;

    const view = getView();
    listEl.innerHTML = "";

    if (view.length === 0) {
      const empty = document.createElement("div");
      empty.className = "item";
      empty.innerHTML = `
        <div class="meta">No results.</div>
        <div class="text">Save your first snippet on the left.</div>
      `;
      listEl.appendChild(empty);
      return;
    }

    for (const it of view) {
      const el = document.createElement("div");
      el.className = "item";

      const title = escapeHtml(snippetTitle(it.text));
      const tags = (it.tags || []).map((t) => `<span class="badge">${escapeHtml(t)}</span>`).join(" ");
      const pinBadge = it.pinned ? `<span class="badge pin">Pinned</span>` : "";

      el.innerHTML = `
        <div class="topline">
          <div class="title">
            ${pinBadge}
            <b>${title}</b>
            ${tags ? `<span class="meta">${tags}</span>` : `<span class="meta">No tags</span>`}
          </div>
          <div class="meta">
            Saved: ${formatDate(it.createdAt)}
            ${it.updatedAt !== it.createdAt ? ` • Edited: ${formatDate(it.updatedAt)}` : ""}
          </div>
        </div>

        <div class="text">${escapeHtml(it.text)}</div>

        <div class="topline" style="margin-top:12px">
          <div class="actions">
            <button class="primary" data-act="copy">Copy</button>
            <button data-act="pin">${it.pinned ? "Unpin" : "Pin"}</button>
            <button data-act="edit">Edit</button>
            <button class="danger" data-act="del">Delete</button>
          </div>
          <div class="meta">Chars: ${it.text.length}</div>
        </div>
      `;

      el.querySelector('[data-act="copy"]').onclick = () => copyText(it.text);
      el.querySelector('[data-act="pin"]').onclick = () => togglePin(it.id);
      el.querySelector('[data-act="edit"]').onclick = () => editItem(it.id);
      el.querySelector('[data-act="del"]').onclick = () => {
        if (confirm("Delete this snippet?")) delItem(it.id);
      };

      listEl.appendChild(el);
    }
  }

  // ---------- Clipboard read ----------
  async function pasteFromClipboard() {
    try {
      const t = await navigator.clipboard.readText();
      if (!t) return showToast("Clipboard empty");
      textEl.value = t;
      showToast("Pasted");
      textEl.focus();
    } catch {
      showToast("Clipboard blocked (use HTTPS/localhost)");
    }
  }

  // ---------- Export / Import ----------
  function exportJSON() {
    const data = JSON.stringify({ version: 1, exportedAt: nowISO(), items }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clipboard-manager-backup.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported");
  }

  function importJSONFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incoming = Array.isArray(parsed) ? parsed : (parsed.items || []);
        if (!Array.isArray(incoming)) throw new Error("Invalid format");

        const cleaned = incoming
          .filter((x) => x && typeof x.text === "string" && x.text.trim().length)
          .map((x) => ({
            id: x.id || crypto.randomUUID(),
            text: String(x.text),
            tags: Array.isArray(x.tags) ? x.tags.map((t) => String(t).toLowerCase()) : [],
            pinned: !!x.pinned,
            createdAt: x.createdAt || nowISO(),
            updatedAt: x.updatedAt || (x.createdAt || nowISO()),
          }));

        // merge by id
        const map = new Map(items.map((x) => [x.id, x]));
        for (const c of cleaned) map.set(c.id, c);

        items = [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        save();
        render();
        showToast("Imported");
      } catch {
        alert("Import failed: invalid JSON format.");
      }
    };
    reader.readAsText(file);
  }

  // ---------- Events ----------
  $("#saveBtn").onclick = addItem;
  $("#pasteBtn").onclick = pasteFromClipboard;
  $("#exportBtn").onclick = exportJSON;
  $("#importBtn").onclick = () => fileEl.click();

  fileEl.onchange = () => {
    const f = fileEl.files && fileEl.files[0];
    if (f) importJSONFile(f);
    fileEl.value = "";
  };

  $("#clearAllBtn").onclick = () => {
    if (!items.length) return showToast("Nothing to clear");
    if (confirm("Delete ALL saved snippets? This cannot be undone.")) {
      items = [];
      save();
      render();
      showToast("Cleared");
    }
  };

  searchEl.addEventListener("input", render);
  filterEl.addEventListener("change", render);
  sortEl.addEventListener("change", render);

  // Ctrl/Cmd + Enter to save
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") addItem();
  });

  render();
})();
