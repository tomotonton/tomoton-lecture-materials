/* =========================================================================
   sangi-judge.js  —  サンギハッカソン対策 練習問題の共通ジャッジ
   ・各問題ページの window.PROBLEM を読み、エディタ＋実行＋採点UIを描画する
   ・コンパイル/実行は Wandbox API（実コンパイラ）をブラウザから直接呼び出す
     （Wandbox は CORS 許可済みのためバックエンド不要）
   ・C / C++ / Java の3言語に対応
   ・全テスト合格で「クリア」＝ 👑（localStorage + 親フレームへ postMessage）
   ========================================================================= */
(function () {
  "use strict";

  var WANDBOX = "https://wandbox.org/api/compile.json";
  var DEFAULT_COMPILER = {
    c: "gcc-13.2.0-c",
    cpp: "gcc-13.2.0",
    java: "openjdk-jdk-22+36"
  };
  var LANG_LABEL = { c: "C", cpp: "C++", java: "Java" };
  var LANG_ORDER = ["c", "cpp", "java"];

  var P = window.PROBLEM || {};
  var PID = P.id || "sangi-unknown";

  // ---- 出力比較（空白区切りの単語単位・浮動小数点は誤差許容）----
  function normalize(s) {
    s = String(s == null ? "" : s).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var lines = s.split("\n");
    for (var i = 0; i < lines.length; i++) lines[i] = lines[i].replace(/\s+$/, "");
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    return lines.join("\n");
  }
  function tokensEqual(a, b) {
    var ta = normalize(a).split(/\s+/).filter(Boolean);
    var tb = normalize(b).split(/\s+/).filter(Boolean);
    if (ta.length !== tb.length) return false;
    for (var i = 0; i < ta.length; i++) {
      if (ta[i] === tb[i]) continue;
      var fa = parseFloat(ta[i]), fb = parseFloat(tb[i]);
      if (isNaN(fa) || isNaN(fb)) return false;
      if (Math.abs(fa - fb) > 1e-6 * Math.max(1, Math.abs(fa), Math.abs(fb))) return false;
    }
    return true;
  }

  // ---- Java は public を外す（Wandbox は prog.java 保存のため）----
  function prepCode(lang, code) {
    if (lang === "java") {
      return code.replace(/\bpublic\s+class\s+Main\b/, "class Main");
    }
    return code;
  }

  // ---- Wandbox 呼び出し（一時的な混雑エラーは自動リトライ）----
  function _delay(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  function _wandboxOnce(lang, code, stdin) {
    var compiler = (P.langs && P.langs[lang] && P.langs[lang].compiler) || DEFAULT_COMPILER[lang];
    var body = JSON.stringify({
      compiler: compiler,
      code: prepCode(lang, code),
      stdin: stdin || "",
      save: false
    });
    return fetch(WANDBOX, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  // Wandbox 側のコンテナ資源枯渇など、コード由来でない一時エラーか？
  function _infraTrouble(j) {
    var m = (j.compiler_message || "") + "\n" + (j.program_message || "") + "\n" + (j.compiler_error || "");
    return /resource temporarily unavailable|OCI runtime|too many requests|service unavailable|\b50[234]\b/i.test(m);
  }

  function _parse(j) {
    var compileMsg = (j.compiler_message || j.compiler_error || "").trim();
    var output = (j.program_output != null) ? j.program_output : "";
    // コンパイルエラー＝コンパイラ出力に error があり、かつ実行出力が空のとき
    var looksCompileError = /(^|\n)[^\n]*error[: ]/i.test(compileMsg) && normalize(output) === "";
    return {
      rawStatus: j.status,
      compileError: looksCompileError ? compileMsg : "",
      compileMsg: compileMsg,
      output: output,
      runError: (j.program_error || "").trim(),
      signal: j.signal || ""
    };
  }

  var WANDBOX_MAX_TRIES = 5;            // 一時的な混雑エラー時の最大試行回数
  function _backoff(n) {                // n回目失敗後の待ち時間(ms)：指数バックオフ＋ゆらぎ
    return Math.min(5000, 600 * Math.pow(2, n)) + Math.floor(Math.random() * 400);
  }

  function wandboxRun(lang, code, stdin, onStatus) {
    function attempt(n) {
      return _wandboxOnce(lang, code, stdin).then(function (j) {
        if (_infraTrouble(j)) {
          if (n + 1 < WANDBOX_MAX_TRIES) {
            if (onStatus) onStatus(n + 1, WANDBOX_MAX_TRIES);
            return _delay(_backoff(n)).then(function () { return attempt(n + 1); });
          }
          var e = new Error("ジャッジサーバ（Wandbox）が混雑しています");
          e.infra = true;             // ← コード由来でない（サーバ混雑）ことを示す印
          throw e;
        }
        return _parse(j);
      }, function (err) {
        if (n + 1 < WANDBOX_MAX_TRIES) {
          if (onStatus) onStatus(n + 1, WANDBOX_MAX_TRIES);
          return _delay(_backoff(n)).then(function () { return attempt(n + 1); });
        }
        throw new Error("ジャッジサーバに接続できませんでした（" + (err && err.message ? err.message : err) + "）");
      });
    }
    return attempt(0);
  }

  // ---- localStorage helpers ----
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function normPath(p) {
    try { p = decodeURIComponent(p); } catch (e) {}
    p = String(p);
    if (p.slice(0, 2) === "./") p = p.slice(2);
    if (p.charAt(0) === "/") p = p.slice(1);
    if (p.length >= 5 && p.slice(-5).toLowerCase() === ".html") p = p.slice(0, -5);
    return p;
  }
  var CLEAR_KEY = "sangiClear:" + normPath(location.pathname);
  function codeKey(lang) { return "sangiCode:" + PID + ":" + lang; }

  function isCleared() { return lsGet(CLEAR_KEY) === "1"; }
  function setCleared(on) {
    if (on) lsSet(CLEAR_KEY, "1"); else lsDel(CLEAR_KEY);
    try { parent.postMessage({ type: on ? "sangiCleared" : "sangiUncleared", path: location.pathname }, "*"); } catch (e) {}
    reflectCrown();
  }

  // =========================================================================
  // Firebase：クリア人数（言語別）／回答者数 の集計
  //   sangiStats/<id>/attempted/<uid> = true       … 提出した人（回答者）
  //   sangiStats/<id>/cleared/<lang>/<uid> = true   … その言語でクリアした人
  // 既存ルール auth != null でカバー（新パスの追加設定は不要）。
  // =========================================================================
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
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js"),
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js")
    ]).then(function (mods) {
      var app = mods[0].initializeApp(FB_CONFIG);
      var db = mods[1].getDatabase(app);
      var authMod = mods[2];
      return authMod.signInAnonymously(authMod.getAuth(app))
        .catch(function (e) { console.warn("[sangiStats] 匿名サインインに失敗:", (e && (e.message || e.code)) || e); })
        .then(function () {
          _fb = { db: db, ref: mods[1].ref, onValue: mods[1].onValue, update: mods[1].update };
          return _fb;
        });
    }).catch(function () { return null; });
  }
  function getUid() {
    var v = lsGet("practiceUid");
    if (!v) {
      v = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      lsSet("practiceUid", v);
    }
    return v;
  }
  function recordSubmit(passed) {
    if (!PID) return;
    ensureFirebase().then(function (f) {
      if (!f) return;
      var uid = getUid(), updates = {};
      updates["sangiStats/" + PID + "/attempted/" + uid] = true;
      if (passed) updates["sangiStats/" + PID + "/cleared/" + curLang + "/" + uid] = true;
      f.update(f.ref(f.db), updates).catch(function (e) {
        console.warn("[sangiStats] 記録の保存に失敗:", (e && (e.message || e.code)) || e);
      });
    });
  }
  function subscribeStats() {
    if (!PID) return;
    ensureFirebase().then(function (f) {
      if (!f) return;
      f.onValue(f.ref(f.db, "sangiStats/" + PID), function (snap) {
        var v = snap.val() || {};
        var attempted = v.attempted ? Object.keys(v.attempted).length : 0;
        var cl = v.cleared || {};
        function cnt(lang) { return cl[lang] ? Object.keys(cl[lang]).length : 0; }
        var union = {};
        ["c", "cpp", "java"].forEach(function (lang) {
          if (cl[lang]) Object.keys(cl[lang]).forEach(function (u) { union[u] = true; });
        });
        renderStats(Object.keys(union).length, cnt("c"), cnt("cpp"), cnt("java"), attempted);
      }, function (e) {
        console.warn("[sangiStats] 集計の購読に失敗:", (e && (e.message || e.code)) || e);
      });
    });
  }
  function renderStats(total, c, cpp, java, attempted) {
    if (!el.stats) return;
    el.stats.innerHTML =
      '<span class="sj-stats-crown">👑 クリア</span> <b>' + total + '</b> 人' +
      ' <span class="sj-stats-lang">（C ' + c + ' ・ C++ ' + cpp + ' ・ Java ' + java + '）</span>' +
      ' ／ 挑戦 <b>' + attempted + '</b> 人';
  }

  // =========================================================================
  // UI 構築
  // =========================================================================
  var el = {};
  var curLang = P.defaultLang && P.langs && P.langs[P.defaultLang] ? P.defaultLang : null;

  function availableLangs() {
    return LANG_ORDER.filter(function (l) { return P.langs && P.langs[l]; });
  }

  function injectStyles() {
    if (document.getElementById("sangi-judge-style")) return;
    var css =
      "#judge{margin:1em 0}" +
      ".sj-tabs{display:flex;gap:.3em;flex-wrap:wrap;margin-bottom:.5em}" +
      ".sj-tab{font:inherit;cursor:pointer;border:1px solid #c9d6e5;background:#eef3f9;color:#3a5a7a;border-radius:8px 8px 0 0;padding:.35em 1em;font-weight:700}" +
      ".sj-tab.active{background:#1a4f8a;color:#fff;border-color:#1a4f8a}" +
      ".sj-editorWrap{display:flex;border:1px solid #c9d6e5;border-radius:0 8px 8px 8px;overflow:hidden;background:#1e1e1e}" +
      ".sj-gutter{flex:0 0 auto;padding:.7em .4em .7em .7em;text-align:right;color:#7d8ca3;background:#252526;font-family:Consolas,monospace;font-size:13px;line-height:1.5;user-select:none;overflow:hidden;white-space:pre}" +
      ".sj-editor{flex:1;min-width:0;border:0;outline:0;resize:none;min-height:160px;box-sizing:border-box;padding:.7em;color:#e6e6e6;background:#1e1e1e;font-family:Consolas,monospace;font-size:13px;line-height:1.5;tab-size:4;white-space:pre;overflow:hidden}" +
      ".sj-bar{display:flex;gap:.6em;align-items:center;flex-wrap:wrap;margin:.6em 0}" +
      ".sj-btn{font:inherit;cursor:pointer;border:0;border-radius:8px;padding:.5em 1.1em;font-weight:700}" +
      ".sj-run{background:#e8f0fb;color:#1a4f8a;border:1px solid #b8cce8}" +
      ".sj-submit{background:#1a8a4f;color:#fff}" +
      ".sj-reset{background:#fff;color:#a23;border:1px solid #e0b4b4}" +
      ".sj-btn:disabled{opacity:.5;cursor:default}" +
      ".sj-status{color:#666;font-size:.9em}" +
      ".sj-io{display:grid;grid-template-columns:1fr;gap:.5em;margin:.5em 0}" +
      ".sj-io label{font-size:.85em;color:#555;font-weight:700}" +
      ".sj-io textarea{width:100%;box-sizing:border-box;height:70px;font-family:Consolas,monospace;font-size:13px;padding:.4em;border:1px solid #ccc;border-radius:6px;white-space:pre;overflow:auto}" +
      ".sj-out{white-space:pre-wrap;background:#f6f8fa;border:1px solid #ddd;border-radius:6px;padding:.6em .8em;font-family:Consolas,monospace;font-size:13px;min-height:1.5em;overflow:auto}" +
      ".sj-err{background:#fff3f3;border-color:#f0caca;color:#922}" +
      ".sj-results{margin:.6em 0}" +
      ".sj-case{display:flex;gap:.5em;align-items:flex-start;padding:.45em .7em;border:1px solid #e3e3e3;border-radius:6px;margin:.35em 0;background:#fff}" +
      ".sj-case.ok{border-color:#bfe3c8;background:#f3fbf5}" +
      ".sj-case.ng{border-color:#f0caca;background:#fdf4f4}" +
      ".sj-case.run{border-color:#cdddee;background:#f5f9fd}" +
      ".sj-mark{font-size:1.1em;flex:0 0 auto;width:1.4em;text-align:center}" +
      ".sj-cdetail{flex:1;min-width:0;font-size:.9em}" +
      ".sj-cdetail pre{margin:.2em 0;background:#fff;border:1px solid #eee;border-radius:4px;padding:.3em .5em;overflow:auto;max-height:9em}" +
      ".sj-cname{font-weight:700;color:#333}" +
      ".sj-summary{font-weight:700;padding:.5em .8em;border-radius:8px;margin:.5em 0}" +
      ".sj-summary.pass{background:#e7f7ec;color:#1a7a3f;border:1px solid #b6e3c4}" +
      ".sj-summary.fail{background:#fdeeee;color:#a33;border:1px solid #f0caca}" +
      ".sj-crown{display:none;font-size:1.4em;vertical-align:middle}" +
      "body.sangi-cleared .sj-crown{display:inline}" +
      ".sj-cleared-banner{display:none;background:linear-gradient(90deg,#fff7e0,#fffdf5);border:2px solid #f0a500;border-radius:10px;padding:.7em 1em;margin:.6em 0;color:#9a6a00;font-weight:700}" +
      "body.sangi-cleared .sj-cleared-banner{display:block}" +
      ".sj-models summary{cursor:pointer;font-weight:700;color:#1a4f8a;padding:.4em 0}" +
      ".sj-models pre{background:#f6f8fa;border:1px solid #e3e3e3;border-radius:6px;padding:.6em .8em;overflow:auto;font-family:Consolas,monospace;font-size:13px}" +
      ".sj-note{color:#888;font-size:.85em;margin:.3em 0}" +
      ".sj-stats{margin:.2em 0 .6em;font-size:.95em;color:#555;background:#f7faff;border:1px solid #e2ecf7;border-radius:8px;padding:.45em .85em}" +
      ".sj-stats:empty{display:none}" +
      ".sj-stats b{color:#1a4f8a;font-size:1.08em}" +
      ".sj-stats-crown{color:#c08a00;font-weight:700}" +
      ".sj-stats-lang{color:#6a7a8a;font-size:.9em}" +
      "@media(min-width:680px){.sj-io{grid-template-columns:1fr 1fr}}";
    var st = document.createElement("style");
    st.id = "sangi-judge-style";
    st.textContent = css;
    document.head.appendChild(st);
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function build() {
    var host = document.getElementById("judge");
    if (!host) { console.error("[sangi-judge] #judge が見つかりません"); return; }
    var langs = availableLangs();
    if (!curLang) curLang = langs[0];

    var tabs = '<div class="sj-tabs">' + langs.map(function (l) {
      return '<button class="sj-tab" data-lang="' + l + '">' + LANG_LABEL[l] + "</button>";
    }).join("") + "</div>";

    host.innerHTML =
      '<div class="sj-cleared-banner">👑 この問題はクリア済みです！おめでとう！</div>' +
      '<div class="sj-stats" id="sjStats"></div>' +
      tabs +
      '<div class="sj-editorWrap"><div class="sj-gutter" id="sjGutter">1</div>' +
      '<textarea class="sj-editor" id="sjEditor" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea></div>' +
      '<p class="sj-note">※ 初期コードは「入力を1つ読んで、そのまま出力する」だけのオウム返しです。問題に合わせて、入出力の組み立てから自分で書き換えましょう（入出力をどう作るかも練習のうちです）。</p>' +
      '<div class="sj-bar">' +
        '<button class="sj-btn sj-run" id="sjRun">コンパイル・実行</button>' +
        '<button class="sj-btn sj-submit" id="sjSubmit">提出（全テスト採点）</button>' +
        '<button class="sj-btn sj-reset" id="sjReset">最初のコードに戻す</button>' +
        '<span class="sj-status" id="sjStatus"></span>' +
      "</div>" +
      '<div class="sj-io">' +
        '<div><label>標準入力（コンパイル・実行で使う）</label><textarea id="sjStdin" spellcheck="false"></textarea></div>' +
        '<div><label>実行結果（標準出力）</label><div class="sj-out" id="sjStdout"></div></div>' +
      "</div>" +
      '<div class="sj-results" id="sjResults"></div>' +
      '<div class="sj-models" id="sjModels"></div>';

    el.editor = document.getElementById("sjEditor");
    el.stats = document.getElementById("sjStats");
    el.gutter = document.getElementById("sjGutter");
    el.stdin = document.getElementById("sjStdin");
    el.stdout = document.getElementById("sjStdout");
    el.status = document.getElementById("sjStatus");
    el.results = document.getElementById("sjResults");
    el.models = document.getElementById("sjModels");
    el.run = document.getElementById("sjRun");
    el.submit = document.getElementById("sjSubmit");
    el.reset = document.getElementById("sjReset");

    // タブ
    host.querySelectorAll(".sj-tab").forEach(function (b) {
      b.addEventListener("click", function () { switchLang(b.getAttribute("data-lang")); });
    });
    // エディタ
    el.editor.addEventListener("input", function () { saveDraft(); syncGutter(); });
    el.editor.addEventListener("keydown", function (e) {
      if (e.key === "Tab") {
        e.preventDefault();
        var s = el.editor.selectionStart, en = el.editor.selectionEnd, v = el.editor.value;
        el.editor.value = v.slice(0, s) + "    " + v.slice(en);
        el.editor.selectionStart = el.editor.selectionEnd = s + 4;
        saveDraft(); syncGutter();
      }
    });
    el.stdin.value = (P.sampleInput || "");
    el.run.addEventListener("click", onRun);
    el.submit.addEventListener("click", onSubmit);
    el.reset.addEventListener("click", onReset);

    renderModels();
    switchLang(curLang, true);
    reflectCrown();
    subscribeStats();
  }

  function renderModels() {
    var langs = availableLangs();
    var parts = ['<p class="sj-note">行き詰まったら…（クリックで模範解答を表示。まずは自分で挑戦してみよう）</p>'];
    langs.forEach(function (l) {
      var m = P.langs[l] && P.langs[l].model;
      if (!m) return;
      parts.push("<details><summary>" + LANG_LABEL[l] + " の模範解答</summary><pre>" + esc(m) + "</pre></details>");
    });
    el.models.innerHTML = parts.join("");
  }

  function switchLang(lang, force) {
    if (!P.langs[lang]) return;
    if (lang === curLang && !force) return;
    curLang = lang;
    document.querySelectorAll(".sj-tab").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-lang") === lang);
    });
    var draft = lsGet(codeKey(lang));
    el.editor.value = (draft != null) ? draft : (P.langs[lang].starter || "");
    syncGutter();
    clearResults();
  }

  function saveDraft() { lsSet(codeKey(curLang), el.editor.value); }

  function syncGutter() {
    var n = el.editor.value.split("\n").length;
    var s = "";
    for (var i = 1; i <= n; i++) s += i + (i < n ? "\n" : "");
    el.gutter.textContent = s;
    // 内容に合わせてエディタを縦に自動拡張（内部スクロールバーを出さず全行を表示）
    el.editor.style.height = "auto";
    el.editor.style.height = el.editor.scrollHeight + "px";
  }

  function clearResults() { el.results.innerHTML = ""; el.stdout.textContent = ""; el.stdout.classList.remove("sj-err"); }

  function setBusy(b, msg) {
    el.run.disabled = b; el.submit.disabled = b; el.reset.disabled = b;
    el.status.textContent = msg || "";
  }

  function onReset() {
    if (!confirm("書いたコードを消して、最初のコードに戻します。よろしいですか？")) return;
    lsDel(codeKey(curLang));
    el.editor.value = P.langs[curLang].starter || "";
    syncGutter(); saveDraft(); clearResults();
  }

  function onRun() {
    var code = el.editor.value;
    clearResults();
    setBusy(true, "コンパイル・実行中…（実コンパイラで処理しています）");
    wandboxRun(curLang, code, el.stdin.value, function (n, max) {
      setBusy(true, "混雑のため再試行中… (" + n + "/" + max + ")");
    }).then(function (r) {
      if (r.compileError) {
        el.stdout.classList.add("sj-err");
        el.stdout.textContent = "コンパイルエラー:\n" + r.compileError;
      } else {
        el.stdout.classList.remove("sj-err");
        el.stdout.textContent = r.output + (r.runError ? "\n[stderr]\n" + r.runError : "") || "(出力なし)";
      }
      setBusy(false, "");
    }).catch(function (e) {
      el.stdout.classList.add("sj-err");
      if (e && e.infra) {
        el.stdout.textContent = "🟡 ジャッジサーバ（Wandbox）が混雑しています。\nあなたのコードの問題ではありません。少し待ってから、もう一度「コンパイル・実行」を押してください。";
      } else {
        el.stdout.textContent = "実行できませんでした: " + (e && e.message ? e.message : e) + "\n（ネット接続を確認してください）";
      }
      setBusy(false, "");
    });
  }

  function onSubmit() {
    var code = el.editor.value;
    var tests = P.tests || [];
    if (!tests.length) { alert("テストが定義されていません"); return; }
    clearResults();
    setBusy(true, "採点中… 0/" + tests.length);
    el.results.innerHTML = "";

    var idx = 0, passed = 0, failedFirst = null;

    function rowFor(t, state, detailHtml) {
      var mark = state === "run" ? "⏳" : state === "ok" ? "✅" : "❌";
      var div = document.createElement("div");
      div.className = "sj-case " + state;
      div.innerHTML = '<div class="sj-mark">' + mark + "</div><div class=\"sj-cdetail\"><span class=\"sj-cname\">" +
        esc(t.name || ("テスト" + (idx + 1))) + "</span>" + (detailHtml || "") + "</div>";
      return div;
    }

    function next() {
      if (idx >= tests.length) return finish();
      var t = tests[idx];
      var row = rowFor(t, "run", "");
      el.results.appendChild(row);
      el.status.textContent = "採点中… " + idx + "/" + tests.length;
      wandboxRun(curLang, code, t.input, function (n, max) {
        el.status.textContent = "採点中… " + idx + "/" + tests.length + "（混雑のため再試行 " + n + "/" + max + "）";
      }).then(function (r) {
        var ok = !r.compileError && tokensEqual(r.output, t.expected);
        var detail;
        if (r.compileError) {
          detail = '<pre>コンパイルエラー:\n' + esc(r.compileError) + "</pre>";
        } else if (ok) {
          detail = "";
        } else {
          detail = '<div>入力:</div><pre>' + esc(t.input) + "</pre>" +
                   '<div>期待した出力:</div><pre>' + esc(normalize(t.expected)) + "</pre>" +
                   '<div>あなたの出力:</div><pre>' + esc(normalize(r.output)) + (r.runError ? "\n[stderr] " + esc(r.runError) : "") + "</pre>";
        }
        el.results.replaceChild(rowFor(t, ok ? "ok" : "ng", detail), row);
        if (ok) passed++; else if (failedFirst === null) failedFirst = idx;
        idx++;
        next();
      }).catch(function (e) {
        if (e && e.infra) {                       // サーバ混雑：採点を中断（コードのせいではない）
          if (row && row.parentNode) row.parentNode.removeChild(row);
          setBusy(false, "");
          var b = document.createElement("div");
          b.className = "sj-summary fail";
          b.textContent = "🟡 ジャッジサーバ（Wandbox）が混雑して採点を完了できませんでした。あなたのコードの問題ではありません。少し待ってから、もう一度「提出（全テスト採点）」を押してください。";
          el.results.appendChild(b);
          return;
        }
        el.results.replaceChild(rowFor(t, "ng", '<pre>' + esc("実行できませんでした: " + (e && e.message ? e.message : e)) + "</pre>"), row);
        if (failedFirst === null) failedFirst = idx;
        idx++;
        next();
      });
    }

    function finish() {
      setBusy(false, "");
      var allPass = passed === tests.length;
      var sum = document.createElement("div");
      sum.className = "sj-summary " + (allPass ? "pass" : "fail");
      sum.textContent = allPass
        ? "🎉 全 " + tests.length + " ケース合格！クリアです！"
        : "結果: " + passed + " / " + tests.length + " ケース合格（もう一息！）";
      el.results.appendChild(sum);
      if (allPass) setCleared(true);
      recordSubmit(allPass);   // 回答者数＋（合格なら言語別クリア人数）を記録
    }

    next();
  }

  // ---- 王冠表示 ----
  function reflectCrown() {
    document.body.classList.toggle("sangi-cleared", isCleared());
    document.querySelectorAll("[data-sangi-crown]").forEach(function (n) {
      n.style.display = isCleared() ? "inline" : "none";
    });
  }

  // 起動
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { injectStyles(); build(); });
  } else {
    injectStyles(); build();
  }
})();
