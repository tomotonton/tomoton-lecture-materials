// quiz-firebase.js
// 全HTMLファイルで共通利用するFirebase連携クイズ機能

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, increment, update, onValue, off, remove, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// =====================
// Firebase 初期化
// =====================
const firebaseConfig = {
  apiKey: "AIzaSyCaZLloa4UuZGriB2hL18O-QkiAbc6Vq_Y",
  authDomain: "aoki-lecture-materials-quiz.firebaseapp.com",
  databaseURL: "https://aoki-lecture-materials-quiz-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "aoki-lecture-materials-quiz",
  storageBucket: "aoki-lecture-materials-quiz.firebasestorage.app",
  messagingSenderId: "468181696021",
  appId: "1:468181696021:web:fc32bc79516f5fc062181c"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// =====================
// 設定
// =====================

/** 回答済み状態の有効期間（ミリ秒）。これを過ぎると自動的に未回答状態に戻る */
const ANSWER_TTL_MS = 24 * 60 * 60 * 1000; // 24時間

/** TTL 自動チェックの間隔（ミリ秒） */
const TTL_CHECK_INTERVAL_MS = 60 * 1000; // 1分

// =====================
// ユーティリティ
// =====================

/** 現在の時間バケット（YYYYMMDDHH） */
function currentBucket() {
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}`;
}

/** 過去48時間分のバケット一覧を返す */
function last48Buckets() {
  const buckets = [];
  const now = new Date();
  for (let i = 0; i < 48; i++) {
    const t = new Date(now.getTime() - i * 3600 * 1000);
    const pad = n => String(n).padStart(2, "0");
    buckets.push(`${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}${pad(t.getHours())}`);
  }
  return buckets;
}

/** localStorage キー */
function storageKey(qid) {
  return `quiz_answered_${qid}`;
}

/** 回答済みとして記録（タイムスタンプ付き） */
function markAnswered(qid, choice) {
  localStorage.setItem(storageKey(qid), JSON.stringify({ choice, ts: Date.now() }));
}

/** 自分が選んだ選択肢を取得 */
function getMyAnswer(qid) {
  const raw = localStorage.getItem(storageKey(qid));
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    return obj.choice || raw; // 旧形式（文字列）にも対応
  } catch {
    return raw;
  }
}

/** 自分の回答タイムスタンプを取得（ミリ秒） */
function getAnswerTs(qid) {
  const raw = localStorage.getItem(storageKey(qid));
  if (!raw) return 0;
  try {
    return JSON.parse(raw).ts || 0;
  } catch {
    return 0; // 旧形式は0（常にリセット後とみなす）
  }
}

// =====================
// Firebase 操作
// =====================

/** 回答をFirebaseに書き込む（バケット単位でインクリメント） */
async function submitAnswer(qid, choice) {
  const bucket = currentBucket();
  await update(ref(db, `answers/${qid}/${bucket}`), {
    [choice]: increment(1)
  });
}

/**
 * 過去48時間の回答集計をリアルタイム購読する
 * データが変わるたびに callback(totals) が呼ばれる
 * 返り値：購読解除関数
 */
function subscribeResults(qid, callback) {
  const minBucket = last48Buckets()[47];
  const qRef = ref(db, `answers/${qid}`);

  const listener = onValue(qRef, (snapshot) => {
    const totals = {};
    if (snapshot.exists()) {
      snapshot.forEach(bucketSnap => {
        if (bucketSnap.key >= minBucket) {
          bucketSnap.forEach(choiceSnap => {
            const choice = choiceSnap.key;
            totals[choice] = (totals[choice] || 0) + (choiceSnap.val() || 0);
          });
        }
      });
    }
    callback(totals);
  });

  return () => off(qRef, "value", listener);
}

// =====================
// 回答分布バー（選択肢の右に横棒・Chart.js不使用）
// =====================

function renderBars(totals, correctChoice, myAnswer, barEls, totalEl) {
  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  Object.keys(barEls).forEach(choice => {
    const votes = totals[choice] || 0;
    const pct = total > 0 ? Math.round(votes / total * 100) : 0;
    const { fill, label } = barEls[choice];
    let color;
    if (choice === correctChoice) color = "#4caf50";             // 正解=緑
    else if (myAnswer && choice === myAnswer) color = "#ef5350"; // 自分の誤答=赤
    else color = "#6495ed";                                      // その他=青
    fill.style.width = pct + "%";
    fill.style.background = color;
    label.textContent = `${votes}票 ${pct}%`;
  });
  if (totalEl) {
    totalEl.textContent = total > 0
      ? `回答 ${total} 件（過去48時間）`
      : "まだ回答データがありません";
  }
}

// =====================
// バーのスタイル注入（各HTMLのCSSは変更せず、JSから差し込む）
// =====================

let layoutStyleInjected = false;
function ensureLayoutStyle() {
  if (layoutStyleInjected) return;
  layoutStyleInjected = true;
  const style = document.createElement("style");
  style.textContent = [
    ".choice-row{display:flex;align-items:center;gap:0.6em;}",
    ".choice-row>button.choice{flex:1 1 auto;}",
    ".quiz-choices.show-results .choice-row>button.choice{flex:0 1 auto;max-width:62%;}",
    ".choice-bar{display:none;flex:1 1 auto;min-width:0;align-items:center;gap:0.5em;}",
    ".quiz-choices.show-results .choice-bar{display:flex;}",
    ".choice-bar-track{flex:1 1 auto;height:1.5em;background:#eef0f4;border-radius:4px;overflow:hidden;min-width:36px;}",
    ".choice-bar-fill{height:100%;width:0;border-radius:4px;transition:width 0.5s ease;}",
    ".choice-bar-label{flex:0 0 auto;font-size:0.85em;color:#555;white-space:nowrap;min-width:4.8em;text-align:right;}",
    ".quiz-result-total{font-size:0.8em;color:#999;text-align:right;margin:0.3em 0 0;}",
    "@media (max-width:520px){.quiz-choices.show-results .choice-row>button.choice{max-width:54%;}.choice-bar-label{min-width:4.2em;font-size:0.8em;}}",
  ].join("\n");
  document.head.appendChild(style);
}

// =====================
// クイズ初期化（DOMに適用）
// =====================

async function initQuiz(quizEl) {
  const qid = quizEl.dataset.qid;
  const correctChoice = quizEl.dataset.answer;
  const resultContainer = quizEl.nextElementSibling;        // .result-chart（合計件数表示に流用）
  const detailsEl = resultContainer?.nextElementSibling;    // details（解説）

  const buttons = Array.from(quizEl.querySelectorAll("button.choice"));

  ensureLayoutStyle();

  // 各選択肢を「ボタン＋右の横棒」の行に組み替え、棒要素を用意する
  const barEls = {};
  buttons.forEach(btn => {
    const choice = btn.dataset.choice;
    const row = document.createElement("div");
    row.className = "choice-row";
    quizEl.insertBefore(row, btn);
    row.appendChild(btn);

    const bar = document.createElement("div");
    bar.className = "choice-bar";
    const track = document.createElement("div");
    track.className = "choice-bar-track";
    const fill = document.createElement("div");
    fill.className = "choice-bar-fill";
    track.appendChild(fill);
    const label = document.createElement("div");
    label.className = "choice-bar-label";
    bar.appendChild(track);
    bar.appendChild(label);
    row.appendChild(bar);

    barEls[choice] = { fill, label };
  });

  // 合計件数の表示先（.result-chart を流用）
  let totalEl = null;
  if (resultContainer && resultContainer.classList && resultContainer.classList.contains("result-chart")) {
    resultContainer.innerHTML = "";
    totalEl = document.createElement("div");
    totalEl.className = "quiz-result-total";
    resultContainer.appendChild(totalEl);
  }

  let resultsUnsub = null;
  let currentMyAnswer = getMyAnswer(qid);

  function startResults() {
    quizEl.classList.add("show-results");
    if (resultsUnsub) resultsUnsub();
    resultsUnsub = subscribeResults(qid, (totals) => {
      renderBars(totals, correctChoice, currentMyAnswer, barEls, totalEl);
    });
  }

  function stopResults() {
    if (resultsUnsub) { resultsUnsub(); resultsUnsub = null; }
    quizEl.classList.remove("show-results");
    Object.values(barEls).forEach(({ fill, label }) => {
      fill.style.width = "0%";
      label.textContent = "";
    });
    if (totalEl) totalEl.textContent = "";
  }

  function enterAnsweredState(myAnswer) {
    currentMyAnswer = myAnswer;
    applyAnsweredState(buttons, myAnswer, correctChoice);
    startResults();
  }

  function enterUnansweredState() {
    buttons.forEach(btn => {
      btn.disabled = false;
      btn.style.background = "";
      btn.style.color = "";
      btn.style.fontWeight = "";
      btn.style.opacity = "";
    });
    stopResults();
  }

  function setupClickHandlers() {
    buttons.forEach(btn => {
      btn.onclick = async () => {
        const choice = btn.dataset.choice;
        markAnswered(qid, choice);
        await submitAnswer(qid, choice);
        enterAnsweredState(choice);
      };
    });
  }

  // ★ TTL チェック：回答から ANSWER_TTL_MS（=24時間）経過していたら未回答に戻す
  //    旧形式（タイムスタンプなし、ts=0）も期限切れとみなす
  function isAnswerExpired() {
    if (!localStorage.getItem(storageKey(qid))) return false;
    const ts = getAnswerTs(qid);
    if (ts === 0) return true;
    return (Date.now() - ts) >= ANSWER_TTL_MS;
  }
  if (isAnswerExpired()) {
    localStorage.removeItem(storageKey(qid));
  }

  // ★ 初期チェック：Firebase の resetAt と自分の回答 ts を比較
  let knownResetAt = 0;
  try {
    const resetSnap = await get(ref(db, `meta/${qid}/resetAt`));
    if (resetSnap.exists()) {
      knownResetAt = resetSnap.val();
      if (knownResetAt > getAnswerTs(qid)) {
        localStorage.removeItem(storageKey(qid));
      }
    }
  } catch (e) {
    // Firebase 読み取りエラーは無視して続行
  }

  // 初期UI状態
  const myAnswer = getMyAnswer(qid);
  if (myAnswer) {
    enterAnsweredState(myAnswer);
  } else {
    setupClickHandlers();
  }

  // ★ ページを開いたままでも TTL を過ぎたら自動で未回答に戻す
  setInterval(() => {
    if (isAnswerExpired() && getMyAnswer(qid)) {
      localStorage.removeItem(storageKey(qid));
      enterUnansweredState();
      setupClickHandlers();
    }
  }, TTL_CHECK_INTERVAL_MS);

  // ★ リセットをリアルタイム監視（ページを開いたまま先生がリセットしても即座に反映）
  onValue(ref(db, `meta/${qid}/resetAt`), (snap) => {
    if (!snap.exists()) return;
    const resetAt = snap.val();
    if (resetAt > knownResetAt) {
      knownResetAt = resetAt;
      localStorage.removeItem(storageKey(qid));
      enterUnansweredState();
      setupClickHandlers();
    }
  });

  // 解説（details）を開いたら、未回答でも分布バーを覗ける
  if (detailsEl && detailsEl.tagName === "DETAILS") {
    detailsEl.addEventListener("toggle", () => {
      if (detailsEl.open && !localStorage.getItem(storageKey(qid))) {
        currentMyAnswer = null;
        startResults();
      }
    });
  }
}

function applyAnsweredState(buttons, myAnswer, correctChoice) {
  buttons.forEach(btn => {
    btn.disabled = true;
    const choice = btn.dataset.choice;
    if (choice === correctChoice) {
      btn.style.background = "#4caf50";
      btn.style.color = "#fff";
      btn.style.fontWeight = "bold";
    } else if (choice === myAnswer && choice !== correctChoice) {
      btn.style.background = "#ef5350";
      btn.style.color = "#fff";
    } else {
      btn.style.opacity = "0.5";
    }
  });
}

// =====================
// リセット機能
// =====================

/**
 * 現在のページの全クイズデータをFirebaseから削除し、
 * meta/{qid}/resetAt にリセット時刻を書き込む。
 * 学生のブラウザは次回ページ読み込み時に自動的に未回答状態に戻る。
 */
async function resetPageQuizzes() {
  const quizEls = document.querySelectorAll(".quiz-choices[data-qid]");
  const now = Date.now();
  const promises = [];
  quizEls.forEach(el => {
    const qid = el.dataset.qid;
    // 回答データを削除
    promises.push(remove(ref(db, `answers/${qid}`)));
    // リセット時刻を記録（学生側が参照する）
    promises.push(update(ref(db, `meta/${qid}`), { resetAt: now }));
  });
  await Promise.all(promises);
}

/**
 * パスワード形式（伏字）でキーワード入力を受け付けるカスタムダイアログ。
 * プロジェクター投影時に入力中の文字が見えないようにするため、
 * window.prompt の代わりにこれを使う。
 * @returns {Promise<string|null>} 入力値（キャンセル時は null）
 */
function passwordPrompt(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = [
      "position:fixed", "inset:0",
      "background:rgba(0,0,0,0.45)",
      "z-index:99999",
      "display:flex", "align-items:center", "justify-content:center",
      "font-family:sans-serif",
    ].join(";");

    const dialog = document.createElement("div");
    dialog.style.cssText = [
      "background:#fff",
      "padding:1.4em 1.4em 1.1em",
      "border-radius:8px",
      "min-width:280px",
      "max-width:90vw",
      "box-shadow:0 6px 28px rgba(0,0,0,0.35)",
    ].join(";");

    const msg = document.createElement("div");
    msg.textContent = message;
    msg.style.cssText = "margin-bottom:0.7em;font-size:0.95em;color:#333;";

    const input = document.createElement("input");
    input.type = "password";
    input.autocomplete = "off";
    input.style.cssText = "width:100%;padding:0.5em 0.6em;font-size:1em;border:1px solid #aaa;border-radius:4px;box-sizing:border-box;";

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "margin-top:1em;display:flex;gap:0.5em;justify-content:flex-end;";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "キャンセル";
    cancelBtn.style.cssText = "padding:0.4em 1em;cursor:pointer;border:1px solid #aaa;background:#f5f5f5;border-radius:4px;";

    const okBtn = document.createElement("button");
    okBtn.textContent = "OK";
    okBtn.style.cssText = "padding:0.4em 1em;cursor:pointer;background:#4a90d9;color:#fff;border:1px solid #4a90d9;border-radius:4px;";

    btnRow.append(cancelBtn, okBtn);
    dialog.append(msg, input, btnRow);
    overlay.append(dialog);
    document.body.append(overlay);

    setTimeout(() => input.focus(), 0);

    const cleanup = () => overlay.remove();
    const onOk = () => { const v = input.value; cleanup(); resolve(v); };
    const onCancel = () => { cleanup(); resolve(null); };

    okBtn.onclick = onOk;
    cancelBtn.onclick = onCancel;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) onCancel(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") onOk();
      else if (e.key === "Escape") onCancel();
    });
  });
}

function injectResetButton() {
  const btn = document.createElement("button");
  btn.textContent = "⚙";
  btn.style.cssText = [
    "position:fixed",
    "bottom:6px",
    "right:6px",
    "background:transparent",
    "color:rgba(160,160,160,0.18)",
    "border:1px solid rgba(160,160,160,0.1)",
    "border-radius:2px",
    "padding:0 2px",
    "font-size:9px",
    "line-height:1.4",
    "cursor:pointer",
    "z-index:9999",
    "user-select:none",
  ].join(";");

  btn.addEventListener("click", async () => {
    const input = await passwordPrompt("キーワードを入力してください：");
    if (input === null) return;
    if (input !== "ignas") {
      alert("キーワードが違います。");
      return;
    }
    btn.textContent = "削除中...";
    btn.disabled = true;
    try {
      await resetPageQuizzes();
      // 自分のlocalStorageもクリア
      Object.keys(localStorage)
        .filter(k => k.startsWith("quiz_answered_"))
        .forEach(k => localStorage.removeItem(k));
      alert("リセット完了。学生は次回ページ読み込み時に再回答できます。\nページを再読み込みします。");
      location.reload();
    } catch (e) {
      alert("削除中にエラーが発生しました：" + e.message);
      btn.textContent = "⚙";
      btn.disabled = false;
    }
  });

  document.body.appendChild(btn);
}

// =====================
// エントリポイント
// =====================
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".quiz-choices[data-qid]").forEach(initQuiz);

  if (document.querySelector(".quiz-choices[data-qid]")) {
    injectResetButton();
  }
});

export { initQuiz, submitAnswer, subscribeResults };
