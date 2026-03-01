import fs from "node:fs";
import path from "node:path";

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

function toTitle(folderRel) {
  if (folderRel === ".") return "講義資料(青木)";
  return "講義資料(青木) / " + folderRel.replaceAll(path.sep, " / ");
}

/*
========================================
全階層ツリー生成（折りたたみ）
- ルートindex専用
- クリックで右iframeへ表示させるため target="content" を付与
========================================
*/
function buildTreeHtml(dirAbs, relPath = "") {
  const entries = listDir(dirAbs);

  const folders = entries
    .filter((e) => e.isDirectory() && !IGNORE_DIRS.has(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "ja"));

  const files = entries
    .filter(
      (e) =>
        e.isFile() &&
        isHtml(e.name) &&
        !IGNORE_FILES.has(e.name)
    )
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

    html += `<li><a href="${href}" target="content">${escapeHtml(label)}</a></li>\n`;
  }

  html += "</ul>\n";
  return html;
}

function buildIndexHtml(folderRel, folders, files) {
  const title = toTitle(folderRel);

  /*
  ========================================
  ルート：左右分割 + 目次開閉 + ドラッグで幅変更 + 状態保存
  ========================================
  */
  if (folderRel === ".") {
    const tree = buildTreeHtml(ROOT, "");

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
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      position: sticky;
      top: 0;
      background: var(--bg);
      padding: 6px 0 10px 0;
      margin-bottom: 8px;
      border-bottom: 1px solid var(--border);
      z-index: 2;
    }
    .navHeader h1 { margin: 0; font-size: 24px; }
    .btn {
      font: inherit;
      padding: 6px 10px;
      border: 1px solid var(--border);
      background: #f7f7f7;
      border-radius: 6px;
      cursor: pointer;
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
    .view { flex: 1; min-width: 0; }
    .view iframe { width: 100%; height: calc(100% - 41px); border: 0; display: block; }
    .topbar {
      height: 41px;
      box-sizing: border-box;
      padding: 8px;
      border-bottom: 1px solid var(--border);
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .hint { opacity: .7; font-size: 12px; }

    /* nav hidden (desktop) */
    body.navClosed .nav { display: none; }
    body.navClosed .splitter { display: none; }

    /* mobile: overlay nav */
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
        display: none;
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

  <div class="app">
    <nav class="nav" id="nav">
      <div class="navHeader">
        <h1>${escapeHtml(title)}</h1>
        <button class="btn" id="closeBtn" type="button">閉じる</button>
      </div>

      ${tree}
    </nav>

    <div class="splitter" id="splitter" title="ドラッグで幅変更"></div>

    <main class="view">
      <div class="topbar">
        <button class="btn" id="openBtn" type="button">目次</button>
        <span class="hint">左の資料リンクをクリックすると右に表示されます</span>
      </div>
      <iframe name="content" title="講義資料"></iframe>
    </main>
  </div>

  <script>
    (function () {
      const splitter = document.getElementById("splitter");
      const openBtn = document.getElementById("openBtn");
      const closeBtn = document.getElementById("closeBtn");
      const overlay = document.getElementById("overlay");

      const KEY_W = "navWidth";
      const KEY_C = "navClosed";

      function setNavWidth(px) {
        const max = Math.floor(window.innerWidth * 0.7);
        const v = Math.max(220, Math.min(px, max));
        document.documentElement.style.setProperty("--nav-width", v + "px");
        localStorage.setItem(KEY_W, String(v));
      }

      function setClosed(closed) {
        localStorage.setItem(KEY_C, closed ? "1" : "0");
        document.body.classList.toggle("navClosed", closed);
        document.body.classList.remove("navOpenMobile");
      }

      // init width
      const savedW = parseInt(localStorage.getItem(KEY_W) || "", 10);
      if (!Number.isNaN(savedW)) setNavWidth(savedW);

      // init closed/open
      const savedC = localStorage.getItem(KEY_C) === "1";
      setClosed(savedC);

      // open/close
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

      // drag resize (desktop only)
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

      // ESC closes overlay on mobile
      window.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        document.body.classList.remove("navOpenMobile");
      });
    })();
  </script>
</body>
</html>
`;
  }

  // サブフォルダは従来通り
  const up =
    folderRel === "."
      ? ""
      : `  <p><a href="../index.html">上へ戻る</a></p>\n`;

  const folderList =
    folders.length === 0
      ? ""
      : `  <h2>フォルダ</h2>\n  <ul>\n${folders
          .map(
            (f) =>
              `    <li><a href="./${encodeURI(f)}/index.html">${escapeHtml(
                f
              )}</a></li>`
          )
          .join("\n")}\n  </ul>\n`;

  const fileList =
    files.length === 0
      ? ""
      : `  <h2>ページ</h2>\n  <ul>\n${files
          .map((name) => {
            const label = name.replace(/\.html$/i, "");
            return `    <li><a href="./${encodeURI(name)}">${escapeHtml(
              label
            )}</a></li>`;
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
    .filter(
      (e) =>
        e.isFile() &&
        isHtml(e.name) &&
        !IGNORE_FILES.has(e.name)
    )
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
