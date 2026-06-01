// cpp-judge.js
// ブラウザ内で完結するC++練習問題エンジン（JSCPP使用・サーバ不要）
//
// 各問題HTMLは window.PROBLEM = { id, starter, sampleInput, tests:[{name,input,expected}] }
// を定義し、JSCPP本体 → この cpp-judge.js の順に読み込む。
// このスクリプトが #judge 要素にエディタ・ボタン・入出力欄・テスト結果を描画する。

(function () {
  "use strict";

  var RUN_TIMEOUT_MS = 3000; // 無限ループ対策（これを超えると例外）

  // ===== 出力の正規化（末尾の空白・改行差を吸収して比較する）=====
  function normalize(s) {
    return String(s == null ? "" : s)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map(function (line) { return line.replace(/[ \t　]+$/, ""); }) // 各行の末尾空白除去
      .join("\n")
      .replace(/\n+$/, "")   // 末尾の空行を除去
      .replace(/^\n+/, "");  // 先頭の空行を除去
  }

  // ===== JSCPP でコードを実行 =====
  function runCode(code, input) {
    var out = "";
    if (typeof JSCPP === "undefined" || !JSCPP.run) {
      return { ok: false, output: "", error: "実行エンジン(JSCPP)を読み込めませんでした。通信環境を確認してください。" };
    }
    try {
      var exit = JSCPP.run(code, String(input == null ? "" : input), {
        stdio: { write: function (s) { out += s; } },
        maxTimeout: RUN_TIMEOUT_MS,
        unsigned_overflow: "ignore"
      });
      return { ok: true, output: out, exit: exit };
    } catch (e) {
      var msg = (e && (e.message || e.toString())) || "実行時エラー";
      if (/timeout/i.test(msg)) {
        msg = "時間切れ（" + (RUN_TIMEOUT_MS / 1000) + "秒）。無限ループになっていないか確認してください。";
      }
      return { ok: false, output: out, error: msg };
    }
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  // ===== Firebase（合格／挑戦の人数集計・管理者リセット）=====
  var FB_CONFIG = {
    apiKey: "AIzaSyCaZLloa4UuZGriB2hL18O-QkiAbc6Vq_Y",
    authDomain: "aoki-lecture-materials-quiz.firebaseapp.com",
    databaseURL: "https://aoki-lecture-materials-quiz-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "aoki-lecture-materials-quiz",
    storageBucket: "aoki-lecture-materials-quiz.firebasestorage.app",
    messagingSenderId: "468181696021",
    appId: "1:468181696021:web:fc32bc79516f5fc062181c"
  };
  var _fb = null;
  function ensureFirebase() {
    if (_fb) return Promise.resolve(_fb);
    return Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js")
    ]).then(function (mods) {
      var app = mods[0].initializeApp(FB_CONFIG);
      var db = mods[1].getDatabase(app);
      _fb = { db: db, ref: mods[1].ref, onValue: mods[1].onValue, update: mods[1].update, remove: mods[1].remove };
      return _fb;
    }).catch(function () { return null; });
  }
  function getUid() {
    var k = "practiceUid", v = null;
    try { v = localStorage.getItem(k); } catch (e) {}
    if (!v) {
      v = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem(k, v); } catch (e) {}
    }
    return v;
  }
  // 提出結果を記録（同じ人の重複は set 扱いで1人としてカウント）
  function recordResult(problemId, passed) {
    if (!problemId) return;
    ensureFirebase().then(function (f) {
      if (!f) return;
      var uid = getUid(), updates = {};
      updates["practiceStats/" + problemId + "/attempted/" + uid] = true;
      if (passed) updates["practiceStats/" + problemId + "/passed/" + uid] = true;
      f.update(f.ref(f.db), updates).catch(function () {});
    });
  }
  // 合格人数・挑戦人数をリアルタイム購読
  function subscribeStats(problemId, cb) {
    if (!problemId) return;
    ensureFirebase().then(function (f) {
      if (!f) return;
      f.onValue(f.ref(f.db, "practiceStats/" + problemId), function (snap) {
        var v = snap.val() || {};
        cb(v.passed ? Object.keys(v.passed).length : 0,
           v.attempted ? Object.keys(v.attempted).length : 0);
      });
    });
  }
  function resetStats(problemId) {
    return ensureFirebase().then(function (f) {
      if (!f) throw new Error("Firebaseに接続できませんでした");
      return f.remove(f.ref(f.db, "practiceStats/" + problemId));
    });
  }

  // パスワード形式（伏字）の入力ダイアログ（プロジェクター投影時に文字が見えないように）
  function passwordPrompt(message) {
    return new Promise(function (resolve) {
      var overlay = document.createElement("div");
      overlay.style.cssText = ["position:fixed", "inset:0", "background:rgba(0,0,0,0.45)", "z-index:99999", "display:flex", "align-items:center", "justify-content:center", "font-family:sans-serif"].join(";");
      var dialog = document.createElement("div");
      dialog.style.cssText = ["background:#fff", "padding:1.4em 1.4em 1.1em", "border-radius:8px", "min-width:280px", "max-width:90vw", "box-shadow:0 6px 28px rgba(0,0,0,0.35)"].join(";");
      var msg = document.createElement("div");
      msg.textContent = message;
      msg.style.cssText = "margin-bottom:0.7em;font-size:0.95em;color:#333;";
      var input = document.createElement("input");
      input.type = "password"; input.autocomplete = "off";
      input.style.cssText = "width:100%;padding:0.5em 0.6em;font-size:1em;border:1px solid #aaa;border-radius:4px;box-sizing:border-box;";
      var btnRow = document.createElement("div");
      btnRow.style.cssText = "margin-top:1em;display:flex;gap:0.5em;justify-content:flex-end;";
      var cancelBtn = document.createElement("button");
      cancelBtn.textContent = "キャンセル";
      cancelBtn.style.cssText = "padding:0.4em 1em;cursor:pointer;border:1px solid #aaa;background:#f5f5f5;border-radius:4px;";
      var okBtn = document.createElement("button");
      okBtn.textContent = "OK";
      okBtn.style.cssText = "padding:0.4em 1em;cursor:pointer;background:#4a90d9;color:#fff;border:1px solid #4a90d9;border-radius:4px;";
      btnRow.append(cancelBtn, okBtn);
      dialog.append(msg, input, btnRow);
      overlay.append(dialog);
      document.body.append(overlay);
      setTimeout(function () { input.focus(); }, 0);
      var cleanup = function () { overlay.remove(); };
      var onOk = function () { var v = input.value; cleanup(); resolve(v); };
      var onCancel = function () { cleanup(); resolve(null); };
      okBtn.onclick = onOk;
      cancelBtn.onclick = onCancel;
      overlay.addEventListener("click", function (e) { if (e.target === overlay) onCancel(); });
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") onOk(); else if (e.key === "Escape") onCancel(); });
    });
  }
  // 右下の管理者用クリアボタン（理解度チェックと同じ。キーワード ignas）
  function injectResetButton() {
    if (!window.PROBLEM || !window.PROBLEM.id) return;
    if (document.getElementById("cj-reset-btn")) return;
    var btn = document.createElement("button");
    btn.id = "cj-reset-btn";
    btn.textContent = "⚙";
    btn.style.cssText = ["position:fixed", "bottom:6px", "right:6px", "background:transparent", "color:rgba(160,160,160,0.18)", "border:1px solid rgba(160,160,160,0.1)", "border-radius:2px", "padding:0 2px", "font-size:9px", "line-height:1.4", "cursor:pointer", "z-index:9999", "user-select:none"].join(";");
    btn.addEventListener("click", function () {
      passwordPrompt("キーワードを入力してください：").then(function (input) {
        if (input === null) return;
        if (input !== "ignas") { alert("キーワードが違います。"); return; }
        btn.textContent = "削除中..."; btn.disabled = true;
        resetStats(window.PROBLEM.id).then(function () {
          alert("この問題の「合格／挑戦」の記録をリセットしました。");
          btn.textContent = "⚙"; btn.disabled = false;
        }).catch(function (e) {
          alert("リセット中にエラーが発生しました：" + (e && e.message));
          btn.textContent = "⚙"; btn.disabled = false;
        });
      });
    });
    document.body.appendChild(btn);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // 表示用：空文字や改行を見えるようにする
  function showIO(s) {
    if (s === "" || s == null) return '<span class="cj-empty">（なし）</span>';
    return esc(s).replace(/\n/g, '<span class="cj-nl">⏎</span>\n');
  }

  // ===== エラーを学生向けにやさしく言い換える =====
  function getCodeLine(code, lineNo) {
    if (!lineNo) return null;
    var lines = String(code || "").split("\n");
    return lines[lineNo - 1] != null ? lines[lineNo - 1] : null;
  }

  function friendlyError(raw, code) {
    raw = String(raw || "");
    var line = (raw.match(/line\s+(\d+)/i) || [])[1];
    var col = (raw.match(/column\s+(\d+)/i) || [])[1];
    if (!line) { var lc = raw.match(/(?:^|\n)\s*(\d+)\s*:\s*(\d+)\b/); if (lc) { line = lc[1]; col = lc[2]; } }
    line = line ? parseInt(line, 10) : null;
    col = col ? parseInt(col, 10) : null;
    var fm = raw.match(/but\s+(?:"([^"]*)"|([^\s]+))\s+found/i);
    var found = fm ? (fm[1] != null ? fm[1] : fm[2]) : null;

    var isParse = /parsing failure|parse error|unexpected|expected[\s\S]*found/i.test(raw);
    var isUndef = /not (defined|declared)|undefined|undeclared|unknown (identifier|variable)|cannot find|use of undeclared|does ?n.?t exist/i.test(raw);
    var isTimeout = /timeout|時間切れ/i.test(raw);

    function countCh(str, ch) { var n = 0; for (var i = 0; i < str.length; i++) if (str[i] === ch) n++; return n; }
    var src = String(code || "");
    var braceOpen = countCh(src, "{"), braceClose = countCh(src, "}");
    var parenOpen = countCh(src, "("), parenClose = countCh(src, ")");

    var summary, hints = [];

    if (isTimeout) {
      summary = "時間切れです（無限ループになっているかもしれません）。";
      hints.push("ループの<strong>終了条件</strong>（例 <code>i &lt; n</code>）と、<strong>カウンタの更新</strong>（例 <code>i++</code>）が正しいか確認しましょう。");
    } else if (isUndef) {
      var nm = (raw.match(/variable\s+([A-Za-z_]\w*)/i) || raw.match(/['"]?([A-Za-z_]\w*)['"]?\s*(?:is)?\s*(?:not\s+)?(?:defined|declared|does)/i) || [])[1];
      summary = (nm ? "『" + nm + "』という名前" : "ある名前") + "が見つかりません（宣言されていません）。";
      hints.push("変数・関数の<strong>つづり間違い</strong>か、<strong>宣言のし忘れ</strong>がないか確認しましょう。");
      if (!nm || /^(cout|cin|endl|cerr)$/.test(nm)) {
        hints.push("<code>cout</code>/<code>cin</code>/<code>endl</code> を使うには、先頭に <code>#include &lt;iostream&gt;</code> と <code>using namespace std;</code> が必要です。");
      }
      if (nm && /^(string|getline|stoi|to_string)$/.test(nm)) {
        hints.push("文字列を使うには <code>#include &lt;string&gt;</code> も追加しましょう。");
      }
    } else if (isParse) {
      summary = (line ? line + "行目あたり" : "どこか") + "に、書き方（文法）のミスがあります。";
      if (braceOpen !== braceClose) {
        hints.push("中かっこ <code>{ }</code> の数が合っていません（開き " + braceOpen + " 個 / 閉じ " + braceClose + " 個）。閉じ忘れや余分がないか確認しましょう。");
      } else if (parenOpen !== parenClose) {
        hints.push("丸かっこ <code>( )</code> の数が合っていません（開き " + parenOpen + " 個 / 閉じ " + parenClose + " 個）。");
      } else if (raw.indexOf('";"') !== -1) {
        hints.push("<strong>セミコロン <code>;</code> の付け忘れ</strong>が多いパターンです。<strong>1つ前の行の行末</strong>に <code>;</code> があるか確認しましょう。");
      }
      if (found === '"' || found === "'") {
        hints.push("引用符（<code>\"</code> や <code>'</code>）の<strong>閉じ忘れ</strong>がないか確認しましょう。");
      }
      if (!hints.length) {
        hints.push("記号の不足（<code>;</code> <code>,</code> <code>)</code> <code>}</code> など）や、つづり間違いがないか、その行を見直しましょう。");
      }
    } else {
      summary = "実行中にエラーが発生しました。";
      hints.push("入力の読み取り（<code>cin</code>）や計算の途中に問題がないか、流れをもう一度確認しましょう。");
    }

    var html = '<div class="cj-err-title">⚠ ' + esc(summary) + "</div>";
    if (line) {
      var codeLine = getCodeLine(code, line);
      if (codeLine != null) {
        var prefix = line + " | ";
        var body = prefix + codeLine;
        if (col) body += "\n" + new Array(prefix.length + col).join(" ") + "^";
        html += '<pre class="cj-err-code">' + esc(body) + "</pre>";
      }
    }
    html += '<div class="cj-err-hints">' +
      hints.map(function (h) { return "<div>・" + h + "</div>"; }).join("") + "</div>";
    html += '<details class="cj-err-raw"><summary>技術的なメッセージ（参考）</summary><pre>' +
      esc(raw) + "</pre></details>";

    return { html: html, short: summary + (line ? "（" + line + "行目）" : "") };
  }

  function injectStyle() {
    if (document.getElementById("cj-style")) return;
    var css = [
      ".cj-wrap{margin:1em 0;}",
      ".cj-editor{width:100%;box-sizing:border-box;min-height:260px;font-family:Consolas,'Courier New',monospace;font-size:14px;line-height:1.5;padding:0.7em;border:1px solid #b9c4d6;border-radius:6px;background:#fbfdff;color:#222;tab-size:4;white-space:pre;overflow:auto;}",
      ".cj-toolbar{display:flex;flex-wrap:wrap;gap:0.5em;margin:0.6em 0;}",
      ".cj-btn{font:inherit;padding:0.45em 1.1em;border-radius:6px;border:1px solid #6c8ebf;background:#fff;color:#234;cursor:pointer;}",
      ".cj-btn:hover{background:#eef4ff;}",
      ".cj-btn-primary{background:#4a90d9;border-color:#4a90d9;color:#fff;font-weight:bold;}",
      ".cj-btn-primary:hover{background:#3b7bc4;}",
      ".cj-btn-ghost{border-color:#ccc;color:#777;}",
      ".cj-io{display:flex;flex-wrap:wrap;gap:1em;margin-top:0.4em;}",
      ".cj-io > div{flex:1 1 280px;min-width:0;}",
      ".cj-io label{font-size:0.85em;color:#555;font-weight:bold;display:block;margin-bottom:0.2em;}",
      ".cj-stdin{width:100%;box-sizing:border-box;min-height:90px;font-family:Consolas,monospace;font-size:13px;padding:0.5em;border:1px solid #b9c4d6;border-radius:6px;}",
      ".cj-stdout{min-height:90px;margin:0;background:#1e1e1e;color:#e6e6e6;border-radius:6px;padding:0.6em 0.8em;white-space:pre-wrap;word-break:break-word;border-left:4px solid #4a90d9;}",
      ".cj-msg{margin:0.5em 0;padding:0.5em 0.9em;border-radius:6px;font-size:0.92em;}",
      ".cj-msg-ok{background:#e8f5e9;border-left:4px solid #43a047;color:#1b5e20;}",
      ".cj-msg-err{background:#ffebee;border-left:4px solid #e53935;color:#b71c1c;white-space:pre-wrap;}",
      ".cj-err-title{font-weight:bold;margin-bottom:0.3em;}",
      ".cj-err-code{background:#fff;border:1px solid #f3b7bd;border-left:4px solid #e53935;padding:0.4em 0.6em;margin:0.3em 0;color:#333;white-space:pre;overflow-x:auto;font-size:0.85em;}",
      ".cj-err-hints{margin:0.3em 0;}",
      ".cj-err-hints > div{margin:0.18em 0;}",
      ".cj-err-raw{background:transparent;border:none;padding:0;margin:0.4em 0 0;border-radius:0;}",
      ".cj-err-raw summary{font-size:0.82em;color:#a77;font-weight:normal;}",
      ".cj-err-raw pre{font-size:0.78em;color:#777;background:#fafafa;border-left:3px solid #ddd;margin:0.2em 0 0;}",
      ".cj-summary{margin:0.8em 0 0.4em;padding:0.6em 1em;border-radius:6px;font-weight:bold;}",
      ".cj-summary-ok{background:#e8f5e9;border:2px solid #43a047;color:#1b5e20;}",
      ".cj-summary-ng{background:#fff3e0;border:2px solid #fb8c00;color:#e65100;}",
      ".cj-tests table{border-collapse:collapse;width:100%;font-size:0.86em;margin-top:0.4em;}",
      ".cj-tests th{background:#4a90d9;color:#fff;padding:0.35em 0.6em;text-align:left;}",
      ".cj-tests td{border:1px solid #ccc;padding:0.35em 0.6em;vertical-align:top;font-family:Consolas,monospace;}",
      ".cj-tests td.cj-name{font-family:inherit;}",
      ".cj-pass{color:#1b5e20;font-weight:bold;}",
      ".cj-fail{color:#b71c1c;font-weight:bold;}",
      ".cj-tests tr.cj-row-fail td{background:#fff6f6;}",
      ".cj-nl{color:#9ab;}",
      ".cj-empty{color:#999;font-family:inherit;}",
      ".cj-hint{font-size:0.85em;color:#777;margin-top:0.3em;}",
      ".cj-stats{font-size:0.92em;color:#555;margin:0.1em 0 0.2em;}",
      ".cj-stats strong{color:#2c5f8a;font-size:1.1em;}"
    ].join("\n");
    var st = el("style"); st.id = "cj-style"; st.textContent = css;
    document.head.appendChild(st);
  }

  function tabHandler(e) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    var ta = e.target;
    var s = ta.selectionStart, en = ta.selectionEnd;
    ta.value = ta.value.substring(0, s) + "    " + ta.value.substring(en);
    ta.selectionStart = ta.selectionEnd = s + 4;
  }

  function build() {
    var P = window.PROBLEM || {};
    injectStyle();

    var root = document.getElementById("judge");
    if (!root) { root = el("div"); document.body.appendChild(root); }
    root.innerHTML = "";

    var wrap = el("div", "cj-wrap");

    var editor = el("textarea", "cj-editor");
    editor.value = P.starter || "";
    editor.spellcheck = false;
    editor.addEventListener("keydown", tabHandler);

    var toolbar = el("div", "cj-toolbar");
    var btnCompile = el("button", "cj-btn", "コンパイル（構文チェック）");
    var btnRun = el("button", "cj-btn cj-btn-primary", "▶ 実行（自分の入力で）");
    var btnSubmit = el("button", "cj-btn cj-btn-primary", "✔ 提出（テスト判定）");
    var btnReset = el("button", "cj-btn cj-btn-ghost", "リセット");
    toolbar.append(btnCompile, btnRun, btnSubmit, btnReset);

    var stats = el("div", "cj-stats", "🏆 合格 — 人 ／ 挑戦 — 人");

    var msg = el("div");

    var io = el("div", "cj-io");
    var inWrap = el("div");
    inWrap.append(el("label", null, "標準入力（自分で試す用）"));
    var stdin = el("textarea", "cj-stdin");
    stdin.value = P.sampleInput || "";
    inWrap.append(stdin);
    var outWrap = el("div");
    outWrap.append(el("label", null, "出力"));
    var stdout = el("pre", "cj-stdout");
    outWrap.append(stdout);
    io.append(inWrap, outWrap);

    var hint = el("div", "cj-hint",
      "「実行」は上の入力欄の内容で1回だけ走らせます。「提出」は用意されたテスト全部で期待値と一致するか確認します。");

    var tests = el("div", "cj-tests");

    wrap.append(editor, toolbar, stats, msg, io, hint, tests);
    root.append(wrap);

    subscribeStats(P.id, function (passed, attempted) {
      stats.innerHTML = "🏆 合格 <strong>" + passed + "</strong> 人 ／ 挑戦 <strong>" + attempted + "</strong> 人";
    });

    function setMsg(kind, text) {
      msg.innerHTML = "";
      if (!text) return;
      msg.append(el("div", "cj-msg " + (kind === "ok" ? "cj-msg-ok" : "cj-msg-err"), esc(text)));
    }

    function showError(raw) {
      msg.innerHTML = '<div class="cj-msg cj-msg-err">' + friendlyError(raw, editor.value).html + "</div>";
    }

    btnCompile.onclick = function () {
      tests.innerHTML = "";
      var r = runCode(editor.value, ""); // 入力なしで構文・起動チェック
      if (r.ok) setMsg("ok", "コンパイル成功（構文エラーはありません）。");
      else showError(r.error);
    };

    btnRun.onclick = function () {
      tests.innerHTML = "";
      var r = runCode(editor.value, stdin.value);
      stdout.textContent = r.output || "";
      if (r.ok) setMsg("ok", "実行しました（終了コード " + r.exit + "）。");
      else showError(r.error);
    };

    btnReset.onclick = function () {
      editor.value = P.starter || "";
      setMsg("", "");
      tests.innerHTML = "";
      stdout.textContent = "";
    };

    btnSubmit.onclick = function () {
      setMsg("", "");
      stdout.textContent = "";
      var code = editor.value;
      var list = P.tests || [];
      if (!list.length) { setMsg("err", "テストが定義されていません。"); return; }

      var passed = 0;
      var rowsHtml = "";
      for (var i = 0; i < list.length; i++) {
        var t = list[i];
        var r = runCode(code, t.input);
        var ok = r.ok && normalize(r.output) === normalize(t.expected);
        if (ok) passed++;
        var actualCell = r.ok ? showIO(r.output) : ('<span class="cj-fail">⚠ ' + esc(friendlyError(r.error, code).short) + "</span>");
        rowsHtml +=
          '<tr class="' + (ok ? "" : "cj-row-fail") + '">' +
          '<td class="cj-name">' + esc(t.name || ("テスト" + (i + 1))) + "</td>" +
          "<td>" + showIO(t.input) + "</td>" +
          "<td>" + showIO(t.expected) + "</td>" +
          "<td>" + actualCell + "</td>" +
          '<td class="' + (ok ? "cj-pass" : "cj-fail") + '">' + (ok ? "✔ 合格" : "✘ 不一致") + "</td>" +
          "</tr>";
      }

      var allOk = passed === list.length;
      var summary =
        '<div class="cj-summary ' + (allOk ? "cj-summary-ok" : "cj-summary-ng") + '">' +
        (allOk ? "🎉 全テスト合格！（" : "あと少し！ ") +
        passed + " / " + list.length + (allOk ? " 件）" : " 件 合格") +
        "</div>";
      var table =
        '<table><thead><tr><th>テスト</th><th>入力</th><th>期待する出力</th><th>あなたの出力</th><th>判定</th></tr></thead><tbody>' +
        rowsHtml + "</tbody></table>";
      tests.innerHTML = summary + table;
      recordResult(P.id, allOk);
    };
  }

  function start() { build(); injectResetButton(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
