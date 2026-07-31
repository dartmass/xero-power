'use strict';

// ─────────────────────────────────────────────────────────────
// 設定：Google Form の URL を作ったらここに入れる
//   空文字のままなら該当機能は無効（何も起きない）
// ─────────────────────────────────────────────────────────────

// アンインストール時に開く1問アンケート（Google Form「Xero Power — Uninstall survey」）
const UNINSTALL_SURVEY_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScL5d5JVa3Ua7fETAWnsXZvd5HF_MBTf7Krf9N7t5UAWpTWPw/viewform';

// フォームの「Version (auto-filled)」質問の entry ID。
// どのバージョンからアンインストールされたかが自動で埋まる。
const UNINSTALL_SURVEY_VERSION_FIELD = 'entry.16036521';

// ─────────────────────────────────────────────────────────────

// 初回インストール時のみ welcome ページを開く（アップデート時は開かない）
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
});

// アンインストール時にアンケートを開く。
// ユーザーはタブを閉じれば回答しなくてよい（送信は本人の操作のみ）。
if (UNINSTALL_SURVEY_URL) {
  let url = UNINSTALL_SURVEY_URL;

  if (UNINSTALL_SURVEY_VERSION_FIELD) {
    const params = new URLSearchParams({ usp: 'pp_url' });
    params.set(UNINSTALL_SURVEY_VERSION_FIELD, chrome.runtime.getManifest().version);
    url += (url.includes('?') ? '&' : '?') + params.toString();
  }

  chrome.runtime.setUninstallURL(url);
}
