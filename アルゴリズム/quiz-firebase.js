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
// グラフ描画（Chart.js使用）
// =====================

const chartInstances = {};

function renderChart(qid, totals, correctChoice, container, allChoices) {
  container.innerHTML = "";

  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  const labels = (allChoices && allChoices.length > 0)
    ? allChoices
    : Object.keys(totals);

  if (labels.length === 0) {
    container.innerHTML = '<p style="color:#888;font-size:0.9em;">まだ回答データがありません</p>';
    return;
  }

  const counter = document.createElement("div");
  counter.textContent = `回答 ${total} 件`;
  counter.style.cssText = "font-size:0.75em;color:#aaa;text-align:right;margin-bottom:2px;";
  container.appendChild(counter);

  const canvas = document.createElement("canvas");
  canvas.height = labels.length * 44 + 40;
  canvas.style.width = "100%";
  container.appendChild(canvas);

  const data = labels.map(l => totals[l] || 0);
  const colors = labels.map(l =>
    l === correctChoice ? "rgba(76,175,80,0.8)" : "rgba(100,149,237,0.7)"
  );

  if (chartInstances[qid]) {
    chartInstances[qid].destroy();
  }

  chartInstances[qid] = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: `回答数（過去48時間・計${total}件）`,
        data,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace("0.8","1").replace("0.7","1")),
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: "y",
      responsive: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = total > 0 ? Math.round(ctx.raw / total * 100) : 0;
              return `${ctx.raw}票 (${pct}%)`;
            }
          }
        }
      },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

// =====================
// クイズ初期化（DOMに適用）
// =====================

async function initQuiz(quizEl) {
  const qid = quizEl.dataset.qid;
  const correctChoice = quizEl.dataset.answer;
  const chartContainer = quizEl.nextElementSibling; // .result-chart
  const detailsEl = chartContainer?.nextElementSibling; // details.explanation

  const buttons = quizEl.querySelectorAll("button.choice");
  const allChoices = Array.from(buttons).map(b => b.dataset.choice);

  let chartUnsubscribe = null;

  function startChart() {
    if (chartUnsubscribe) chartUnsubscribe();
    chartUnsubscribe = subscribeResults(qid, (totals) => {
      renderChart(qid, totals, correctChoice, chartContainer, allChoices);
    });
  }

  function enterAnsweredState(myAnswer) {
    applyAnsweredState(buttons, myAnswer, correctChoice);
    startChart();
  }

  function enterUnansweredState() {
    buttons.forEach(btn => {
      btn.disabled = false;
      btn.style.background = "";
      btn.style.color = "";
      btn.style.fontWeight = "";
      btn.style.opacity = "";
    });
    if (chartUnsubscribe) {
      chartUnsubscribe();
      chartUnsubscribe = null;
    }
    chartContainer.innerHTML = "";
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

  if (detailsEl) {
    detailsEl.addEventListener("toggle", () => {
      if (detailsEl.open && !localStorage.getItem(storageKey(qid))) {
        startChart();
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
    const input = window.prompt("キーワードを入力してください：");
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
