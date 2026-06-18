'use strict';

// ── 設定: Polar で作成したプロダクトの情報を入れる ──────────────
// TODO: Polar でプロダクト作成後に置き換える
const POLAR_ORG_ID     = 'YOUR_POLAR_ORG_ID';
const POLAR_BENEFIT_ID = 'YOUR_POLAR_BENEFIT_ID';
// ──────────────────────────────────────────────────────────────

const UPGRADE_URL = 'https://polar.sh/dartmass/xero-power'; // TODO: Polar設定後に変更

const DEFAULTS = {
  palette:  '⌘K',
  match:    'M',
  create:   'C',
  transfer: 'T',
  discuss:  'D',
};

// ── DOM refs ──────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const planChip      = $('plan-chip');
const upsellBox     = $('upsell-box');
const upgradeLink   = $('upgrade-link');
const licenseInput  = $('license-input');
const activateBtn   = $('activate-btn');
const deactivateBtn = $('deactivate-btn');
const licenseStatus = $('license-status');
const proLockLabel  = $('pro-lock-label');
const saveBtn       = $('save-btn');
const resetBtn      = $('reset-btn');
const saveMsg       = $('save-msg');

const SC_FIELDS = ['palette', 'match', 'create', 'transfer', 'discuss'];

// ── Polar ライセンス検証 ──────────────────────────────────────
async function validateLicense(key) {
  // Polar が未設定の場合はスキップ（開発中）
  if (POLAR_ORG_ID === 'YOUR_POLAR_ORG_ID') {
    // 開発用: "DEV-PRO" で Pro 解放
    return key.trim().toUpperCase() === 'DEV-PRO';
  }
  try {
    const res = await fetch('https://api.polar.sh/v1/licenses/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key:             key.trim(),
        organization_id: POLAR_ORG_ID,
        benefit_id:      POLAR_BENEFIT_ID,
      }),
    });
    const json = await res.json();
    return json.valid === true;
  } catch {
    return false;
  }
}

// ── UI: Pro / Free 状態を反映 ─────────────────────────────────
function applyProState(isPro) {
  planChip.textContent = isPro ? 'Pro ✅' : 'Free';
  planChip.className   = 'plan-chip ' + (isPro ? 'chip-pro' : 'chip-free');
  upsellBox.style.display    = isPro ? 'none' : 'block';
  deactivateBtn.style.display = isPro ? 'inline-block' : 'none';
  activateBtn.style.display   = isPro ? 'none' : 'inline-block';
  proLockLabel.style.display  = isPro ? 'none' : 'inline';

  SC_FIELDS.forEach(id => {
    const el = $('sc-' + id);
    el.disabled = !isPro;
  });
  saveBtn.disabled  = !isPro;
  resetBtn.disabled = !isPro;
}

// ── UI: ショートカット値をフィールドに反映 ────────────────────
function loadShortcuts(sc) {
  SC_FIELDS.forEach(id => {
    $('sc-' + id).value = sc[id] ?? DEFAULTS[id];
  });
}

// ── 初期化 ────────────────────────────────────────────────────
chrome.storage.local.get(['xp_pro', 'xp_license', 'xp_shortcuts']).then(data => {
  const isPro = data.xp_pro === true;
  const sc    = Object.assign({}, DEFAULTS, data.xp_shortcuts || {});

  if (data.xp_license) licenseInput.value = data.xp_license;
  applyProState(isPro);
  loadShortcuts(sc);
  upgradeLink.href = UPGRADE_URL;
});

// ── ライセンス認証 ────────────────────────────────────────────
activateBtn.addEventListener('click', async () => {
  const key = licenseInput.value.trim();
  if (!key) return;

  activateBtn.textContent = 'Checking…';
  activateBtn.disabled = true;

  const valid = await validateLicense(key);

  activateBtn.textContent = 'Activate';
  activateBtn.disabled = false;

  licenseStatus.style.display = 'block';
  if (valid) {
    licenseStatus.className   = 'license-status status-ok';
    licenseStatus.textContent = '✓ Pro activated! Reload any Xero tab to apply.';
    chrome.storage.local.set({ xp_pro: true, xp_license: key });
    applyProState(true);
  } else {
    licenseStatus.className   = 'license-status status-err';
    licenseStatus.textContent = '✗ Invalid license key. Check your purchase email.';
  }
});

// ── ライセンス削除 ────────────────────────────────────────────
deactivateBtn.addEventListener('click', () => {
  chrome.storage.local.remove(['xp_pro', 'xp_license']);
  licenseInput.value = '';
  licenseStatus.style.display = 'block';
  licenseStatus.className   = 'license-status status-ok';
  licenseStatus.textContent = 'License removed. Reverted to Free.';
  applyProState(false);
  loadShortcuts(DEFAULTS);
});

// ── ショートカット保存 ────────────────────────────────────────
saveBtn.addEventListener('click', () => {
  const sc = {};
  SC_FIELDS.forEach(id => {
    sc[id] = $('sc-' + id).value.trim() || DEFAULTS[id];
  });
  chrome.storage.local.set({ xp_shortcuts: sc }).then(() => {
    saveMsg.style.display = 'inline';
    setTimeout(() => { saveMsg.style.display = 'none'; }, 2000);
  });
});

// ── デフォルトに戻す ──────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  loadShortcuts(DEFAULTS);
  chrome.storage.local.remove('xp_shortcuts').then(() => {
    saveMsg.style.display = 'inline';
    saveMsg.textContent = '✓ Reset to defaults!';
    setTimeout(() => {
      saveMsg.style.display = 'none';
      saveMsg.textContent = '✓ Saved!';
    }, 2000);
  });
});
