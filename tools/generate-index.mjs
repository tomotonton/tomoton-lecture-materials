
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
  if (folderRel === ".") return "講義用の資料(青木)";
  return "講義用の資料(青木) / " + folderRel.replaceAll(path.sep, " / ");
}

/*
========================================
追加：全階層ツリー生成（折りたたみ）
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

  // フォルダ（折りたたみ）
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

  // ファイル
  for (const file of files) {
    const label = file.replace(/\.html$/i, "");
    const href = relPath
      ? `${encodeURI(relPath)}/${encodeURI(file)}`
      : encodeURI(file);

    html += `<li><a href="${href}">${escapeHtml(label)}</a></li>\n`;
  }

  html += "</ul>\n";
  return html;
}

function buildIndexHtml(folderRel, folders, files) {
  const title = toTitle(folderRel);

  /*
  ========================================
  ルートだけ：全階層ツリー表示
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
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
${tree}
</body>
</html>
`;
  }

  // ここから下は従来通り（サブフォルダは直下だけ一覧）

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
