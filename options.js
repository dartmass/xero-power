'use strict';

// ── Polar products / license benefits ────────────────────────
const POLAR_ORG_ID = '22affaff-7111-4f56-bc19-50507024e7f1';
const POLAR_SOLO_BENEFIT_ID = '1401e133-bcdb-441b-8ba9-934092119908';
const POLAR_PRACTICE_BENEFIT_ID = '156a2073-e417-4b2e-a56f-de3f4a19c2cb';
const SOLO_UPGRADE_URL = 'https://buy.polar.sh/polar_cl_kYqcTHHDml2sTsOPSLD4WA5p0m5qGgOuh0yY00UIctO';
// ──────────────────────────────────────────────────────────────

const PRACTICE_UPGRADE_URL = 'https://buy.polar.sh/polar_cl_Ol8WEFJ3AKG1X1680jxeq8XPBADxxuONwRp6N0FJfp4';
const CUSTOMER_PORTAL_URL = 'https://polar.sh/xero-power/portal';

// ユーザーの64%がChromeOS。⌘ キーは存在しないので Ctrl 表記に切り替える。
// /i 必須: userAgentData.platform は "macOS"（小文字m）、navigator.platform は "MacIntel"
const IS_MAC = false; // 🎬 撮影用の一時変更。撮影後に元へ戻すこと
// const IS_MAC = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform || '');

const MOD_LABEL = IS_MAC ? 'Cmd+' : 'Ctrl+';

const DEFAULTS = {
  palette:  MOD_LABEL + 'K',
  match:    'M',
  create:   'C',
  transfer: 'T',
  discuss:  'D',
};

// ── DOM refs ──────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const planChip      = $('plan-chip');
const upsellBox     = $('upsell-box');
const soloUpgradeLink     = $('solo-upgrade-link');
const practiceUpgradeLink = $('practice-upgrade-link');
const licenseInput  = $('license-input');
const activateBtn   = $('activate-btn');
const deactivateBtn = $('deactivate-btn');
const licenseStatus = $('license-status');
const proLockLabel  = $('pro-lock-label');
const saveBtn       = $('save-btn');
const resetBtn      = $('reset-btn');
const saveMsg       = $('save-msg');
const applyBtn      = $('apply-btn');
const applyStatus   = $('apply-status');
const refreshOrgsBtn = $('refresh-orgs-btn');
const refreshOrgsStatus = $('refresh-orgs-status');
const manageSubscriptionLink = $('manage-subscription-link');
const approvalNotificationTest = $('approval-notification-test');
const approvalNotificationStatus = $('approval-notification-status');

const SC_FIELDS = ['palette', 'match', 'create', 'transfer', 'discuss'];
const SOLO_TOGGLES = [
  'toggle-solo-top-pagination',
  'toggle-solo-page-size',
];
const PRACTICE_TOGGLES = [
  'toggle-require-tracking',
  'toggle-require-description',
  'toggle-practice-approval-watch',
  'toggle-practice-recode-index',
];

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
  const activeColored = new Set(orgIsPro ? colored : colored.slice(0, ORG_FREE_LIMIT));

  ids.forEach(id => {
    const org = orgColors[id];
    const inactiveSaved = !orgIsPro && Boolean(org.color) && !activeColored.has(id);
    // Freeでは2組織だけ適用。保存済みの3組織目以降は設定を保持して変更を止める。
    const locked = inactiveSaved || (atLimit && !org.color);

    const row = document.createElement('div');
    row.className = `org-row${inactiveSaved ? ' org-row-inactive' : ''}`;

    const left = document.createElement('div');
    left.innerHTML =
      `<div class="org-name"></div><div class="org-id"></div><div class="org-selection"></div>`;
    left.querySelector('.org-name').textContent = org.name || id;
    left.querySelector('.org-id').textContent   = id;
    const selected = ORG_PALETTE.find(p => p.hex === org.color);
    left.querySelector('.org-selection').textContent =
      inactiveSaved
        ? `Saved: ${selected?.label || 'No colour'} · Upgrade to apply`
        : `Selected: ${selected?.label || 'No colour'}`;

    const sw = document.createElement('div');
    sw.className = 'org-swatches';

    const none = document.createElement('button');
    none.className = 'swatch swatch-none';
    none.textContent = '✕';
    none.title = 'No colour';
    none.setAttribute('aria-label', 'No colour');
    none.setAttribute('aria-pressed', String(!org.color));
    none.addEventListener('click', () => setOrgColor(id, null));
    sw.appendChild(none);

    ORG_PALETTE.forEach(p => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.backgroundColor = p.hex;
      b.title = p.label;
      b.setAttribute('aria-label', p.label);
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
    const inactiveCount = Math.max(0, colored.length - ORG_FREE_LIMIT);
    limit.style.display = 'block';
    limit.innerHTML =
      `Free applies colours to ${ORG_FREE_LIMIT} organisations. ` +
      (inactiveCount
        ? `${inactiveCount} saved colour${inactiveCount === 1 ? ' is' : 's are'} currently inactive. `
        : `Clear an active colour to use that slot on another organisation. `) +
      `<a href="${SOLO_UPGRADE_URL || PRACTICE_UPGRADE_URL}" target="_blank">Upgrade</a> to colour all of them.`;
  } else {
    limit.style.display = 'none';
  }
}

function setOrgColor(id, hex) {
  if (!orgColors[id]) return;
  orgColors[id].color = hex;
  chrome.storage.local.set({ xp_org_colors: orgColors }).then(renderOrgs);
}

refreshOrgsBtn.addEventListener('click', async () => {
  refreshOrgsBtn.disabled = true;
  refreshOrgsBtn.textContent = 'Refreshing…';
  refreshOrgsStatus.className = 'org-refresh-status';
  refreshOrgsStatus.textContent = 'Checking open Xero tabs…';

  try {
    const before = Object.keys(orgColors).length;
    const tabs = await chrome.tabs.query({});
    const results = await Promise.allSettled(
      tabs.filter(tab => tab.id).map(tab =>
        chrome.tabs.sendMessage(tab.id, { type: 'xp-discover-organisations' })
      )
    );
    const contacted = results.filter(result =>
      result.status === 'fulfilled' && result.value?.ok === true
    ).length;

    if (!contacted) {
      refreshOrgsStatus.textContent = 'Open Xero in a tab, then try again.';
      refreshOrgsStatus.className = 'org-refresh-status is-error';
      return;
    }

    const data = await chrome.storage.local.get(['xp_org_colors']);
    orgColors = data.xp_org_colors || {};
    renderOrgs();
    const added = Math.max(0, Object.keys(orgColors).length - before);
    refreshOrgsStatus.textContent = added
      ? `Added ${added}. ${Object.keys(orgColors).length} organisations total.`
      : `${Object.keys(orgColors).length} organisations up to date.`;
  } catch {
    refreshOrgsStatus.textContent = 'Could not refresh. Please try again.';
    refreshOrgsStatus.className = 'org-refresh-status is-error';
  } finally {
    refreshOrgsBtn.disabled = false;
    refreshOrgsBtn.textContent = 'Refresh organisations';
  }
});

// Xeroタブで新しい組織を開いたら一覧に反映する
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.xp_org_colors) {
    orgColors = changes.xp_org_colors.newValue || {};
    renderOrgs();
  }
  if (changes.xp_pro || changes.xp_plan || changes.xp_license_status) {
    chrome.storage.local.get([
      'xp_pro', 'xp_plan', 'xp_pro_owner', 'xp_license', 'xp_license_status',
      'xp_require_tracking', 'xp_require_description',
      'xp_practice_approval_watch', 'xp_practice_recode_index',
    ]).then(async (data) => {
      if (data.xp_license) licenseInput.value = data.xp_license;
      const plan = normalizedPlan(data);
      applyPlanState(plan, data.xp_pro_owner === true);
      if (plan === 'practice') {
        $('toggle-require-tracking').checked = data.xp_require_tracking === true;
        $('toggle-require-description').checked = data.xp_require_description === true;
        $('toggle-practice-recode-index').checked = data.xp_practice_recode_index !== false;
        const hasNotifications = data.xp_practice_approval_watch === true &&
          await chrome.permissions.contains({ permissions: ['notifications'] });
        $('toggle-practice-approval-watch').checked = hasNotifications;
      }
      if (data.xp_license_status === 'inactive') {
        licenseStatus.style.display = 'block';
        licenseStatus.className = 'license-status status-err';
        licenseStatus.textContent = 'This subscription is no longer active. Manage it in Polar or activate a valid license.';
      }
    });
  }
});

// ── Polar ライセンス検証 ──────────────────────────────────────
// 有効なキーはPolarだけが発行する。ここに合言葉の分岐を足さないこと。
// 戻り値: false | 'pro' | 'practice' | 'unavailable'
//
// ⚠️ 「無効」と「今は判断できない」を混同しないこと。
//    Soloのキーは必ずPractice側の問い合わせを1回外してからSolo側で当たる。
//    外れ方を区別せず打ち切ると、Polarが一瞬詰まっただけで、金を払った客に
//    「キーが違う」と言うことになる。当たるはずの2回目に到達すらしない。
//    片方が詰まってももう片方は試し、どこも granted でなく、かつ判断できない
//    問い合わせが1件でもあれば 'unavailable' を返す。
async function validateLicense(key) {
  const benefits = [
    { plan: 'practice', benefitId: POLAR_PRACTICE_BENEFIT_ID },
    { plan: 'pro', benefitId: POLAR_SOLO_BENEFIT_ID },
  ];

  let inconclusive = false;

  for (const benefit of benefits) {
    let res;
    try {
      res = await fetch('https://api.polar.sh/v1/customer-portal/license-keys/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key:             key.trim(),
          organization_id: POLAR_ORG_ID,
          benefit_id:      benefit.benefitId,
        }),
      });
    } catch {
      inconclusive = true;   // 通信断。キーが悪いとは言えない
      continue;
    }

    // このbenefitには紐付いていない = はっきり外れ。次のプランを試す
    if (res.status === 404 || res.status === 422) continue;
    // 429 / 5xx / その他 = Polar側の都合。判断を保留する
    if (!res.ok) { inconclusive = true; continue; }

    let json;
    try {
      json = await res.json();
    } catch {
      inconclusive = true;
      continue;
    }

    const expiresAt = json.expires_at ? Date.parse(json.expires_at) : null;
    const notExpired = !json.expires_at || (Number.isFinite(expiresAt) && expiresAt > Date.now());
    if (json.status === 'granted' && notExpired) return benefit.plan;
  }

  return inconclusive ? 'unavailable' : false;
}

function normalizedPlan(data) {
  if (data?.xp_plan === 'practice' || data?.xp_plan === 'pro') return data.xp_plan;
  // 既存ユーザーの互換性: 旧Proは$44.99のPractice Proとして扱う。
  return data?.xp_pro === true ? 'practice' : 'free';
}

// ── UI: Paid / Free 状態を反映 ────────────────────────────────
// isOwner=true のときはチップに (owner) を出す。
// 検証中の画面を宣材に使ったとき、本物のProと見分けがつかないと困るため。
function applyPlanState(plan, isOwner) {
  const isPaid     = plan === 'pro' || plan === 'practice';
  const isPractice = plan === 'practice';
  const chipText = {
    free: 'Free',
    pro: 'Solo Pro ✅',
    practice: isOwner ? 'Practice Pro (owner) ✅' : 'Practice Pro ✅',
  }[plan] || 'Free';

  planChip.textContent = chipText;
  planChip.className   = 'plan-chip ' + (
    plan === 'practice' ? 'chip-practice' : isPaid ? 'chip-pro' : 'chip-free'
  );
  upsellBox.style.display     = isPaid ? 'none' : 'block';
  deactivateBtn.style.display = isPaid ? 'inline-block' : 'none';
  activateBtn.style.display   = isPaid ? 'none' : 'inline-block';
  manageSubscriptionLink.style.display = 'inline-flex';
  proLockLabel.style.display  = isPaid ? 'none' : 'inline';

  SC_FIELDS.forEach(id => {
    const el = $('sc-' + id);
    el.disabled = !isPaid;
  });
  saveBtn.disabled  = !isPaid;
  resetBtn.disabled = !isPaid;

  SOLO_TOGGLES.forEach(id => {
    $(id).disabled = !isPaid;
  });
  document.querySelectorAll('.solo-tool-row').forEach(row => {
    row.style.opacity = isPaid ? '1' : '.55';
  });
  $('solo-tools-lock').style.display = isPaid ? 'none' : 'inline';

  PRACTICE_TOGGLES.forEach(id => {
    $(id).disabled = !isPractice;
    if (!isPractice) $(id).checked = false;
  });
  approvalNotificationTest.disabled = !isPractice;
  document.querySelectorAll('.practice-tool-row').forEach(row => {
    row.style.opacity = isPractice ? '1' : '.55';
  });
  $('practice-tools-lock').style.display = isPractice ? 'none' : 'inline';

  // Paid の切り替えで組織カラーの無料枠表示も変わる
  orgIsPro = isPaid;
  renderOrgs();
}

// ── UI: ショートカット値をフィールドに反映 ────────────────────
function loadShortcuts(sc) {
  SC_FIELDS.forEach(id => {
    const saved = sc[id] ?? DEFAULTS[id];
    // 保存値は「保存した端末の表記」のまま残る（Macで保存すると "Cmd+P"）。
    // 実際に効くのは末尾の1文字だけなので、修飾キーの表記は必ず今の端末に直す。
    // ユーザーの64%がChromeOSで、Cmdキーが存在しない。
    $('sc-' + id).value = id === 'palette'
      ? MOD_LABEL + (String(saved).match(/([a-z0-9])\s*$/i)?.[1] || 'K').toUpperCase()
      : saved;
  });
}

// ── 初期化 ────────────────────────────────────────────────────
chrome.storage.local.get([
  'xp_pro', 'xp_license', 'xp_shortcuts',
  'xp_invoice_approve_default',
  'xp_org_colors', 'xp_dark_mode', 'xp_require_tracking', 'xp_pro_owner', 'xp_plan',
  'xp_license_status',
  'xp_require_description', 'xp_practice_approval_watch', 'xp_practice_recode_index',
  'xp_solo_top_pagination',
  'xp_solo_remember_page_size',
]).then(async data => {
  const plan   = normalizedPlan(data);
  const isPaid = plan === 'pro' || plan === 'practice';
  const sc    = Object.assign({}, DEFAULTS, data.xp_shortcuts || {});

  orgColors = data.xp_org_colors || {};
  orgIsPro  = isPaid;
  renderOrgs();

  if (data.xp_license) licenseInput.value = data.xp_license;
  applyPlanState(plan, data.xp_pro_owner === true);
  loadShortcuts(sc);
  if (SOLO_UPGRADE_URL) {
    soloUpgradeLink.href = SOLO_UPGRADE_URL;
  } else {
    soloUpgradeLink.removeAttribute('href');
    soloUpgradeLink.removeAttribute('target');
    soloUpgradeLink.classList.add('btn-secondary');
    soloUpgradeLink.textContent = 'Solo checkout coming soon';
  }
  practiceUpgradeLink.href = PRACTICE_UPGRADE_URL;
  manageSubscriptionLink.href = CUSTOMER_PORTAL_URL;

  // プレースホルダもプラットフォームに合わせる（ChromeOS/Windows は Ctrl+K）
  SC_FIELDS.forEach(id => { $('sc-' + id).placeholder = DEFAULTS[id]; });

  // Behaviour トグル（無料・既定ON）
  $('toggle-invoice-approve').checked = data.xp_invoice_approve_default !== false;

  // ダークモード（無料・既定OFF）
  $('toggle-dark-mode').checked = data.xp_dark_mode === true;

  // トラッキング必須化（Practice Pro・既定OFF）
  $('toggle-require-tracking').checked = plan === 'practice' && data.xp_require_tracking === true;
  $('toggle-require-description').checked = plan === 'practice' && data.xp_require_description === true;
  let approvalWatchEnabled = false;
  if (plan === 'practice' && data.xp_practice_approval_watch === true) {
    approvalWatchEnabled = await chrome.permissions.contains({ permissions: ['notifications'] });
    if (!approvalWatchEnabled) chrome.storage.local.set({ xp_practice_approval_watch: false });
  }
  $('toggle-practice-approval-watch').checked = approvalWatchEnabled;
  $('toggle-practice-recode-index').checked = plan === 'practice' && data.xp_practice_recode_index !== false;

  // Solo Pro tools（Solo Pro / Practice Pro）
  $('toggle-solo-top-pagination').checked = data.xp_solo_top_pagination !== false;
  $('toggle-solo-page-size').checked = data.xp_solo_remember_page_size !== false;

  if (data.xp_license_status === 'inactive') {
    licenseStatus.style.display = 'block';
    licenseStatus.className = 'license-status status-err';
    licenseStatus.textContent = 'This subscription is no longer active. Manage it in Polar or activate a valid license.';
  }
});

// ── Behaviour トグル保存（無料機能・即反映） ──────────────────
$('toggle-invoice-approve').addEventListener('change', (e) => {
  chrome.storage.local.set({ xp_invoice_approve_default: e.target.checked });
});
$('toggle-dark-mode').addEventListener('change', (e) => {
  chrome.storage.local.set({ xp_dark_mode: e.target.checked });
});
$('toggle-require-tracking').addEventListener('change', (e) => {
  chrome.storage.local.set({ xp_require_tracking: e.target.checked });
});
$('toggle-require-description').addEventListener('change', (e) => {
  chrome.storage.local.set({ xp_require_description: e.target.checked });
});
$('toggle-practice-approval-watch').addEventListener('change', async (e) => {
  if (!e.target.checked) {
    chrome.storage.local.set({ xp_practice_approval_watch: false });
    chrome.permissions.remove({ permissions: ['notifications'] }).catch(() => {});
    return;
  }

  let granted = false;
  try {
    granted = await chrome.permissions.request({ permissions: ['notifications'] });
  } catch {
    granted = false;
  }
  e.target.checked = granted;
  chrome.storage.local.set({ xp_practice_approval_watch: granted });
});
approvalNotificationTest.addEventListener('click', async () => {
  approvalNotificationTest.disabled = true;
  approvalNotificationStatus.className = 'notification-test-status';
  approvalNotificationStatus.textContent = 'Checking Chrome notification delivery…';
  try {
    const result = await chrome.runtime.sendMessage({ type: 'xp-approval-test' });
    if (result?.ok) {
      approvalNotificationStatus.className = 'notification-test-status is-ok';
      approvalNotificationStatus.textContent = 'Chrome accepted the notification. If no banner appeared, enable Google Chrome in macOS Settings > Notifications.';
    } else {
      approvalNotificationStatus.className = 'notification-test-status is-error';
      approvalNotificationStatus.textContent = result?.detail
        ? `Notification failed: ${result.detail}`
        : `Notification failed: ${result?.reason || 'unknown error'}.`;
    }
  } catch (error) {
    approvalNotificationStatus.className = 'notification-test-status is-error';
    approvalNotificationStatus.textContent = `Notification failed: ${error?.message || 'unknown error'}.`;
  } finally {
    const data = await chrome.storage.local.get(['xp_plan']);
    approvalNotificationTest.disabled = normalizedPlan(data) !== 'practice';
  }
});
$('toggle-practice-recode-index').addEventListener('change', (e) => {
  chrome.storage.local.set({ xp_practice_recode_index: e.target.checked });
});

// ── Solo Pro tools ────────────────────────────────────────────
$('toggle-solo-top-pagination').addEventListener('change', (e) => {
  chrome.storage.local.set({ xp_solo_top_pagination: e.target.checked });
});
$('toggle-solo-page-size').addEventListener('change', (e) => {
  chrome.storage.local.set({ xp_solo_remember_page_size: e.target.checked });
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

  // Polarに届かなかっただけ。拒否ではないので、赤字にも保存にも進めない
  if (valid === 'unavailable') {
    licenseStatus.className   = 'license-status status-warn';
    licenseStatus.textContent =
      "Couldn't reach Polar to check this key. Please try again in a moment — your subscription is not affected.";
    return;
  }

  if (valid) {
    const plan = valid;
    licenseStatus.className   = 'license-status status-ok';
    licenseStatus.textContent =
      `✓ ${plan === 'practice' ? 'Practice Pro' : 'Solo Pro'} activated! Reload any Xero tab to apply.`;
    chrome.storage.local.set({
      xp_pro: true,
      xp_plan: plan,
      xp_license: key,
      // 手元で立てた検証用フラグが残っていると定期再検証が飛ぶので、必ず落とす
      xp_pro_owner: false,
      xp_license_local_qa: false,
      xp_license_status: 'active',
      xp_license_last_valid_at: Date.now(),
      xp_license_last_check_at: Date.now(),
    });
    applyPlanState(plan, false);
  } else {
    licenseStatus.className   = 'license-status status-err';
    licenseStatus.textContent = '✗ Invalid license key. Check your purchase email.';
  }
});

// ── ライセンス削除 ────────────────────────────────────────────
deactivateBtn.addEventListener('click', () => {
  chrome.storage.local.remove([
    'xp_pro', 'xp_plan', 'xp_license', 'xp_pro_owner', 'xp_license_local_qa', 'xp_license_status',
    'xp_license_last_valid_at', 'xp_license_last_check_at',
  ]);
  licenseInput.value = '';
  licenseStatus.style.display = 'block';
  licenseStatus.className   = 'license-status status-ok';
  licenseStatus.textContent = 'License deactivated on this browser. Billing is managed separately in Polar.';
  applyPlanState('free', false);
  loadShortcuts(DEFAULTS);
});

function shortcutsFromForm() {
  const sc = {};
  SC_FIELDS.forEach(id => {
    sc[id] = $('sc-' + id).value.trim() || DEFAULTS[id];
  });
  return sc;
}

function saveShortcuts() {
  return chrome.storage.local.set({ xp_shortcuts: shortcutsFromForm() });
}

// ── ショートカット保存 ────────────────────────────────────────
saveBtn.addEventListener('click', () => {
  saveShortcuts().then(() => {
    saveMsg.style.display = 'inline';
    setTimeout(() => { saveMsg.style.display = 'none'; }, 2000);
  });
});

// ── 全設定を保存して、開いているXeroタブへ反映 ────────────────
applyBtn.addEventListener('click', async () => {
  applyBtn.disabled = true;
  applyBtn.textContent = 'Applying…';
  applyStatus.className = 'apply-status';

  try {
    const settings = {
      xp_invoice_approve_default: $('toggle-invoice-approve').checked,
      xp_dark_mode: $('toggle-dark-mode').checked,
    };
    if (!$('toggle-solo-top-pagination').disabled) {
      Object.assign(settings, {
        xp_solo_top_pagination: $('toggle-solo-top-pagination').checked,
        xp_solo_remember_page_size: $('toggle-solo-page-size').checked,
        xp_shortcuts: shortcutsFromForm(),
      });
    }
    if (!$('toggle-require-tracking').disabled) {
      Object.assign(settings, {
        xp_require_tracking: $('toggle-require-tracking').checked,
        xp_require_description: $('toggle-require-description').checked,
        xp_practice_approval_watch: $('toggle-practice-approval-watch').checked,
        xp_practice_recode_index: $('toggle-practice-recode-index').checked,
      });
    }
    await chrome.storage.local.set(settings);

    const tabs = await chrome.tabs.query({});
    const results = await Promise.allSettled(
      tabs.filter(tab => tab.id).map(tab =>
        chrome.tabs.sendMessage(tab.id, { type: 'xp-apply-settings' })
      )
    );
    const reloaded = results.filter(result =>
      result.status === 'fulfilled' && result.value?.reloading === true
    ).length;

    applyStatus.textContent = reloaded
      ? `Saved. Reloading ${reloaded} Xero tab${reloaded === 1 ? '' : 's'}.`
      : 'Saved. Open Xero to use these settings.';
    applyStatus.className = 'apply-status is-visible';
  } catch {
    applyStatus.textContent = 'Could not apply settings. Please try again.';
    applyStatus.className = 'apply-status is-visible is-error';
  } finally {
    applyBtn.disabled = false;
    applyBtn.textContent = 'Save & apply';
  }
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
