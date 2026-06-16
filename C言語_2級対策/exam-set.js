// exam-set.js
// 過去問の小問セットを「全問選択 → 採点する → 一括○×」し、
// 正解数(スコア)ごとの人数分布ヒストグラムと回答者数を Firebase でリアルタイム表示する。
//
// HTML 側の書き方：
//   <div class="exam-set" data-set-id="c2-01-q3">
//     <div class="es-q" data-no="(15)" data-answer="ウ"></div>
//     <div class="es-q" data-no="(16)" data-answer="オ"></div>
//     ...
//   </div>
// data-choices="アイウエ" のように渡せば選択肢を変えられる（既定はア〜オ）。
//
// Firebase データ構造： examStats/{setId}/{uid} = 正解数(整数)
//   回答者数 = 子要素の数 ／ 分布 = 値(正解数)ごとの集計。匿名認証＋auth!=null でカバー（ルール変更不要）。

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, off, set } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCaZLloa4UuZGriB2hL18O-QkiAbc6Vq_Y",
  authDomain: "aoki-lecture-materials-quiz.firebaseapp.com",
  databaseURL: "https://aoki-lecture-materials-quiz-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "aoki-lecture-materials-quiz",
  storageBucket: "aoki-lecture-materials-quiz.firebasestorage.app",
  messagingSenderId: "468181696021",
  appId: "1:468181696021:web:fc32bc79516f5fc062181c"
};

// quiz-firebase.js が既定アプリ（[DEFAULT]）を使うため、こちらは名前付きアプリで初期化して重複initを避ける
const app = initializeApp(firebaseConfig, "examset");
const db = getDatabase(app);
const auth = getAuth(app);
const authReady = signInAnonymously(auth)
  .then(() => true)
  .catch((e) => { console.warn("[exam] 匿名サインインに失敗:", (e && (e.message || e.code)) || e); return false; });

const CHOICES_DEFAULT = ["ア", "イ", "ウ", "エ", "オ"];

// 匿名ユーザーID（このブラウザ＝1人として集計するため localStorage に保持）
function uid() {
  let id = localStorage.getItem("examUserId");
  if (!id) {
    id = "u" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem("examUserId", id);
  }
  return id;
}

function lsKey(setId) { return "examSet:" + setId; }
function loadLocal(setId) { try { return JSON.parse(localStorage.getItem(lsKey(setId))) || {}; } catch { return {}; } }
function saveLocal(setId, obj) { try { localStorage.setItem(lsKey(setId), JSON.stringify(obj)); } catch {} }

// Firebase 操作
async function submitScore(setId, score) {
  try {
    await authReady;
    await set(ref(db, `examStats/${setId}/${uid()}`), score);
  } catch (e) {
    console.warn("[exam] スコア記録に失敗:", (e && (e.message || e.code)) || e);
  }
}
function subscribe(setId, cb) {
  const r = ref(db, `examStats/${setId}`);
  let listener = null, cancelled = false;
  authReady.then(() => {
    if (cancelled) return;
    listener = onValue(r, (snap) => {
      const map = {};
      if (snap.exists()) snap.forEach((c) => { map[c.key] = c.val(); });
      cb(map);
    }, (err) => console.warn("[exam] 購読に失敗:", (err && err.message) || err));
  });
  return () => { cancelled = true; if (listener) off(r, "value", listener); };
}

// スタイル（各HTMLのCSSは変更せず、JSから注入）
let styleInjected = false;
function ensureStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const s = document.createElement("style");
  s.textContent = [
    ".exam-set{margin:1.1em 0 0.5em;padding:0.9em 1.1em;background:#fff;border:1px solid #d0dce8;border-radius:8px;}",
    ".es-instr{margin:0 0 0.8em;font-size:0.92em;color:#456;}",
    ".es-q{display:flex;align-items:center;flex-wrap:wrap;gap:0.5em;margin:0.5em 0;}",
    ".es-no{font-family:Consolas,monospace;font-weight:bold;color:#2a6ab0;min-width:3em;}",
    ".es-choices{display:inline-flex;gap:0.3em;flex-wrap:wrap;}",
    ".es-choice{width:2.2em;height:2.2em;border:1px solid #bbb;border-radius:5px;background:#fafafa;color:#444;font-family:inherit;font-size:0.95em;cursor:pointer;transition:background 0.12s;}",
    ".es-choice:hover:not(:disabled){background:#eef3fb;}",
    ".es-choice.sel{background:#4a90d9;color:#fff;border-color:#4a90d9;}",
    ".es-choice.correct{background:#4caf50;color:#fff;border-color:#4caf50;}",
    ".es-choice.wrong{background:#ef5350;color:#fff;border-color:#ef5350;}",
    ".es-graded .es-choice{cursor:default;}",
    ".es-mark{font-weight:bold;font-size:1.2em;min-width:1em;}",
    ".es-mark.ok{color:#4caf50;}",
    ".es-mark.ng{color:#ef5350;}",
    ".es-grade{margin-top:0.8em;padding:0.45em 1.3em;border:1px solid #4a90d9;background:#4a90d9;color:#fff;border-radius:6px;cursor:pointer;font-size:0.95em;font-family:inherit;}",
    ".es-grade:hover{background:#3f7fc4;}",
    ".es-score{margin-top:0.7em;font-size:1em;}",
    ".es-score.done{color:#2a6ab0;}",
    ".es-score.warn{color:#c0392b;}",
    ".es-dist{margin-top:0.9em;}",
    ".es-dist-title{font-size:0.8em;color:#888;margin-bottom:0.4em;}",
    ".es-bars{display:flex;align-items:flex-end;gap:0.5em;height:100px;padding-top:4px;}",
    ".es-bar-col{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;}",
    ".es-bar-num{font-size:0.72em;color:#777;height:1.1em;line-height:1;}",
    ".es-bar{width:26px;background:#6495ed;border-radius:3px 3px 0 0;min-height:2px;transition:height 0.4s ease;}",
    ".es-bar.mine{background:#ff9800;}",
    ".es-bar-x{font-size:0.78em;color:#555;margin-top:3px;font-family:Consolas,monospace;}",
  ].join("\n");
  document.head.appendChild(s);
}

function buildSet(setEl) {
  ensureStyle();
  const setId = setEl.dataset.setId;
  const qEls = Array.from(setEl.querySelectorAll(".es-q"));
  const N = qEls.length;
  if (N === 0) return;

  const selected = {};               // no -> choice
  const saved = loadLocal(setId);

  // 説明文（先頭に挿入）
  const instr = document.createElement("p");
  instr.className = "es-instr";
  instr.textContent = `プログラムの出力 ${qEls.map((q) => q.dataset.no).join("・")} を解答群から選び、「採点する」を押そう。`;
  setEl.insertBefore(instr, setEl.firstChild);

  // 各小問の選択肢ボタンを生成
  qEls.forEach((q) => {
    const no = q.dataset.no;
    const choices = q.dataset.choices ? Array.from(q.dataset.choices) : CHOICES_DEFAULT;

    const noSpan = document.createElement("span");
    noSpan.className = "es-no";
    noSpan.textContent = no;
    q.appendChild(noSpan);

    const wrap = document.createElement("span");
    wrap.className = "es-choices";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "es-choice";
      b.textContent = c;
      b.dataset.choice = c;
      b.addEventListener("click", () => {
        if (setEl.classList.contains("es-graded")) return; // 採点後はロック
        selected[no] = c;
        wrap.querySelectorAll(".es-choice").forEach((x) => x.classList.toggle("sel", x.dataset.choice === c));
      });
      wrap.appendChild(b);
    });
    q.appendChild(wrap);

    const mark = document.createElement("span");
    mark.className = "es-mark";
    q.appendChild(mark);

    // 前回の選択を復元
    if (saved.sel && saved.sel[no]) {
      selected[no] = saved.sel[no];
      wrap.querySelectorAll(".es-choice").forEach((x) => x.classList.toggle("sel", x.dataset.choice === saved.sel[no]));
    }
  });

  // 採点ボタン・結果・分布領域
  const gradeBtn = document.createElement("button");
  gradeBtn.type = "button";
  gradeBtn.className = "es-grade";
  gradeBtn.textContent = "採点する";
  const scoreEl = document.createElement("div");
  scoreEl.className = "es-score";
  const distEl = document.createElement("div");
  distEl.className = "es-dist";
  setEl.appendChild(gradeBtn);
  setEl.appendChild(scoreEl);
  setEl.appendChild(distEl);

  let unsub = null;

  function renderDist(map) {
    const total = Object.keys(map).length;
    const counts = new Array(N + 1).fill(0);
    Object.values(map).forEach((v) => {
      const s = Math.max(0, Math.min(N, v | 0));
      counts[s]++;
    });
    const max = Math.max(1, ...counts);
    const myScore = setEl.dataset.myScore !== undefined ? parseInt(setEl.dataset.myScore, 10) : -1;
    let bars = "";
    for (let s = 0; s <= N; s++) {
      const h = Math.round((counts[s] / max) * 80);
      const mine = s === myScore ? " mine" : "";
      bars += `<div class="es-bar-col"><div class="es-bar-num">${counts[s] || ""}</div><div class="es-bar${mine}" style="height:${h}px"></div><div class="es-bar-x">${s}</div></div>`;
    }
    distEl.innerHTML =
      `<div class="es-dist-title">回答者 ${total} 人 ・ 正解数の分布（横軸＝正解数／橙＝あなた）</div>` +
      `<div class="es-bars">${bars}</div>`;
  }

  function startSub() {
    if (unsub) unsub();
    unsub = subscribe(setId, renderDist);
  }

  function grade() {
    const missing = qEls.filter((q) => !selected[q.dataset.no]);
    if (missing.length) {
      scoreEl.className = "es-score warn";
      scoreEl.textContent = `未回答が ${missing.length} 問あります（${missing.map((q) => q.dataset.no).join("・")}）。`;
      return;
    }
    let correct = 0;
    qEls.forEach((q) => {
      const no = q.dataset.no, ans = q.dataset.answer, sel = selected[no];
      const ok = sel === ans;
      if (ok) correct++;
      const mark = q.querySelector(".es-mark");
      mark.textContent = ok ? "○" : "×";
      mark.className = "es-mark " + (ok ? "ok" : "ng");
      q.querySelectorAll(".es-choice").forEach((x) => {
        x.classList.remove("correct", "wrong");
        if (x.dataset.choice === ans) x.classList.add("correct");        // 正解を緑で明示
        else if (x.dataset.choice === sel) x.classList.add("wrong");      // 自分の誤答を赤
      });
    });
    setEl.classList.add("es-graded");
    setEl.dataset.myScore = String(correct);
    scoreEl.className = "es-score done";
    scoreEl.innerHTML = `あなたの結果：<strong>${correct} / ${N} 問正解</strong>`;
    gradeBtn.textContent = "選び直す（再採点）";
    saveLocal(setId, { sel: selected, graded: true, score: correct });
    submitScore(setId, correct);
    startSub();
  }

  function reGrade() {
    setEl.classList.remove("es-graded");
    delete setEl.dataset.myScore;
    qEls.forEach((q) => {
      const m = q.querySelector(".es-mark");
      m.textContent = "";
      m.className = "es-mark";
      q.querySelectorAll(".es-choice").forEach((x) => x.classList.remove("correct", "wrong"));
    });
    scoreEl.textContent = "";
    scoreEl.className = "es-score";
    gradeBtn.textContent = "採点する";
    // 分布は出したままにして、選び直し→再採点で更新
  }

  gradeBtn.addEventListener("click", () => {
    if (setEl.classList.contains("es-graded")) reGrade();
    else grade();
  });

  // 前回採点済みなら、復元した選択で結果＋分布を再表示
  if (saved.graded && saved.sel && qEls.every((q) => saved.sel[q.dataset.no])) {
    grade();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".exam-set[data-set-id]").forEach(buildSet);
});
