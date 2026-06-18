'use strict';

const DEFAULTS = { palette: '⌘K', match: 'M', create: 'C', transfer: 'T', discuss: 'D' };

chrome.storage.local.get(['xp_pro', 'xp_shortcuts']).then(data => {
  const isPro = data.xp_pro === true;
  const sc = Object.assign({}, DEFAULTS, data.xp_shortcuts || {});

  document.getElementById('plan-badge').textContent = isPro ? 'Pro ✅' : 'Free';
  document.getElementById('plan-badge').className = 'badge ' + (isPro ? 'badge-pro' : 'badge-free');

  document.getElementById('key-palette').textContent  = sc.palette;
  document.getElementById('key-match').textContent    = sc.match;
  document.getElementById('key-create').textContent   = sc.create;
  document.getElementById('key-transfer').textContent = sc.transfer;
  document.getElementById('key-discuss').textContent  = sc.discuss;
});

document.getElementById('settings-btn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
