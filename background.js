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

const POLAR_ORG_ID = '22affaff-7111-4f56-bc19-50507024e7f1';
const POLAR_SOLO_BENEFIT_ID = '1401e133-bcdb-441b-8ba9-934092119908';
const POLAR_PRACTICE_BENEFIT_ID = '156a2073-e417-4b2e-a56f-de3f4a19c2cb';
const POLAR_LICENSE_VALIDATE_URL = 'https://api.polar.sh/v1/customer-portal/license-keys/validate';
const LICENSE_RECHECK_ALARM = 'xp-license-recheck';
const LICENSE_RECHECK_MINUTES = 24 * 60;
const LICENSE_STARTUP_THROTTLE_MS = 6 * 60 * 60 * 1000;
const RETIRED_STORAGE_KEYS = [
  'xp_bill_approve_view_next',
  'xp_bill_queue',
  'xp_bill_pending',
  'xp_solo_pdf_button',
  'xp_solo_skip_payment_promo',
];

// ─────────────────────────────────────────────────────────────

// 初回インストール時のみ welcome ページを開く（アップデート時は開かない）
chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.storage.local.remove(RETIRED_STORAGE_KEYS);
  if (reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
  scheduleLicenseRecheck();
  revalidateStoredLicense({ force: reason === 'update' }).catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  scheduleLicenseRecheck();
  revalidateStoredLicense().catch(() => {});
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

function scheduleLicenseRecheck() {
  chrome.alarms.create(LICENSE_RECHECK_ALARM, {
    delayInMinutes: LICENSE_RECHECK_MINUTES,
    periodInMinutes: LICENSE_RECHECK_MINUTES,
  });
}

async function validatePolarLicense(key) {
  const benefits = [
    { plan: 'practice', benefitId: POLAR_PRACTICE_BENEFIT_ID },
    { plan: 'pro', benefitId: POLAR_SOLO_BENEFIT_ID },
  ];

  for (const benefit of benefits) {
    let response;
    try {
      response = await fetch(POLAR_LICENSE_VALIDATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          organization_id: POLAR_ORG_ID,
          benefit_id: benefit.benefitId,
        }),
      });
    } catch {
      return { state: 'unavailable' };
    }

    if (response.status === 404 || response.status === 422) continue;
    if (response.status === 429 || response.status >= 500 || !response.ok) {
      return { state: 'unavailable' };
    }

    let license;
    try {
      license = await response.json();
    } catch {
      return { state: 'unavailable' };
    }
    const expiresAt = license.expires_at ? Date.parse(license.expires_at) : null;
    const notExpired = !license.expires_at || (Number.isFinite(expiresAt) && expiresAt > Date.now());
    if (license.status === 'granted' && notExpired) {
      return { state: 'valid', plan: benefit.plan };
    }
  }

  return { state: 'invalid' };
}

async function revalidateStoredLicense({ force = false } = {}) {
  const data = await chrome.storage.local.get([
    'xp_license', 'xp_pro_owner', 'xp_license_local_qa', 'xp_license_last_check_at',
  ]);
  if (!data.xp_license || data.xp_pro_owner === true || data.xp_license_local_qa === true) {
    return { state: 'skipped' };
  }

  const now = Date.now();
  if (!force && now - Number(data.xp_license_last_check_at || 0) < LICENSE_STARTUP_THROTTLE_MS) {
    return { state: 'throttled' };
  }

  const result = await validatePolarLicense(data.xp_license);
  if (result.state === 'unavailable') {
    await chrome.storage.local.set({ xp_license_last_check_at: now });
    return result;
  }

  if (result.state === 'valid') {
    await chrome.storage.local.set({
      xp_pro: true,
      xp_plan: result.plan,
      xp_pro_owner: false,
      xp_license_local_qa: false,
      xp_license_status: 'active',
      xp_license_last_check_at: now,
      xp_license_last_valid_at: now,
    });
    return result;
  }

  await chrome.storage.local.remove(['xp_pro', 'xp_plan', 'xp_pro_owner', 'xp_license_local_qa']);
  await chrome.storage.local.set({
    xp_license_status: 'inactive',
    xp_license_last_check_at: now,
  });
  return result;
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === LICENSE_RECHECK_ALARM) {
    revalidateStoredLicense({ force: true }).catch(() => {});
  }
});

const APPROVAL_NOTIFICATION_PREFIX = 'xp-approval:';

function isSafeXeroUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'xero.com' || url.hostname.endsWith('.xero.com'));
  } catch {
    return false;
  }
}

async function handleNotificationClick(notificationId) {
  if (!notificationId.startsWith(APPROVAL_NOTIFICATION_PREFIX)) return;
  const key = notificationId.slice(APPROVAL_NOTIFICATION_PREFIX.length);
  const data = await chrome.storage.local.get(['xp_approval_queues']);
  const target = data.xp_approval_queues?.[key]?.url;
  if (isSafeXeroUrl(target)) await chrome.tabs.create({ url: target });
  chrome.notifications.clear(notificationId);
}

// notifications は optional_permissions。許可される前に Service Worker が起動して
// いると chrome.notifications ごと存在せず、リスナーを張る先が無い。起動時に1回
// 試すだけだと「許可した直後の最初の通知を押しても何も起きない」が起きる。
// そこで、権限が付いた瞬間と、通知を作る直前（＝権限があると確定した時点）にも張る。
let notificationClickBound = false;
function bindNotificationClick() {
  if (notificationClickBound || !chrome.notifications?.onClicked) return;
  if (!chrome.notifications.onClicked.hasListener(handleNotificationClick)) {
    chrome.notifications.onClicked.addListener(handleNotificationClick);
  }
  notificationClickBound = true;
}

bindNotificationClick();

chrome.permissions?.onAdded?.addListener((permissions) => {
  if (permissions?.permissions?.includes('notifications')) bindNotificationClick();
});

async function recordApprovalNotificationStatus(status) {
  const value = {
    ...status,
    checkedAt: Date.now(),
  };
  await chrome.storage.local.set({ xp_approval_notification_status: value });
  return value;
}

async function showApprovalNotification(message) {
  if (!chrome.notifications) {
    return recordApprovalNotificationStatus({ ok: false, reason: 'api-unavailable' });
  }
  const granted = await chrome.permissions.contains({ permissions: ['notifications'] });
  if (!granted) {
    return recordApprovalNotificationStatus({ ok: false, reason: 'permission-missing' });
  }
  const permissionLevel = await chrome.notifications.getPermissionLevel?.();
  if (permissionLevel && permissionLevel !== 'granted') {
    return recordApprovalNotificationStatus({ ok: false, reason: `permission-${permissionLevel}` });
  }
  bindNotificationClick();   // 押しても開かない通知を出さない

  const entry = message?.entry;
  if (!entry || !entry.orgId || !['invoices', 'bills'].includes(entry.kind)) {
    return recordApprovalNotificationStatus({ ok: false, reason: 'invalid-entry' });
  }
  const count = Number(entry.count);
  const previous = Number(message.previousCount);
  if (!Number.isFinite(count) || !Number.isFinite(previous) || count <= previous) {
    return recordApprovalNotificationStatus({ ok: false, reason: 'invalid-count' });
  }

  const notificationId = `${APPROVAL_NOTIFICATION_PREFIX}${entry.orgId}:${entry.kind}`;
  await chrome.notifications.clear(notificationId);
  const createdId = await chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: `${entry.orgName || 'Xero'} approval queue`,
    message: `${count} ${entry.kind} awaiting approval, up from ${previous}.`,
    priority: 1,
    requireInteraction: true,
  });
  const active = await chrome.notifications.getAll();
  return recordApprovalNotificationStatus({
    ok: true,
    reason: active?.[createdId] ? 'active' : 'accepted',
    notificationId: createdId,
    orgName: entry.orgName || 'Xero',
    kind: entry.kind,
    count,
    previousCount: previous,
  });
}

async function showApprovalTestNotification() {
  if (!chrome.notifications) {
    return recordApprovalNotificationStatus({ ok: false, reason: 'api-unavailable' });
  }
  const granted = await chrome.permissions.contains({ permissions: ['notifications'] });
  if (!granted) {
    return recordApprovalNotificationStatus({ ok: false, reason: 'permission-missing' });
  }
  const permissionLevel = await chrome.notifications.getPermissionLevel?.();
  if (permissionLevel && permissionLevel !== 'granted') {
    return recordApprovalNotificationStatus({ ok: false, reason: `permission-${permissionLevel}` });
  }

  bindNotificationClick();   // 押しても開かない通知を出さない

  const notificationId = `${APPROVAL_NOTIFICATION_PREFIX}test`;
  await chrome.notifications.clear(notificationId);
  const createdId = await chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: 'Xero Power notifications are working',
    message: 'You will be notified when an Awaiting Approval count increases.',
    priority: 1,
    requireInteraction: true,
  });
  const active = await chrome.notifications.getAll();
  return recordApprovalNotificationStatus({
    ok: true,
    reason: active?.[createdId] ? 'active' : 'accepted',
    notificationId: createdId,
    test: true,
  });
}

async function registerOrganisations(message) {
  const incoming = Array.isArray(message?.organisations) ? message.organisations : [];
  const valid = incoming
    .filter(entry => entry && /^![A-Za-z0-9_-]+$/.test(entry.id))
    .map(entry => ({
      id: entry.id,
      name: String(entry.name || entry.id).replace(/\s+/g, ' ').trim().slice(0, 120),
    }))
    .filter(entry => entry.name);

  const data = await chrome.storage.local.get(['xp_org_colors']);
  const organisations = { ...(data.xp_org_colors || {}) };
  let added = 0;
  let changed = false;

  valid.forEach(entry => {
    const existing = organisations[entry.id];
    if (!existing) {
      organisations[entry.id] = { name: entry.name, color: null };
      added += 1;
      changed = true;
      return;
    }
    if (entry.name === entry.id || existing.name === entry.name) return;

    // ⚠️ Xeroのナビは幅が狭いと組織名を略称にする。
    //    "Demo Company (Global)" → "DCG"、"bbb" → "b"（DevToolsを開くと再現）。
    //    短いほうで上書きすると、別クライアント警告が
    //    「Xero opened DCG, not b.」になって読めない。
    //    取り違えを防ぐための警告なので、名前は長いほうを残す。
    //    代償: Xero側で本当に短い名前へ改名しても追随しない。表示だけの話なので許容する。
    const isPlaceholder = existing.name === entry.id;
    if (!isPlaceholder && entry.name.length <= existing.name.length) return;

    organisations[entry.id] = { ...existing, name: entry.name };
    changed = true;
  });

  if (changed) await chrome.storage.local.set({ xp_org_colors: organisations });
  return { added, total: Object.keys(organisations).length };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'xp-approval-increased') {
    showApprovalNotification(message)
      .then(sendResponse)
      .catch((error) => recordApprovalNotificationStatus({
        ok: false,
        reason: 'create-failed',
        detail: String(error?.message || error || '').slice(0, 160),
      }).then(sendResponse));
    return true;
  }
  if (message?.type === 'xp-approval-test') {
    showApprovalTestNotification()
      .then(sendResponse)
      .catch((error) => recordApprovalNotificationStatus({
        ok: false,
        reason: 'create-failed',
        detail: String(error?.message || error || '').slice(0, 160),
      }).then(sendResponse));
    return true;
  }
  if (message?.type === 'xp-register-organisations') {
    registerOrganisations(message)
      .then(sendResponse)
      .catch(() => sendResponse({ added: 0, total: 0 }));
    return true;
  }
  return false;
});

