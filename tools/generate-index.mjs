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

// フォルダ表示名（見た目）だけ変えたい時に使う
// 例: 実フォルダ名は英数字、表示だけ日本語
const FOLDER_LABELS = {
  Clang: "C言語",
  algorithm: "アルゴリズム",
};

function labelOfFolder(name) {
  return FOLDER_LABELS[name] ?? name;
}

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
  if (folderRel === ".") return "青木講義資料";
  return "青木講義資料 / " + folderRel.replaceAll(path.sep, " / ");
}

/*
========================================
全階層ツリー生成（折りたたみ）
- 表示名(label)とリンク先(実フォルダ名)を分離
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
  for (const folderName of folders) {
    const childAbs = path.join(dirAbs, folderName);

    // relPath はURL用：実フォルダ名を使う（表示名ではない）
    const childRel = relPath ? `${relPath}/${folderName}` : folderName;

    html += `<li>
<details>
<summary>${escapeHtml(labelOfFolder(folderName))}</summary>
${buildTreeHtml(childAbs, childRel)}
</details>
</li>
`;
  }

  // ファイル（HTMLページ）
  for (const file of files) {
    const label = file.replace(/\.html$/i, "");

    // relPath はURL用（実フォルダ名）
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

  // ルートだけ：全階層ツリー表示
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

  // サブフォルダ：従来通り（直下だけ一覧）
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
                labelOfFolder(f)
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

  // フォルダもファイルも無ければ index は作らない（空フォルダ対策）
  if (folders.length === 0 && files.length === 0) return;

  const html = buildIndexHtml(folderRel, folders, files);
  fs.writeFileSync(path.join(folderAbs, "index.html"), html, "utf8");
}

function walk(dirAbs, dirRel) {
  // 先に子を走査してから自分のindexを書く（子フォルダにもindexが生成される前提が確実になる）
  for (const e of listDir(dirAbs)) {
    if (!e.isDirectory()) continue;
    if (IGNORE_DIRS.has(e.name)) continue;

    const childAbs = path.join(dirAbs, e.name);
    const childRel = dirRel === "." ? e.name : path.join(dirRel, e.name);
    walk(childAbs, childRel);
  }

  // 最後にこのフォルダのindexを書く
  writeIndex(dirAbs, dirRel);
}

walk(ROOT, ".");
console.log("index.html generated (including root tree).");
