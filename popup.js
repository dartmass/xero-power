'use strict';

// ユーザーの64%がChromeOS。⌘ キーは存在しないので Ctrl 表記に切り替える。
// ─────────────────────────────────────────────────────────────
// 質問・要望を受け取る Google Form（「Xero Power — Feedback」）
//   空文字にすると popup のリンクを丸ごと非表示にできる。
// ─────────────────────────────────────────────────────────────
const FEEDBACK_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScAk2akomy6-ZQwWrE6E5c2EtFOEp9uSqvg4_us9wspJJVGAw/viewform';

// /i 必須: userAgentData.platform は "macOS"（小文字m）、navigator.platform は "MacIntel"
const IS_MAC = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform || '');

const DEFAULTS = {
  palette:  IS_MAC ? 'Cmd+K' : 'Ctrl+K',
  match:    'M',
  create:   'C',
  transfer: 'T',
  discuss:  'D',
};

chrome.storage.local.get(['xp_pro', 'xp_shortcuts', 'xp_usage']).then(data => {
  const isPro    = data.xp_pro === true;
  const sc       = Object.assign({}, DEFAULTS, data.xp_shortcuts || {});
  const navTotal = Object.values(data.xp_usage || {}).reduce((a, n) => a + n, 0);
  const minSaved = Math.ceil(navTotal * 0.5);

  // プランバッジ
  document.getElementById('plan-badge').textContent = isPro ? 'Pro ✅' : 'Free';
  document.getElementById('plan-badge').className   = 'badge ' + (isPro ? 'badge-pro' : 'badge-free');

  // ショートカット表示
  document.getElementById('key-palette').textContent  = sc.palette;
  document.getElementById('key-match').textContent    = sc.match;
  document.getElementById('key-create').textContent   = sc.create;
  document.getElementById('key-transfer').textContent = sc.transfer;
  document.getElementById('key-discuss').textContent  = sc.discuss;

  // 使用実績セクション（1回以上使ったら表示）
  if (navTotal > 0) {
    document.getElementById('stat-nav').textContent = navTotal;
    document.getElementById('stat-min').textContent = minSaved;
    document.getElementById('stats-section').style.display = 'block';
  }

  // Pro訴求（Freeユーザーが5回以上使ったら表示）
  if (!isPro && navTotal >= 5) {
    document.getElementById('pro-nudge').style.display = 'block';
  }
});

document.getElementById('settings-btn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('pro-nudge-btn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// フィードバック導線。URL未設定なら導線ごと隠す（死んだリンクを見せない）
if (FEEDBACK_URL) {
  document.getElementById('feedback-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: FEEDBACK_URL });
    window.close();
  });
} else {
  document.getElementById('feedback-section').style.display = 'none';
}
