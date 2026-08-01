'use strict';

// ── 設定: Polar で作成したプロダクトの情報を入れる ──────────────
// TODO: Polar でプロダクト作成後に置き換える
const POLAR_ORG_ID     = '22affaff-7111-4f56-bc19-50507024e7f1';
const POLAR_BENEFIT_ID = '156a2073-e417-4b2e-a56f-de3f4a19c2cb';
// ──────────────────────────────────────────────────────────────

const UPGRADE_URL = 'https://buy.polar.sh/polar_cl_Ol8WEFJ3AKG1X1680jxeq8XPBADxxuONwRp6N0FJfp4';

// ユーザーの64%がChromeOS。⌘ キーは存在しないので Ctrl 表記に切り替える。
// /i 必須: userAgentData.platform は "macOS"（小文字m）、navigator.platform は "MacIntel"
const IS_MAC = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform || '');

const DEFAULTS = {
  palette:  IS_MAC ? '⌘K' : 'Ctrl+K',
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

// ── 組織カラー ────────────────────────────────────────────────
// content.js の OC_PALETTE と揃えること
const ORG_PALETTE = [
  { label: 'Slate',  hex: '#334155' },
  { label: 'Red',    hex: '#b91c1c' },
  { label: 'Orange', hex: '#c2410c' },
  { label: 'Olive',  hex: '#4d7c0f' },
  { label: 'Green',  hex: '#15803d' },
  { label: 'Teal',   hex: '#0f766e' },
  { label: 'Indigo', hex: '#4338ca' },
  { label: 'Plum',   hex: '#a21caf' },
];
const ORG_FREE_LIMIT = 2;   // content.js の OC_FREE_LIMIT と揃えること

let orgColors = {};
let orgIsPro  = false;

function orgColoredIds() {
  return Object.keys(orgColors).filter(id => orgColors[id]?.color);
}

function renderOrgs() {
  const list  = $('org-list');
  const empty = $('org-empty');
  const limit = $('org-limit');
  const ids   = Object.keys(orgColors);

  empty.style.display = ids.length ? 'none' : 'block';
  list.innerHTML = '';

  const colored = orgColoredIds();
  const atLimit = !orgIsPro && colored.length >= ORG_FREE_LIMIT;

  ids.forEach(id => {
    const org = orgColors[id];
    // 無料枠を使い切っていて、かつこの組織がまだ未着色なら選べない
    const locked = atLimit && !org.color;

    const row = document.createElement('div');
    row.className = 'org-row';

    const left = document.createElement('div');
    left.innerHTML =
      `<div class="org-name"></div><div class="org-id"></div>`;
    left.querySelector('.org-name').textContent = org.name || id;
    left.querySelector('.org-id').textContent   = id;

    const sw = document.createElement('div');
    sw.className = 'org-swatches';

    const none = document.createElement('button');
    none.className = 'swatch swatch-none';
    none.textContent = '✕';
    none.title = 'No colour';
    none.setAttribute('aria-pressed', String(!org.color));
    none.addEventListener('click', () => setOrgColor(id, null));
    sw.appendChild(none);

    ORG_PALETTE.forEach(p => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.backgroundColor = p.hex;
      b.title = p.label;
      b.disabled = locked;
      b.setAttribute('aria-pressed', String(org.color === p.hex));
      b.addEventListener('click', () => setOrgColor(id, p.hex));
      sw.appendChild(b);
    });

    row.appendChild(left);
    row.appendChild(sw);
    list.appendChild(row);
  });

  if (atLimit) {
    limit.style.display = 'block';
    limit.innerHTML =
      `Free covers ${ORG_FREE_LIMIT} organisations. ` +
      `<a href="${UPGRADE_URL}" target="_blank">Go Pro</a> to colour all of them.`;
  } else {
    limit.style.display = 'none';
  }
}

function setOrgColor(id, hex) {
  if (!orgColors[id]) return;
  orgColors[id].color = hex;
  chrome.storage.local.set({ xp_org_colors: orgColors }).then(renderOrgs);
}

// Xeroタブで新しい組織を開いたら一覧に反映する
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.xp_org_colors) {
    orgColors = changes.xp_org_colors.newValue || {};
    renderOrgs();
  }
});

// ── オーナー用の解除キー ──────────────────────────────────────
// 実機検証のために、決済を通さず Pro を有効にするためのもの。
//
// ⚠️ これは秘密ではない。拡張機能のコードは誰でも読めるので、この文字列も読める。
//    ただし Pro 判定はもともと chrome.storage の xp_pro を見ているだけで、
//    DevToolsから1行書き込めば誰でも解除できる。つまりこのキーを足しても
//    防御力は変わらない（元から無い）。変えたければここを書き換えるだけ。
const OWNER_KEY = 'XP-OWNER-UNLOCK';

// ── Polar ライセンス検証 ──────────────────────────────────────
// 戻り値: false | 'polar' | 'owner'
async function validateLicense(key) {
  if (key.trim().toUpperCase() === OWNER_KEY) return 'owner';

  // Polar が未設定の場合はスキップ（開発中）
  if (POLAR_ORG_ID === 'YOUR_POLAR_ORG_ID') {
    return key.trim().toUpperCase() === 'DEV-PRO' ? 'owner' : false;
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
    return json.valid === true ? 'polar' : false;
  } catch {
    return false;
  }
}

// ── UI: Pro / Free 状態を反映 ─────────────────────────────────
// isOwner=true のときはチップに (owner) を出す。
// 検証中の画面を宣材に使ったとき、本物のProと見分けがつかないと困るため。
function applyProState(isPro, isOwner) {
  planChip.textContent = isPro ? (isOwner ? 'Pro (owner) ✅' : 'Pro ✅') : 'Free';
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

  // トラッキング必須化は Pro 限定
  const tk = $('toggle-require-tracking');
  if (tk) {
    tk.disabled = !isPro;
    tk.closest('.toggle-row').style.opacity = isPro ? '1' : '.55';
  }
  const tkLock = $('tracking-pro-lock');
  if (tkLock) tkLock.style.display = isPro ? 'none' : 'inline';

  // Pro の切り替えで組織カラーの無料枠表示も変わる
  orgIsPro = isPro;
  renderOrgs();
}

// ── UI: ショートカット値をフィールドに反映 ────────────────────
function loadShortcuts(sc) {
  SC_FIELDS.forEach(id => {
    $('sc-' + id).value = sc[id] ?? DEFAULTS[id];
  });
}

// ── 初期化 ────────────────────────────────────────────────────
chrome.storage.local.get([
  'xp_pro', 'xp_license', 'xp_shortcuts',
  'xp_invoice_approve_default', 'xp_bill_approve_view_next',
  'xp_org_colors', 'xp_dark_mode', 'xp_require_tracking', 'xp_pro_owner',
]).then(data => {
  const isPro = data.xp_pro === true;
  const sc    = Object.assign({}, DEFAULTS, data.xp_shortcuts || {});

  orgColors = data.xp_org_colors || {};
  orgIsPro  = isPro;
  renderOrgs();

  if (data.xp_license) licenseInput.value = data.xp_license;
  applyProState(isPro, data.xp_pro_owner === true);
  loadShortcuts(sc);
  upgradeLink.href = UPGRADE_URL;

  // プレースホルダもプラットフォームに合わせる（ChromeOS/Windows は Ctrl+K）
  SC_FIELDS.forEach(id => { $('sc-' + id).placeholder = DEFAULTS[id]; });

  // Behaviour トグル（無料・既定ON）
  $('toggle-invoice-approve').checked = data.xp_invoice_approve_default !== false;
  $('toggle-bill-approve').checked    = data.xp_bill_approve_view_next !== false;

  // ダークモード（無料・既定OFF）
  $('toggle-dark-mode').checked = data.xp_dark_mode === true;

  // トラッキング必須化（Pro・既定OFF）
  $('toggle-require-tracking').checked = data.xp_require_tracking === true;
});

// ── Behaviour トグル保存（無料機能・即反映） ──────────────────
$('toggle-invoice-approve').addEventListener('change', (e) => {
  chrome.storage.local.set({ xp_invoice_approve_default: e.target.checked });
});
$('toggle-bill-approve').addEventListener('change', (e) => {
  chrome.storage.local.set({ xp_bill_approve_view_next: e.target.checked });
});
$('toggle-dark-mode').addEventListener('change', (e) => {
  chrome.storage.local.set({ xp_dark_mode: e.target.checked });
});
$('toggle-require-tracking').addEventListener('change', (e) => {
  chrome.storage.local.set({ xp_require_tracking: e.target.checked });
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
    const owner = valid === 'owner';
    licenseStatus.className   = 'license-status status-ok';
    licenseStatus.textContent = owner
      ? '✓ Pro unlocked locally (owner key). Reload any Xero tab to apply.'
      : '✓ Pro activated! Reload any Xero tab to apply.';
    chrome.storage.local.set({ xp_pro: true, xp_license: key, xp_pro_owner: owner });
    applyProState(true, owner);
  } else {
    licenseStatus.className   = 'license-status status-err';
    licenseStatus.textContent = '✗ Invalid license key. Check your purchase email.';
  }
});

// ── ライセンス削除 ────────────────────────────────────────────
deactivateBtn.addEventListener('click', () => {
  chrome.storage.local.remove(['xp_pro', 'xp_license', 'xp_pro_owner']);
  licenseInput.value = '';
  licenseStatus.style.display = 'block';
  licenseStatus.className   = 'license-status status-ok';
  licenseStatus.textContent = 'License removed. Reverted to Free.';
  applyProState(false, false);
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
