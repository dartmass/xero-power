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

function normalizedPlan(data) {
  if (data?.xp_plan === 'practice' || data?.xp_plan === 'pro') return data.xp_plan;
  return data?.xp_pro === true ? 'practice' : 'free';
}

chrome.storage.local.get([
  'xp_pro', 'xp_plan', 'xp_license', 'xp_shortcuts', 'xp_usage',
  'xp_org_colors', 'xp_workspace_org_ids',
  'xp_approval_queues',
]).then(data => {
  const plan     = normalizedPlan(data);
  const isPaid   = plan === 'pro' || plan === 'practice';
  const sc       = Object.assign({}, DEFAULTS, isPaid ? data.xp_shortcuts || {} : {});
  const navTotal = Object.values(data.xp_usage || {}).reduce((a, n) => a + n, 0);
  const minSaved = Math.ceil(navTotal * 0.5);

  // プランバッジ
  document.getElementById('plan-badge').textContent =
    plan === 'practice' ? 'Practice Pro ✅' : plan === 'pro' ? 'Solo Pro ✅' : 'Free';
  document.getElementById('plan-badge').className   = 'badge ' + (
    plan === 'practice' ? 'badge-practice' : isPaid ? 'badge-pro' : 'badge-free'
  );

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
  if (!isPaid && navTotal >= 5) {
    document.getElementById('pro-nudge').style.display = 'block';
  }
  if (isPaid || data.xp_license) {
    document.getElementById('manage-subscription-section').style.display = 'block';
  }

  if (isPaid) renderWorkspace(data.xp_org_colors || {}, data.xp_workspace_org_ids || []);
  if (plan === 'practice') renderApprovalQueue(data.xp_approval_queues || {});
});

function safeXeroUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'xero.com' || url.hostname.endsWith('.xero.com'));
  } catch {
    return false;
  }
}

function relativeObservedTime(timestamp) {
  const minutes = Math.max(0, Math.floor((Date.now() - Number(timestamp || 0)) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function renderApprovalQueue(queues) {
  const section = document.getElementById('approval-section');
  const list = document.getElementById('approval-list');
  const entries = Object.values(queues)
    .filter(entry =>
      entry &&
      ['invoices', 'bills'].includes(entry.kind) &&
      Date.now() - Number(entry.observedAt || 0) <= 30 * 86400000
    )
    .sort((a, b) => Number(b.observedAt || 0) - Number(a.observedAt || 0));

  section.style.display = 'block';
  list.innerHTML = '';
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'approval-empty';
    empty.textContent = 'Open an Awaiting approval list in Xero to start watching it.';
    list.appendChild(empty);
    return;
  }

  entries.forEach(entry => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'approval-row';
    row.disabled = !safeXeroUrl(entry.url);

    const detail = document.createElement('span');
    const name = document.createElement('span');
    name.className = 'approval-name';
    name.textContent = entry.orgName || entry.orgId || 'Xero organisation';
    const meta = document.createElement('span');
    meta.className = 'approval-meta';
    meta.textContent = `${entry.kind} · ${relativeObservedTime(entry.observedAt)}`;
    detail.append(name, meta);

    const count = document.createElement('span');
    count.className = 'approval-count';
    count.textContent = String(Math.max(0, Number(entry.count) || 0));
    row.append(detail, count);
    row.addEventListener('click', () => {
      if (!safeXeroUrl(entry.url)) return;
      chrome.tabs.create({ url: entry.url });
      window.close();
    });
    list.appendChild(row);
  });
}

function renderWorkspace(orgs, savedIds) {
  const section = document.getElementById('workspace-section');
  const list = document.getElementById('workspace-list');
  const openBtn = document.getElementById('workspace-open');
  const count = document.getElementById('workspace-count');
  const tools = document.getElementById('workspace-tools');
  const search = document.getElementById('workspace-search');
  const visibleCount = document.getElementById('workspace-visible-count');
  const selectAllBtn = document.getElementById('workspace-select-all');
  const clearBtn = document.getElementById('workspace-clear');
  const scrollHint = document.getElementById('workspace-scroll-hint');
  const entries = Object.entries(orgs)
    .filter(([id]) => /^![A-Za-z0-9_-]+$/.test(id))
    .sort((a, b) => (a[1]?.name || a[0]).localeCompare(b[1]?.name || b[0]));
  const selected = new Set(savedIds.filter(id => entries.some(([orgId]) => orgId === id)));
  let query = '';

  section.style.display = 'block';

  function filteredEntries() {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return entries;
    return entries.filter(([id, org]) =>
      `${org?.name || ''} ${id}`.toLocaleLowerCase().includes(normalized)
    );
  }

  function updateSummary() {
    const ids = entries.map(([id]) => id).filter(id => selected.has(id));
    count.textContent = `${ids.length} of ${entries.length} selected`;
    openBtn.disabled = ids.length === 0;
  }

  function updateScrollHint() {
    const canScroll = list.scrollHeight > list.clientHeight + 1;
    scrollHint.style.display = canScroll ? 'block' : 'none';
    scrollHint.textContent = list.scrollTop + list.clientHeight >= list.scrollHeight - 1
      ? 'End of list'
      : 'Scroll for more ↓';
  }

  function sync() {
    const ids = entries.map(([id]) => id).filter(id => selected.has(id));
    chrome.storage.local.set({ xp_workspace_org_ids: ids });
    renderList();
  }

  function renderList() {
    const visible = filteredEntries();
    list.innerHTML = '';
    visibleCount.textContent = query
      ? `${visible.length} of ${entries.length} shown`
      : `${entries.length} organisation${entries.length === 1 ? '' : 's'}`;

    selectAllBtn.disabled = visible.length === 0 || visible.every(([id]) => selected.has(id));
    clearBtn.disabled = !visible.some(([id]) => selected.has(id));
    selectAllBtn.textContent = query ? 'Select results' : 'Select all';
    clearBtn.textContent = query ? 'Clear results' : 'Clear';

    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'workspace-empty';
      empty.textContent = 'Open Xero’s organisation menu or refresh the list in Settings.';
      list.appendChild(empty);
    } else if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'workspace-empty';
      empty.textContent = `No organisations match “${query.trim()}”.`;
      list.appendChild(empty);
    } else {
      visible.forEach(([id, org]) => {
        const label = document.createElement('label');
        label.className = 'workspace-org';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selected.has(id);
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) selected.add(id);
          else selected.delete(id);
          sync();
        });

        const dot = document.createElement('span');
        dot.className = 'workspace-dot';
        if (org?.color) dot.style.backgroundColor = org.color;

        const name = document.createElement('span');
        name.className = 'workspace-name';
        name.textContent = org?.name || id;

        label.append(checkbox, dot, name);
        list.appendChild(label);
      });
    }

    updateSummary();
    requestAnimationFrame(updateScrollHint);
  }

  tools.hidden = entries.length === 0;
  search.addEventListener('input', () => {
    query = search.value;
    renderList();
  });
  selectAllBtn.addEventListener('click', () => {
    filteredEntries().forEach(([id]) => selected.add(id));
    sync();
  });
  clearBtn.addEventListener('click', () => {
    filteredEntries().forEach(([id]) => selected.delete(id));
    sync();
  });
  list.addEventListener('scroll', updateScrollHint);

  renderList();
  openBtn.addEventListener('click', async () => {
    const ids = entries.map(([id]) => id).filter(id => selected.has(id));
    if (!ids.length) return;

    openBtn.disabled = true;
    openBtn.textContent = 'Opening…';
    try {
      const tabs = await Promise.all(ids.map(id => chrome.tabs.create({
        url: `https://go.xero.com/app/${encodeURIComponent(id)}/dashboard`,
        active: false,
      })));
      if (tabs[0]?.id) await chrome.tabs.update(tabs[0].id, { active: true });
      window.close();
    } catch {
      openBtn.disabled = false;
      openBtn.textContent = 'Open workspace';
    }
  });
}

function openSettings() {
  chrome.runtime.openOptionsPage();
  window.close();
}

document.getElementById('settings-top-btn').addEventListener('click', openSettings);
document.getElementById('settings-btn').addEventListener('click', openSettings);

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
