// quiz-firebase.js
// 全HTMLファイルで共通利用するFirebase連携クイズ機能

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, increment, update, onValue, off, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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

/** 回答済みかどうか */
function isAnswered(qid) {
  return !!localStorage.getItem(storageKey(qid));
}

/** 回答済みとして記録 */
function markAnswered(qid, choice) {
  localStorage.setItem(storageKey(qid), choice);
}

/** 自分が選んだ選択肢を取得 */
function getMyAnswer(qid) {
  return localStorage.getItem(storageKey(qid));
}

// =====================
// Firebase 操作
// =====================

/** 回答をFirebaseに書き込む（バケット単位でインクリメント） */
async function submitAnswer(qid, choice) {
  const bucket = currentBucket();
  const path = `answers/${qid}/${bucket}/${choice}`;
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
  const minBucket = last48Buckets()[47]; // 48時間前のバケット
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

  // 購読解除関数を返す（不要になったときに呼ぶ）
  return () => off(qRef, "value", listener);
}

// =====================
// グラフ描画（Chart.js使用）
// =====================

/** Chart.js インスタンスを管理（再描画時の破棄用） */
const chartInstances = {};

/**
 * 結果グラフを描画する
 * @param {string} qid - 問題ID
 * @param {Object} totals - { "ア": 12, "イ": 5, ... }
 * @param {string} correctChoice - 正解の選択肢
 * @param {HTMLElement} container - グラフ描画先のdiv
 */
function renderChart(qid, totals, correctChoice, container, allChoices) {
  container.innerHTML = ""; // リセット

  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  const labels = (allChoices && allChoices.length > 0)
    ? allChoices
    : Object.keys(totals);

  if (labels.length === 0) {
    container.innerHTML = '<p style="color:#888;font-size:0.9em;">まだ回答データがありません</p>';
    return;
  }

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

/**
 * .quiz 要素を初期化する
 * data-qid: 問題ID（例: "01-1"）
 * data-answer: 正解選択肢（例: "イ"）
 */
async function initQuiz(quizEl) {
  const qid = quizEl.dataset.qid;
  const correctChoice = quizEl.dataset.answer;
  const chartContainer = quizEl.nextElementSibling; // .result-chart
  const detailsEl = chartContainer?.nextElementSibling; // details.explanation

  const buttons = quizEl.querySelectorAll("button.choice");
  const allChoices = Array.from(buttons).map(b => b.dataset.choice);
  const answered = isAnswered(qid);
  const myAnswer = getMyAnswer(qid);

  // グラフ表示をリアルタイム購読で開始する内部関数
  function startChart() {
    subscribeResults(qid, (totals) => {
      renderChart(qid, totals, correctChoice, chartContainer, allChoices);
    });
  }

  // 回答済みの場合：ボタン無効化 → すぐグラフ購読開始
  if (answered) {
    applyAnsweredState(buttons, myAnswer, correctChoice);
    startChart();
    return;
  }

  // 未回答：ボタンクリックで回答 → グラフ購読開始
  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const choice = btn.dataset.choice;
      markAnswered(qid, choice);
      await submitAnswer(qid, choice);
      applyAnsweredState(buttons, choice, correctChoice);
      startChart();
    });
  });

  // 「解説を開く」でも回答なしグラフ表示（未回答のまま開いた場合）
  if (detailsEl) {
    detailsEl.addEventListener("toggle", () => {
      if (detailsEl.open && !isAnswered(qid)) {
        startChart();
      }
    });
  }
}

/** ボタンに回答済みスタイルを適用 */
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
 * 現在のページの全クイズデータをFirebaseから削除する
 */
async function resetPageQuizzes() {
  const quizEls = document.querySelectorAll(".quiz-choices[data-qid]");
  const deletePromises = [];
  quizEls.forEach(el => {
    const qid = el.dataset.qid;
    deletePromises.push(remove(ref(db, `answers/${qid}`)));
  });
  await Promise.all(deletePromises);
}

/**
 * リセットボタンをページ最下部に注入する
 */
function injectResetButton() {
  const btn = document.createElement("button");
  btn.textContent = "管理者：データリセット";
  btn.style.cssText = [
    "position:fixed",
    "bottom:14px",
    "right:14px",
    "background:rgba(180,180,180,0.35)",
    "color:#888",
    "border:1px solid #bbb",
    "border-radius:6px",
    "padding:0.3em 0.8em",
    "font-size:0.78em",
    "cursor:pointer",
    "z-index:9999",
    "backdrop-filter:blur(4px)",
  ].join(";");

  btn.addEventListener("click", async () => {
    const input = window.prompt("キーワードを入力してください：");
    if (input === null) return;           // キャンセル
    if (input !== "ignas") {
      alert("キーワードが違います。");
      return;
    }
    btn.textContent = "削除中...";
    btn.disabled = true;
    try {
      await resetPageQuizzes();
      // localStorageの回答履歴もクリア
      Object.keys(localStorage)
        .filter(k => k.startsWith("quiz_answered_"))
        .forEach(k => localStorage.removeItem(k));
      alert("このページの回答データをリセットしました。\nページを再読み込みします。");
      location.reload();
    } catch (e) {
      alert("削除中にエラーが発生しました：" + e.message);
      btn.textContent = "管理者：データリセット";
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

  // クイズがあるページにだけリセットボタンを表示
  if (document.querySelector(".quiz-choices[data-qid]")) {
    injectResetButton();
  }
});

export { initQuiz, submitAnswer, subscribeResults };
