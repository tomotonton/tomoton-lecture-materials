import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();

const IGNORE_DIRS = new Set([
  ".git",
  ".github",
  "node_modules",
  "tools",
]);

const IGNORE_FILES = new Set([
  "index.html",
]);

function isHtml(name) {
  return name.toLowerCase().endsWith(".html");
}

function listDir(dirAbs) {
  return fs.readdirSync(dirAbs, { withFileTypes: true });
}

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getLastUpdatedText() {
  try {
    const iso = execSync("git log -1 --format=%cI", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    const d = new Date(iso);
    return d.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    const d = new Date();
    return d.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

function toTitle(folderRel) {
  if (folderRel === ".") return "講義資料(青木)";
  return "講義資料(青木) / " + folderRel.replaceAll(path.sep, " / ");
}

function buildTreeHtml(dirAbs, relPath = "") {
  const entries = listDir(dirAbs);

  const folders = entries
    .filter((e) => e.isDirectory() && !IGNORE_DIRS.has(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "ja"));

  const files = entries
    .filter((e) => e.isFile() && isHtml(e.name) && !IGNORE_FILES.has(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "ja"));

  if (folders.length === 0 && files.length === 0) {
    return "<ul></ul>\n";
  }

  let html = "<ul>\n";

  for (const f of folders) {
    const childAbs = path.join(dirAbs, f);
    const childRel = relPath ? `${relPath}/${f}` : f;

    html += `<li>
<details>
<summary>${escapeHtml(f)}</summary>
${buildTreeHtml(childAbs, childRel)}
</details>
</li>
`;
  }

  for (const file of files) {
    const label = file.replace(/\.html$/i, "");
    const href = relPath
      ? `${encodeURI(relPath)}/${encodeURI(file)}`
      : encodeURI(file);

    html += `<li><a href="${href}" data-href="${href}" data-title="${escapeHtml(label)}" target="content">${escapeHtml(label)}</a></li>\n`;
  }

  html += "</ul>\n";
  return html;
}

function buildIndexHtml(folderRel, folders, files) {
  const title = toTitle(folderRel);

  if (folderRel === ".") {
    const tree = buildTreeHtml(ROOT, "");
    const updated = getLastUpdatedText();

    return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --nav-width: 360px;
      --splitter: 6px;
      --border: #ddd;
      --bg: #fff;
      --muted: #666;
      --active-bg: #f2f6ff;
    }
    html, body { height: 100%; margin: 0; }
    .app { height: 100%; display: flex; background: var(--bg); }
    .nav {
      width: var(--nav-width);
      min-width: 220px;
      max-width: 70vw;
      overflow: auto;
      border-right: 1px solid var(--border);
      padding: 12px;
      box-sizing: border-box;
      position: relative;
    }
    .navHeader {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      align-items: start;
      position: sticky;
      top: 0;
      background: var(--bg);
      padding: 6px 0 10px 0;
      margin-bottom: 8px;
      border-bottom: 1px solid var(--border);
      z-index: 2;
    }
    .navTitle { margin: 0; font-size: 20px; line-height: 1.2; }
    .navMeta { color: var(--muted); font-size: 12px; margin-top: 4px; }
    .navTools { display: flex; flex-direction: column; gap: 6px; align-items: end; }
    .iconBtn {
      font: inherit;
      width: 34px;
      height: 28px;
      border: 1px solid var(--border);
      background: #f7f7f7;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .searchBox {
      width: 100%;
      box-sizing: border-box;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 10px;
      margin: 8px 0 10px 0;
      font: inherit;
    }

    .splitter {
      width: var(--splitter);
      cursor: col-resize;
      background: transparent;
      position: relative;
    }
    .splitter::after {
      content: "";
      position: absolute;
      left: 2px;
      top: 0;
      width: 2px;
      height: 100%;
      background: var(--border);
    }

    .view { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 3;
      border-bottom: 1px solid var(--border);
      background: var(--bg);
      padding: 8px;
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      transition: transform 0.18s ease, opacity 0.18s ease;
    }
    .topbar.hidden {
      transform: translateY(-110%);
      opacity: 0;
      pointer-events: none;
    }
    .pageTitle { font-size: 13px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .view iframe { width: 100%; height: 100%; border: 0; flex: 1; }

    body.navClosed .nav { display: none; }
    body.navClosed .splitter { display: none; }

    a.activeLink {
      font-weight: 700;
      text-decoration: underline;
      background: var(--active-bg);
      border-radius: 6px;
      padding: 2px 4px;
    }

    @media (max-width: 900px) {
      .nav {
        position: fixed;
        left: 0;
        top: 0;
        bottom: 0;
        width: min(var(--nav-width), 85vw);
        max-width: 85vw;
        box-shadow: 8px 0 24px rgba(0,0,0,.12);
        border-right: 1px solid var(--border);
        z-index: 10;
      }
      .splitter { display: none; }
      body.navClosed .nav { display: none; }
      .overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.25);
        z-index: 9;
      }
      body.navOpenMobile .overlay { display: block; }
      body.navOpenMobile .nav { display: block; }
    }
  </style>
</head>
<body>
  <div class="overlay" id="overlay"></div>

  <div class="app" id="app">
    <nav class="nav" id="nav">
      <div class="navHeader">
        <div>
          <h1 class="navTitle">${escapeHtml(title)}</h1>
          <div class="navMeta">最終更新: ${escapeHtml(updated)}</div>
        </div>
        <div class="navTools">
          <button class="iconBtn" id="closeBtn" type="button" title="目次を閉じる">◀</button>
        </div>
      </div>

      <input class="searchBox" id="searchBox" type="search" placeholder="検索(タイトル)" autocomplete="off">

      ${tree}
    </nav>

    <div class="splitter" id="splitter" title="ドラッグで幅変更"></div>

    <main class="view">
      <div class="topbar" id="topbar">
        <button class="iconBtn" id="openBtn" type="button" title="目次を開く">▶</button>
        <div class="pageTitle" id="pageTitle">未選択</div>
      </div>
      <iframe name="content" id="contentFrame"></iframe>
    </main>
  </div>

  <script>
    (function () {
      const nav = document.getElementById("nav");
      const splitter = document.getElementById("splitter");
      const openBtn = document.getElementById("openBtn");
      const closeBtn = document.getElementById("closeBtn");
      const overlay = document.getElementById("overlay");
      const searchBox = document.getElementById("searchBox");
      const frame = document.getElementById("contentFrame");
      const pageTitle = document.getElementById("pageTitle");
      const topbar = document.getElementById("topbar");

      const KEY_W = "navWidth";
      const KEY_C = "navClosed";

      function setNavWidth(px) {
        const v = Math.max(220, Math.min(px, Math.floor(window.innerWidth * 0.7)));
        document.documentElement.style.setProperty("--nav-width", v + "px");
        localStorage.setItem(KEY_W, String(v));
      }

      function setClosed(closed) {
        localStorage.setItem(KEY_C, closed ? "1" : "0");
        document.body.classList.toggle("navClosed", closed);
        document.body.classList.remove("navOpenMobile");
      }

      const savedW = parseInt(localStorage.getItem(KEY_W) || "", 10);
      if (!Number.isNaN(savedW)) setNavWidth(savedW);

      const savedC = localStorage.getItem(KEY_C) === "1";
      setClosed(savedC);

      openBtn.addEventListener("click", () => {
        const isMobile = window.matchMedia("(max-width: 900px)").matches;
        if (isMobile) {
          document.body.classList.add("navOpenMobile");
          document.body.classList.remove("navClosed");
        } else {
          setClosed(false);
        }
      });

      closeBtn.addEventListener("click", () => {
        const isMobile = window.matchMedia("(max-width: 900px)").matches;
        if (isMobile) {
          document.body.classList.remove("navOpenMobile");
        } else {
          setClosed(true);
        }
      });

      overlay.addEventListener("click", () => {
        document.body.classList.remove("navOpenMobile");
      });

      let dragging = false;

      splitter.addEventListener("mousedown", () => {
        if (window.matchMedia("(max-width: 900px)").matches) return;
        dragging = true;
        document.body.style.userSelect = "none";
      });

      window.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        setNavWidth(e.clientX);
      });

      window.addEventListener("mouseup", () => {
        if (!dragging) return;
        dragging = false;
        document.body.style.userSelect = "";
      });

      window.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        document.body.classList.remove("navOpenMobile");
      });

      // Active link highlight + page title
      let activeA = null;

      function setActiveByHref(href) {
        const a = document.querySelector('a[data-href="' + CSS.escape(href) + '"]');
        if (!a) return;
        if (activeA) activeA.classList.remove("activeLink");
        activeA = a;
        activeA.classList.add("activeLink");
        pageTitle.textContent = activeA.getAttribute("data-title") || activeA.textContent || "表示中";
      }

      nav.addEventListener("click", (e) => {
        const a = e.target && e.target.closest ? e.target.closest("a[data-href]") : null;
        if (!a) return;

        const href = a.getAttribute("data-href");
        if (href) setActiveByHref(href);

        const isMobile = window.matchMedia("(max-width: 900px)").matches;
        if (isMobile) document.body.classList.remove("navOpenMobile");
      });

      function syncFromIframe() {
        try {
          const pathname = frame.contentWindow.location.pathname || "";
          const rel = pathname.startsWith("/") ? pathname.slice(1) : pathname;
          if (rel) setActiveByHref(rel);
        } catch {
          // ignore
        }
      }

      frame.addEventListener("load", () => {
        syncFromIframe();
        attachScrollWatcher();
      });

      // Search (title filter)
      function normalize(s) {
        return (s || "").toLowerCase();
      }

      function filterLinks(q) {
        const query = normalize(q).trim();
        const items = nav.querySelectorAll("a[data-href]");
        for (const a of items) {
          const t = normalize(a.getAttribute("data-title") || a.textContent);
          const li = a.closest("li");
          if (!li) continue;
          li.style.display = query === "" || t.includes(query) ? "" : "none";
        }
      }

      searchBox.addEventListener("input", () => {
        filterLinks(searchBox.value);
      });

      // Topbar auto hide: down -> hide, up -> show (iframe scroll)
      let lastY = 0;
      let ticking = false;
      const TH = 8;

      function onFrameScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          try {
            const y = frame.contentWindow.scrollY || frame.contentDocument.documentElement.scrollTop || 0;
            const diff = y - lastY;
            if (Math.abs(diff) >= TH) {
              if (diff > 0) topbar.classList.add("hidden");
              else topbar.classList.remove("hidden");
              lastY = y;
            }
          } catch {
            // can't access
          } finally {
            ticking = false;
          }
        });
      }

      function attachScrollWatcher() {
        try {
          frame.contentWindow.removeEventListener("scroll", onFrameScroll);
          lastY = frame.contentWindow.scrollY || 0;
          frame.contentWindow.addEventListener("scroll", onFrameScroll, { passive: true });
        } catch {
          // can't access
        }
      }

      setTimeout(syncFromIframe, 0);
    })();
  </script>
</body>
</html>
`;
  }

  const up =
    folderRel === "."
      ? ""
      : `  <p><a href="../index.html">上へ戻る</a></p>\n`;

  const folderList =
    folders.length === 0
      ? ""
      : `  <h2>フォルダ</h2>\n  <ul>\n${folders
          .map((f) => `    <li><a href="./${encodeURI(f)}/index.html">${escapeHtml(f)}</a></li>`)
          .join("\n")}\n  </ul>\n`;

  const fileList =
    files.length === 0
      ? ""
      : `  <h2>ページ</h2>\n  <ul>\n${files
          .map((name) => {
            const label = name.replace(/\.html$/i, "");
            return `    <li><a href="./${encodeURI(name)}">${escapeHtml(label)}</a></li>`;
          })
          .join("\n")}\n  </ul>\n`;

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
${up}${folderList}${fileList}
</body>
</html>
`;
}

function writeIndex(folderAbs, folderRel) {
  const entries = listDir(folderAbs);

  const folders = entries
    .filter((e) => e.isDirectory() && !IGNORE_DIRS.has(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "ja"));

  const files = entries
    .filter((e) => e.isFile() && isHtml(e.name) && !IGNORE_FILES.has(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "ja"));

  if (folders.length === 0 && files.length === 0) return;

  const html = buildIndexHtml(folderRel, folders, files);
  fs.writeFileSync(path.join(folderAbs, "index.html"), html, "utf8");
}

function walk(dirAbs, dirRel) {
  for (const e of listDir(dirAbs)) {
    if (!e.isDirectory()) continue;
    if (IGNORE_DIRS.has(e.name)) continue;

    const childAbs = path.join(dirAbs, e.name);
    const childRel = dirRel === "." ? e.name : path.join(dirRel, e.name);
    walk(childAbs, childRel);
  }

  writeIndex(dirAbs, dirRel);
}

walk(ROOT, ".");
console.log("index.html generated (including root tree).");
