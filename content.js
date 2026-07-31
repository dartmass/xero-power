/**
 * Xero Power — content.js  v0.8.0
 * MVP: Command Palette (⌘K / Ctrl+K)
 *
 * Xero上の任意のページで ⌘K を押すと、
 * Xeroの全画面にファジー検索でジャンプできるコマンドパレットが開く。
 * RightTool（QBO版）の「250+ショートカット」をXeroに持ち込む最初の一手。
 *
 * v0.5.0: 新インボイスの既定ボタンを「Approve & email」→「Approve」に変更。
 *         Product Ideasで440票・Xeroが実装拒否(2026-01)・競合拡張ゼロのwedge。
 * v0.6.0: Bank Rec に確定ショートカット(↵)を追加。Bills 対応を試作(現在は BA_READY=false で無効)。
 *         r/xero ユーザーリクエスト(Logical_Sea2630)を受けて実装。無料機能。
 * v0.7.0: 初回トースト + welcome.html + background.js（オンボーディング）。
 * v0.7.1: ChromeOS対応の修正。ユーザーの64%がChromeOSで ⌘ キーが存在しないため:
 *         ①パレットキーのPro設定が効いていなかったのを修正(SC.palette未参照 + "k"ハードコード)
 *         ②popup/optionsの「⌘K」固定表示をプラットフォーム判定で切替
 *         ③ショートカット変更をstorage.onChangedで即反映(以前はタブ再読込が必要)
 *         ④ユーザー可視テキストを英語化(ユーザーの89%が米国)
 * v0.8.0: アンインストール時の1問アンケート(background.js) + popupにフィードバック導線。
 *         プライバシーポリシーを実態(Polar/Google Forms)に合わせて全面改訂。
 */
(() => {
  "use strict";

  // 二重読み込み防止
  if (window.__xeroPower) return;
  window.__xeroPower = "0.8.0";

  // ─────────────────────────────────────────
  // 1. Xero ページ一覧（コマンドパレットのデータ）
  // ─────────────────────────────────────────

  // 新旧2種のURL形式に対応:
  //   旧: go.xero.com/PageName/...aspx  → orgId 不要
  //   新: go.xero.com/app/{orgId}/...  → orgId 必要（現在のURLから取得）
  function getOrgId() {
    const m = location.pathname.match(/^\/app\/([^/]+)/);
    return m ? m[1] : null;
  }

  function buildUrl(path) {
    if (!path.includes("{orgId}")) return "https://go.xero.com" + path;
    const id = getOrgId();
    return id
      ? "https://go.xero.com" + path.replace("{orgId}", id)
      : "https://go.xero.com" + path.replace("/{orgId}", ""); // fallback
  }

  const PAGES = [
    // ── Banking ──
    {
      label: "Bank Reconciliation",
      sub: "Match transactions from your bank",
      keys: "bank reconcile reconciliation match",
      path: "/BankRec/BankRec.aspx",
      cat: "Banking",
    },
    {
      label: "Bank Accounts",
      sub: "View all connected bank accounts",
      keys: "bank accounts connect",
      path: "/Bank/BankAccounts.aspx",
      cat: "Banking",
    },
    {
      label: "Bank Rules",
      sub: "Auto-code recurring transactions",
      keys: "bank rules auto code",
      path: "/Bank/BankRules.aspx",
      cat: "Banking",
    },

    // ── Sales ──
    {
      label: "Invoices",
      sub: "Invoices owed to you",
      keys: "invoices sales receivable AR",
      path: "/AccountsReceivable/Search.aspx",
      cat: "Sales",
    },
    {
      label: "New Invoice",
      sub: "Create a new invoice",
      keys: "new invoice create send",
      path: "/AccountsReceivable/Edit.aspx",
      cat: "Sales",
    },
    {
      label: "Quotes",
      sub: "Quotes and estimates",
      keys: "quotes estimates proposals",
      path: "/Quotes/Search.aspx",
      cat: "Sales",
    },
    {
      label: "Credit Notes (Sales)",
      sub: "Sales credit notes",
      keys: "credit note refund sales",
      path: "/AccountsReceivable/CreditNotes.aspx",
      cat: "Sales",
    },

    // ── Purchases ──
    {
      label: "Bills to Pay",
      sub: "Bills from your suppliers",
      keys: "bills purchases payable AP suppliers",
      path: "/app/{orgId}/bills/list/all",
      cat: "Purchases",
    },
    {
      label: "New Bill",
      sub: "Enter a new bill",
      keys: "new bill create purchase",
      path: "/app/{orgId}/bills/create",
      cat: "Purchases",
    },
    {
      label: "Purchase Orders",
      sub: "Purchase orders to suppliers",
      keys: "purchase orders PO",
      path: "/PurchaseOrders/Search.aspx",
      cat: "Purchases",
    },
    {
      label: "Credit Notes (Purchases)",
      sub: "Supplier credit notes",
      keys: "credit note purchase supplier",
      path: "/AccountsPayable/CreditNotes.aspx",
      cat: "Purchases",
    },

    // ── Accounting ──
    {
      label: "Chart of Accounts",
      sub: "Manage account codes",
      keys: "chart of accounts COA account codes",
      path: "/Accounts/Accounts.aspx",
      cat: "Accounting",
    },
    {
      label: "Manual Journals",
      sub: "Post manual journal entries",
      keys: "manual journals journal entries",
      path: "/Journals/Search.aspx",
      cat: "Accounting",
    },
    {
      label: "Find and Recode",
      sub: "Batch recode transactions",
      keys: "find recode batch bulk reclassify",
      path: "/Accounts/FindAndRecode.aspx",
      cat: "Accounting",
    },
    {
      label: "Fixed Assets",
      sub: "Manage fixed asset register",
      keys: "fixed assets depreciation register",
      path: "/FixedAssets/FixedAssets.aspx",
      cat: "Accounting",
    },
    {
      label: "Accounting Settings",
      sub: "Financial year, tax settings",
      keys: "settings accounting financial year",
      path: "/Settings/AccountsSettings.aspx",
      cat: "Accounting",
    },

    // ── Reports ──
    {
      label: "Profit & Loss",
      sub: "Income statement",
      keys: "profit loss P&L income statement",
      path: "/Reports/Report/Index?reportType=ProfitAndLoss",
      cat: "Reports",
    },
    {
      label: "Balance Sheet",
      sub: "Assets, liabilities, equity",
      keys: "balance sheet assets liabilities equity",
      path: "/Reports/Report/Index?reportType=BalanceSheet",
      cat: "Reports",
    },
    {
      label: "Trial Balance",
      sub: "All account balances",
      keys: "trial balance",
      path: "/Reports/Report/Index?reportType=TrialBalance",
      cat: "Reports",
    },
    {
      label: "Aged Receivables",
      sub: "Who owes you money",
      keys: "aged receivables debtors outstanding",
      path: "/Reports/Report/Index?reportType=AgedReceivables",
      cat: "Reports",
    },
    {
      label: "Aged Payables",
      sub: "What you owe suppliers",
      keys: "aged payables creditors outstanding",
      path: "/Reports/Report/Index?reportType=AgedPayables",
      cat: "Reports",
    },
    {
      label: "Cash Summary",
      sub: "Cash flow overview",
      keys: "cash summary flow statement",
      path: "/Reports/Report/Index?reportType=CashSummary",
      cat: "Reports",
    },
    {
      label: "All Reports",
      sub: "Browse all reports",
      keys: "reports all list",
      path: "/Reports/Report/Index",
      cat: "Reports",
    },

    // ── Contacts ──
    {
      label: "Contacts",
      sub: "Customers and suppliers",
      keys: "contacts customers suppliers people",
      path: "/Contacts/Search.aspx",
      cat: "Contacts",
    },
    {
      label: "New Contact",
      sub: "Add a customer or supplier",
      keys: "new contact add customer supplier",
      path: "/Contacts/Edit.aspx",
      cat: "Contacts",
    },

    // ── Navigation ──
    {
      label: "Dashboard",
      sub: "Business overview",
      keys: "home dashboard overview",
      path: "/Dashboard",
      cat: "Navigation",
    },
    {
      label: "Projects",
      sub: "Track time and costs by project",
      keys: "projects time tracking",
      path: "/Projects",
      cat: "Navigation",
    },
    {
      label: "Payroll",
      sub: "Pay employees",
      keys: "payroll employees pay runs",
      path: "/Payroll",
      cat: "Navigation",
    },
  ];

  // ─────────────────────────────────────────
  // 2. 検索
  // ─────────────────────────────────────────
  // 単語の先頭にマッチするかを判定
  function wordStarts(text, q) {
    return text.toLowerCase().split(/\s+/).some((w) => w.startsWith(q));
  }

  function search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return PAGES;

    // 3文字以下はラベルの単語先頭にだけ一致させる（"rec"でInvoicesを出さない）
    if (q.length <= 3) {
      return PAGES.filter((p) => wordStarts(p.label, q));
    }

    // 4文字以上はラベル→キーワード→カテゴリ→説明文の順に広げる
    return PAGES.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.keys.toLowerCase().includes(q) ||
        p.cat.toLowerCase().includes(q) ||
        (p.sub && p.sub.toLowerCase().includes(q))
    );
  }

  // ─────────────────────────────────────────
  // 3. スタイル（Xeroのデザインに寄せた白ベース）
  // ─────────────────────────────────────────
  const CSS = `
    #xp-backdrop {
      position: fixed; inset: 0; z-index: 2147483646;
      background: rgba(13, 20, 50, .55);
      display: flex; align-items: flex-start; justify-content: center;
      padding-top: 108px;
      animation: xp-fade-in .12s ease;
    }
    @keyframes xp-fade-in { from { opacity: 0 } to { opacity: 1 } }

    #xp-box {
      width: 600px; max-width: 92vw;
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 12px 56px rgba(0,0,0,.32);
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: xp-slide-in .14s ease;
    }
    @keyframes xp-slide-in { from { transform: translateY(-8px); opacity:.6 } to { transform: none; opacity:1 } }

    #xp-search-row {
      display: flex; align-items: center;
      padding: 14px 16px; gap: 10px;
      border-bottom: 1px solid #eaecf0;
    }
    #xp-search-row svg { flex-shrink: 0; color: #9aa0b0; }

    #xp-input {
      flex: 1; border: none; outline: none;
      font-size: 16px; color: #111827;
      background: transparent; line-height: 1.4;
    }
    #xp-input::placeholder { color: #b0b8c8; }

    #xp-esc {
      font-size: 11px; color: #9aa0b0;
      background: #f4f5f7; border: 1px solid #dde0e8;
      border-radius: 4px; padding: 2px 7px; white-space: nowrap; cursor: pointer;
    }

    #xp-list {
      max-height: 380px; overflow-y: auto;
      padding: 6px 0 8px;
    }
    #xp-list::-webkit-scrollbar { width: 5px; }
    #xp-list::-webkit-scrollbar-thumb { background: #dde0e8; border-radius: 3px; }

    .xp-group-label {
      font-size: 10px; font-weight: 600; letter-spacing: .06em;
      color: #9aa0b0; text-transform: uppercase;
      padding: 8px 16px 3px;
    }
    .xp-group-label--top {
      color: #0a7a4b;
    }
    .xp-group-divider {
      height: 1px; background: #eaecf0; margin: 4px 14px 2px;
    }

    .xp-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 14px; cursor: pointer; gap: 12px;
      transition: background .08s;
      border-radius: 0;
    }
    .xp-item:hover, .xp-item.xp-sel {
      background: #f0f6ff;
    }
    .xp-item-left { display: flex; align-items: center; gap: 11px; min-width: 0; }
    .xp-icon {
      width: 30px; height: 30px; flex-shrink: 0;
      background: #f4f5f7; border-radius: 7px;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px;
    }
    .xp-item-text { min-width: 0; }
    .xp-label { font-size: 14px; font-weight: 500; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .xp-sub { font-size: 12px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .xp-cat {
      font-size: 11px; color: #6b7280;
      background: #f4f5f7; border-radius: 5px; padding: 2px 8px;
      white-space: nowrap; flex-shrink: 0;
    }
    .xp-item.xp-sel .xp-cat { background: #dbeafe; color: #1d4ed8; }

    #xp-empty {
      padding: 28px 16px; text-align: center;
      font-size: 14px; color: #9aa0b0;
    }

    #xp-footer {
      padding: 8px 16px; border-top: 1px solid #eaecf0;
      display: flex; align-items: center; gap: 14px;
    }
    .xp-hint { font-size: 11px; color: #9aa0b0; display: flex; align-items: center; gap: 4px; }
    .xp-key {
      background: #f4f5f7; border: 1px solid #dde0e8;
      border-radius: 4px; padding: 1px 6px; font-size: 11px; color: #555;
    }
    #xp-footer-logo {
      margin-left: auto; font-size: 11px; font-weight: 600;
      color: #c8cdd8; letter-spacing: .02em;
    }

    #xp-upsell-bar {
      padding: 8px 16px; border-top: 1px solid #d1fae5;
      background: #f0fdf4;
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; color: #166534;
    }
    #xp-upsell-text { flex: 1; }
    #xp-upsell-link {
      color: #0a7a4b; font-weight: 600; cursor: pointer;
      white-space: nowrap; text-decoration: none;
    }
    #xp-upsell-link:hover { text-decoration: underline; }
    #xp-upsell-dismiss {
      cursor: pointer; color: #9aa0b0;
      padding: 0 2px; font-size: 15px; line-height: 1;
    }
    #xp-upsell-dismiss:hover { color: #374151; }
  `;

  // カテゴリ別アイコン（絵文字で軽量に）
  const CAT_ICON = {
    Banking: "🏦",
    Sales: "📄",
    Purchases: "🧾",
    Accounting: "📊",
    Reports: "📈",
    Contacts: "👤",
    Navigation: "🏠",
  };

  // ─────────────────────────────────────────
  // 4. パレット UI の構築
  // ─────────────────────────────────────────
  let selIdx = 0;
  let visibleItems = [];
  let topPages = [];

  // ─────────────────────────────────────────
  // プラットフォーム判定
  //   ユーザーの64%がChromeOS。⌘ キーは存在しないので Ctrl 表記に切り替える。
  //   navigator.platform は非推奨のため userAgentData を優先。
  //   ChromeOS: userAgentData.platform="Chrome OS" / platform="Linux x86_64" → 非Mac
  // ─────────────────────────────────────────
  // ⚠️ 大文字小文字を無視すること: userAgentData.platform は "macOS"（小文字m）、
  //    navigator.platform は "MacIntel"。/i が無いと Mac を取りこぼす。
  const IS_MAC    = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform || "");
  const MOD_LABEL = IS_MAC ? "⌘" : "Ctrl+";

  // カスタムショートカット（Pro）。ここは常に「実キー1文字（小文字）」を保持する。
  let SC = { palette: 'k', match: 'm', create: 'c', transfer: 't', discuss: 'd' };

  // 表示文字列（"⌘K" / "Ctrl+J" / "J"）から実キー1文字を取り出す
  function parseKey(s, fallback) {
    const m = String(s || "").match(/([a-z0-9])\s*$/i);
    return m ? m[1].toLowerCase() : fallback;
  }

  function applyShortcuts(s) {
    s = s || {};
    SC.palette  = parseKey(s.palette,  'k');
    SC.match    = parseKey(s.match,    'm');
    SC.create   = parseKey(s.create,   'c');
    SC.transfer = parseKey(s.transfer, 't');
    SC.discuss  = parseKey(s.discuss,  'd');
  }

  // storageからショートカット設定を読み込む
  chrome.storage.local.get(['xp_shortcuts'])
    .then(data => applyShortcuts(data.xp_shortcuts))
    .catch(() => {});

  // options で変更したらタブ再読込なしで反映
  chrome.storage.onChanged?.addListener((changes, area) => {
    if (area === "local" && changes.xp_shortcuts) applyShortcuts(changes.xp_shortcuts.newValue);
  });

  function loadTopPages() {
    if (!chrome?.storage?.local) return Promise.resolve();
    return chrome.storage.local.get(["xp_usage"]).then((data) => {
      const usage = data.xp_usage || {};
      topPages = Object.entries(usage)
        .filter(([, n]) => n >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label]) => PAGES.find((p) => p.label === label))
        .filter(Boolean);
    }).catch(() => { topPages = []; });
  }

  function trackUsage(label) {
    if (!chrome?.storage?.local) return;
    chrome.storage.local.get(["xp_usage"]).then((data) => {
      const usage = data.xp_usage || {};
      usage[label] = (usage[label] || 0) + 1;
      chrome.storage.local.set({ xp_usage: usage });
    }).catch(() => {});
  }

  function injectCss() {
    if (document.getElementById("xp-styles")) return;
    const el = document.createElement("style");
    el.id = "xp-styles";
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function groupBy(items) {
    const map = new Map();
    for (const item of items) {
      if (!map.has(item.cat)) map.set(item.cat, []);
      map.get(item.cat).push(item);
    }
    return map;
  }

  function makeItemHtml(item, idx, selected) {
    return `
      <div class="xp-item ${selected ? "xp-sel" : ""}" data-idx="${idx}">
        <div class="xp-item-left">
          <div class="xp-icon">${CAT_ICON[item.cat] ?? "📌"}</div>
          <div class="xp-item-text">
            <div class="xp-label">${item.label}</div>
            <div class="xp-sub">${item.sub ?? ""}</div>
          </div>
        </div>
        <span class="xp-cat">${item.cat}</span>
      </div>`;
  }

  function renderList(items, query = "") {
    const list = document.getElementById("xp-list");
    if (!list) return;

    const allItems = [];
    let html = "";
    let flatIdx = 0;

    // ── Most used セクション（検索中は非表示）──
    if (!query && topPages.length > 0) {
      html += `<div class="xp-group-label xp-group-label--top">⭐ Most used</div>`;
      for (const item of topPages) {
        html += makeItemHtml(item, flatIdx, flatIdx === selIdx);
        allItems.push(item);
        flatIdx++;
      }
      html += `<div class="xp-group-divider"></div>`;
    }

    if (items.length === 0) {
      if (query) {
        list.innerHTML = '<div id="xp-empty">No results — try another keyword</div>';
        visibleItems = [];
        return;
      }
    }

    const groups = groupBy(items);
    groups.forEach((groupItems, cat) => {
      html += `<div class="xp-group-label">${cat}</div>`;
      for (const item of groupItems) {
        html += makeItemHtml(item, flatIdx, flatIdx === selIdx);
        allItems.push(item);
        flatIdx++;
      }
    });

    visibleItems = allItems;
    selIdx = Math.min(selIdx, Math.max(0, allItems.length - 1));
    list.innerHTML = html;
    list.querySelectorAll(".xp-item").forEach((el) => {
      el.addEventListener("mouseenter", () => {
        selIdx = +el.dataset.idx;
        highlight();
      });
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        go(visibleItems[+el.dataset.idx]);
      });
    });
  }

  function highlight() {
    document.querySelectorAll(".xp-item").forEach((el, i) => {
      el.classList.toggle("xp-sel", i === selIdx);
    });
    const sel = document.querySelector(".xp-item.xp-sel");
    if (sel) sel.scrollIntoView({ block: "nearest" });
  }

  function moveSel(dir) {
    selIdx = Math.max(0, Math.min(visibleItems.length - 1, selIdx + dir));
    highlight();
  }

  function go(item) {
    if (!item) return;
    trackUsage(item.label);
    closePalette();
    window.location.href = buildUrl(item.path);
  }

  function openPalette() {
    if (document.getElementById("xp-backdrop")) return;
    injectCss();
    selIdx = 0;

    const backdrop = document.createElement("div");
    backdrop.id = "xp-backdrop";
    backdrop.innerHTML = `
      <div id="xp-box">
        <div id="xp-search-row">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input id="xp-input" placeholder="Go to… (reconcile, invoices, P&amp;L…)" autocomplete="off" spellcheck="false" />
          <span id="xp-esc">ESC</span>
        </div>
        <div id="xp-list"></div>
        <div id="xp-footer">
          <span class="xp-hint"><span class="xp-key">↑↓</span> navigate</span>
          <span class="xp-hint"><span class="xp-key">↵</span> go</span>
          <span class="xp-hint"><span class="xp-key">ESC</span> close</span>
          <span id="xp-footer-logo">Xero Power</span>
        </div>
      </div>`;

    document.body.appendChild(backdrop);

    const input = document.getElementById("xp-input");
    input.focus();

    loadTopPages().then(() => {
      renderList(PAGES);
      showUpsellIfEligible();
    });

    input.addEventListener("input", () => {
      selIdx = 0;
      const q = input.value;
      renderList(q ? search(q) : PAGES, q);
    });

    // Backdrop クリックで閉じる
    backdrop.addEventListener("mousedown", (e) => {
      if (e.target === backdrop) closePalette();
    });

    document.getElementById("xp-esc").addEventListener("click", closePalette);
  }

  function closePalette() {
    document.getElementById("xp-backdrop")?.remove();
  }

  function togglePalette() {
    document.getElementById("xp-backdrop") ? closePalette() : openPalette();
  }

  // ─────────────────────────────────────────
  // 課金マイルストーン：10回ナビ達成後にパレットフッターへ1行表示
  // ─────────────────────────────────────────
  function showUpsellIfEligible() {
    if (!chrome?.storage?.local) return;
    chrome.storage.local.get(['xp_usage', 'xp_upsell_shown', 'xp_pro']).then(data => {
      if (data.xp_pro || data.xp_upsell_shown) return;
      const navTotal = Object.values(data.xp_usage || {}).reduce((a, n) => a + n, 0);
      if (navTotal < 10) return;
      showPaletteUpsell(navTotal);
    }).catch(() => {});
  }

  function showPaletteUpsell(navTotal) {
    const footer = document.getElementById('xp-footer');
    if (!footer || document.getElementById('xp-upsell-bar')) return;

    const minSaved = Math.ceil(navTotal * 0.5);
    const bar = document.createElement('div');
    bar.id = 'xp-upsell-bar';
    bar.innerHTML =
      `<span id="xp-upsell-text">⚡ ${navTotal} navigations · ~${minSaved} min saved</span>` +
      `<a id="xp-upsell-link">Try Pro →</a>` +
      `<span id="xp-upsell-dismiss" title="Dismiss">×</span>`;
    footer.before(bar);

    document.getElementById('xp-upsell-link').addEventListener('mousedown', e => {
      e.preventDefault();
      chrome.storage.local.set({ xp_upsell_shown: true });
      closePalette();
      window.open(chrome.runtime.getURL('options.html'));
    });

    document.getElementById('xp-upsell-dismiss').addEventListener('mousedown', e => {
      e.preventDefault();
      chrome.storage.local.set({ xp_upsell_shown: true });
      bar.remove();
    });
  }

  // ─────────────────────────────────────────
  // 5. Bank Rec キーボードショートカット
  //    DOM構造（DevToolsで確認済み）:
  //    a.t1=Match / a.t2=Create / a.t3=Transfer / a.t4=Discuss
  //    各トランザクション行 = div.line（#statementLines の直下）
  // ─────────────────────────────────────────
  let brActive     = false; // Bank Rec モードが有効か
  let brIdx        = 0;     // 現在フォーカスしている行インデックス
  let brLastAction = null;  // 直前のアクション種別: 'match'|'create'|'transfer'|'discuss'

  function brLines() {
    return [...document.querySelectorAll("#statementLines .line")];
  }

  function brHighlight(lines, idx) {
    lines.forEach((l, i) => {
      l.style.outline         = i === idx ? "2px solid #0a7a4b" : "";
      l.style.backgroundColor = i === idx ? "#f0fff8" : "";
      l.style.borderRadius    = i === idx ? "6px" : "";
    });
    lines[idx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function brRescan() {
    setTimeout(() => {
      const next = brLines();
      brIdx = Math.min(brIdx, Math.max(0, next.length - 1));
      brHighlight(next, brIdx);
    }, 350);
  }

  function brClickAction(actionClass, actionType) {
    brLastAction = actionType;
    const lines = brLines();
    const line  = lines[brIdx];
    if (!line) return;
    const btn = line.querySelector(actionClass);
    if (!btn) return;
    btn.click();
    // Create/Transfer後: フォームの最初のinputにフォーカスして即入力できるように
    if (actionType === "create" || actionType === "transfer") {
      setTimeout(() => {
        const input = line.querySelector('input:not([type="hidden"]), select, textarea');
        input?.focus();
      }, 150);
    }
    brRescan();
  }

  function brConfirm() {
    const lines = brLines();
    const line  = lines[brIdx];
    if (!line) return;
    if (brLastAction === "match") {
      line.querySelector("a.okayButton")?.click();
    } else if (brLastAction === "create" || brLastAction === "transfer") {
      line.querySelector("button.save-button")?.click();
    }
    brLastAction = null;
    brRescan();
  }

  function brShowBar() {
    if (document.getElementById("xp-br-bar")) return;
    const anchor = document.getElementById("ItemsToReconcile");
    if (!anchor) return;
    const bar = document.createElement("div");
    bar.id = "xp-br-bar";
    bar.style.cssText = [
      "position:sticky", "top:0", "z-index:200",
      "background:#0a7a4b", "color:#fff",
      "padding:6px 14px", "font:12px/1.6 -apple-system,sans-serif",
      "display:flex", "gap:18px", "align-items:center",
      "border-radius:0 0 8px 8px", "margin-bottom:6px",
      "box-shadow:0 2px 8px rgba(0,0,0,.15)",
    ].join(";");
    bar.innerHTML = [
      "<strong>Xero Power</strong>",
      "<span><b style='background:rgba(255,255,255,.25);border-radius:3px;padding:1px 5px'>↑↓</b> navigate</span>",
      "<span><b style='background:rgba(255,255,255,.25);border-radius:3px;padding:1px 5px'>M</b> Match</span>",
      "<span><b style='background:rgba(255,255,255,.25);border-radius:3px;padding:1px 5px'>C</b> Create</span>",
      "<span><b style='background:rgba(255,255,255,.25);border-radius:3px;padding:1px 5px'>T</b> Transfer</span>",
      "<span><b style='background:rgba(255,255,255,.25);border-radius:3px;padding:1px 5px'>D</b> Discuss</span>",
      "<span><b style='background:rgba(255,255,255,.25);border-radius:3px;padding:1px 5px'>↵</b> OK / Save</span>",
    ].join("");
    anchor.insertBefore(bar, anchor.firstChild);
  }

  function brTeardown() {
    brActive = false;
    document.getElementById("xp-br-bar")?.remove();
    brLines().forEach((l) => {
      l.style.outline = l.style.backgroundColor = l.style.borderRadius = "";
    });
  }

  function brInit() {
    if (brActive) return;
    // #ItemsToReconcile が存在しない場合はまだDOMが準備できていない
    if (!document.getElementById("ItemsToReconcile")) return;
    brActive = true;
    brIdx    = 0;
    brShowBar();
    const lines = brLines();
    if (lines.length) brHighlight(lines, 0);
    console.log("%c[Xero Power] Bank Rec shortcuts ✅  ↑↓ M C T D", "color:#0a7a4b;font-weight:bold");
  }

  // ─────────────────────────────────────────
  // 6. グローバルキーボードイベント
  // ─────────────────────────────────────────
  window.addEventListener(
    "keydown",
    (e) => {
      // ── ⌘K / Ctrl+K：パレット開閉（最優先）──
      // SC.palette は options で変更可（Pro）。ChromeOS の検索キーも metaKey を発火する。
      if ((e.metaKey || e.ctrlKey) && (e.key || "").toLowerCase() === SC.palette) {
        e.preventDefault();
        e.stopPropagation();
        togglePalette();
        return;
      }

      // ── パレットが開いている間はパレット操作のみ ──
      if (document.getElementById("xp-backdrop")) {
        if (e.key === "Escape")    { e.preventDefault(); closePalette(); }
        else if (e.key === "ArrowDown") { e.preventDefault(); moveSel(+1); }
        else if (e.key === "ArrowUp")   { e.preventDefault(); moveSel(-1); }
        else if (e.key === "Enter")     { e.preventDefault(); go(visibleItems[selIdx]); }
        return;
      }

      // ── Bank Rec ショートカット ──
      // 入力欄にフォーカスがある / 修飾キーあり → スキップ
      if (!brActive) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const lines = brLines();
      if (!lines.length) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          brIdx = Math.min(brIdx + 1, lines.length - 1);
          brLastAction = null;
          brHighlight(lines, brIdx);
          break;
        case "ArrowUp":
          e.preventDefault();
          brIdx = Math.max(brIdx - 1, 0);
          brLastAction = null;
          brHighlight(lines, brIdx);
          break;
        case "Enter":
          if (brLastAction) { e.preventDefault(); brConfirm(); }
          break;
        default: {
          const k = e.key.toLowerCase();
          if (k === SC.match)         { e.preventDefault(); brClickAction("a.t1", "match"); }
          else if (k === SC.create)   { e.preventDefault(); brClickAction("a.t2", "create"); }
          else if (k === SC.transfer) { e.preventDefault(); brClickAction("a.t3", "transfer"); }
          else if (k === SC.discuss)  { e.preventDefault(); brClickAction("a.t4", "discuss"); }
        }
      }
    },
    true
  );

  // ─────────────────────────────────────────
  // 6.5 新インボイス：Approve を既定アクションに
  //   背景: 新インボイスの主ボタンは「Approve & email」。
  //   "Approveだけを既定に" は Product Ideas で440票だが Xero は実装拒否(2026-01)。
  //   競合拡張ゼロ＝空き地。これを無料機能として埋める。
  //
  //   セレクタは実Xero(2026-06-23 Demo Company)でライブ確認済み:
  //     主=button「Approve & email」(子要素なしの直テキストノード)
  //     ▾=button[aria-haspopup="listbox"][aria-label="More approve options"]
  //     メニュー=li[role="option"]、項目textは "ApproveCmd-Opt-A" (ショートカット同梱)
  //   主ボタンを特定できた時だけ作動し、見つからなければネイティブ挙動には
  //   一切触れない（安全側）。ラベルも「Approve」に張り替えるので "見たまま実行"。
  // ─────────────────────────────────────────
  let iaEnabled = true; // xp_invoice_approve_default（既定ON・無料）

  if (chrome?.storage?.local) {
    chrome.storage.local.get(["xp_invoice_approve_default"]).then((d) => {
      iaEnabled = d.xp_invoice_approve_default !== false;
      if (iaEnabled && isInvoicingPage()) iaApply();
      else if (!iaEnabled) iaRestore();
    }).catch(() => {});

    // options でトグルしたら再読込なしで反映
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.xp_invoice_approve_default) return;
      iaEnabled = changes.xp_invoice_approve_default.newValue !== false;
      if (iaEnabled && isInvoicingPage()) iaApply();
      else iaRestore();
    });
  }

  function isInvoicingPage() {
    return location.pathname.toLowerCase().includes("invoicing");
  }

  function iaNorm(s) {
    return (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  // 主ボタン（Approve & email）をテキスト一致で特定
  function iaFindPrimary() {
    return [...document.querySelectorAll("button")].find((b) => {
      const t = iaNorm(b.textContent);
      return t === "approve & email" || t === "approve and email";
    }) || null;
  }

  // 主ボタン隣のドロップダウン（▾）トグルを推定
  function iaFindCaret(primary) {
    if (!primary) return null;
    let scope = primary.parentElement;
    for (let i = 0; i < 3 && scope; i++, scope = scope.parentElement) {
      const caret = [...scope.querySelectorAll("button")].find(
        (b) =>
          b !== primary &&
          (b.getAttribute("aria-haspopup") ||
            b.hasAttribute("aria-expanded") ||
            /more|option|approve/i.test(b.getAttribute("aria-label") || ""))
      );
      if (caret) return caret;
    }
    return null;
  }

  // ラベルを書き換える（子要素/アイコンを壊さない）
  // 実DOM(2026-06-23 Demo Co確認): 「Approve & email」は子要素ゼロの直テキストノード。
  function iaSetLabel(btn, text) {
    // ① 直下のテキストノードがあればそれだけ差し替え
    const tnode = [...btn.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (tnode) { tnode.textContent = text; return; }
    // ② 子要素内の最深テキスト要素
    const el = [...btn.querySelectorAll("*")].reverse().find((e) => e.children.length === 0 && e.textContent.trim());
    if (el) { el.textContent = text; return; }
    // ③ 最終手段
    btn.textContent = text;
  }

  // 主ボタンのラベルを「Approve」に張り替える（React再描画はObserverで再適用）
  function iaApply() {
    if (!iaEnabled) return;
    const primary = iaFindPrimary();
    if (!primary) return;                // 見つからなければネイティブ維持
    if (!iaFindCaret(primary)) return;   // emailを逃がす▾が無いなら触らない
    if (primary.dataset.xpApprove === "1") return;
    primary.dataset.xpOrigLabel = primary.textContent.trim();
    iaSetLabel(primary, "Approve");
    primary.dataset.xpApprove = "1";
    primary.title = "Approve only — Xero Power. Use ▾ to approve and email.";
    console.log("%c[Xero Power] Invoicing: default set to Approve ✅", "color:#0a7a4b;font-weight:bold");
  }

  function iaRestore() {
    const primary = document.querySelector('button[data-xp-approve="1"]');
    if (!primary) return;
    if (primary.dataset.xpOrigLabel) iaSetLabel(primary, primary.dataset.xpOrigLabel);
    delete primary.dataset.xpApprove;
    primary.title = "";
  }

  // クリックを乗っ取り、ドロップダウンの「Approve」を代理クリック
  function iaRunApprove(primary) {
    const caret = iaFindCaret(primary);
    if (!caret) return;
    caret.click(); // メニューを開く
    iaWaitApprove(0);
  }

  // 「Approveのみ」の項目か判定。
  // 実DOM(2026-06-23 Demo Co確認): 項目のtextContentはショートカット表記を同梱し
  // "ApproveCmd-Opt-A" になる。完全一致では取れないので前方一致＋「& / and」除外で判定。
  function iaIsPlainApprove(el, self) {
    if (el === self) return false;
    const t = iaNorm(el.textContent);
    if (t === "approve") return true;
    return t.startsWith("approve") && !t.startsWith("approve &") && !t.startsWith("approve and");
  }

  function iaWaitApprove(attempt) {
    const self = document.querySelector('button[data-xp-approve="1"]');
    // listbox/menu の項目を優先、無ければ button/a にフォールバック
    const item =
      [...document.querySelectorAll('[role="option"],[role="menuitem"]')].find((el) => iaIsPlainApprove(el, self)) ||
      [...document.querySelectorAll("button,a")].find((el) => iaIsPlainApprove(el, self));
    if (item) { item.click(); return; }
    if (attempt < 8) { setTimeout(() => iaWaitApprove(attempt + 1), 60); return; }
    // 見つからなければ誤送信せず、メニューを開いたままユーザーに委ねる
    console.warn("[Xero Power] Approve menu item not found — falling back to manual selection.");
  }

  // ラベル張り替えはSPA再描画で消えるため、Observerで貼り直す（debounce）
  let iaPending = false;
  const iaObserver = new MutationObserver(() => {
    if (iaPending) return;
    iaPending = true;
    requestAnimationFrame(() => {
      iaPending = false;
      if (iaEnabled && isInvoicingPage()) iaApply();
    });
  });

  function iaStart() {
    if (document.body) iaObserver.observe(document.body, { childList: true, subtree: true });
    iaApply();
  }
  function iaStop() {
    iaObserver.disconnect();
    iaRestore();
  }

  // クリック乗っ取り（capture, 1度だけ登録）
  window.addEventListener(
    "click",
    (e) => {
      if (!iaEnabled) return;
      const btn = e.target.closest?.('button[data-xp-approve="1"]');
      if (!btn) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      iaRunApprove(btn);
    },
    true
  );

  // ─────────────────────────────────────────
  // 6.6 Bills：「Approve and view next」を既定アクションに
  //   背景: Draft Billを複数処理するとき、1件ごとに一覧に戻る手間がある。
  //   「Approve and view next」を既定にすると承認後に次のBillへ自動遷移。
  //   ユーザーリクエスト(Logical_Sea2630, r/xero 2026-06-30)を受けて実装。
  //   無料機能。インボイス版(6.5)と同パターン。
  //
  //   ⚠️ BA_READY = false: Bills実DOMのセレクタ未確定のため一時無効化。
  //   確認後 true に戻す。
  // ─────────────────────────────────────────
  const BA_READY = false; // TODO: Bills DOM確認後に true に戻す
  let baEnabled = true; // xp_bill_approve_view_next（既定ON・無料）

  if (chrome?.storage?.local) {
    chrome.storage.local.get(["xp_bill_approve_view_next"]).then((d) => {
      baEnabled = d.xp_bill_approve_view_next !== false;
      if (baEnabled && isBillPage()) baApply();
      else if (!baEnabled) baRestore();
    }).catch(() => {});

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.xp_bill_approve_view_next) return;
      baEnabled = changes.xp_bill_approve_view_next.newValue !== false;
      if (baEnabled && isBillPage()) baApply();
      else baRestore();
    });
  }

  function isBillPage() {
    const path = location.pathname.toLowerCase();
    return path.includes("/bills/") &&
           !path.includes("/bills/list") &&
           !path.includes("/bills/create");
  }

  function baNorm(s) {
    return (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  // 主ボタン（Approve）をテキスト一致で特定
  function baFindPrimary() {
    return [...document.querySelectorAll("button")].find((b) => {
      const t = baNorm(b.textContent);
      return t === "approve";
    }) || null;
  }

  // ▾ドロップダウンボタンを特定（インボイス版と同じロジック）
  function baFindCaret(primary) {
    if (!primary) return null;
    let scope = primary.parentElement;
    for (let i = 0; i < 3 && scope; i++, scope = scope.parentElement) {
      const caret = [...scope.querySelectorAll("button")].find(
        (b) =>
          b !== primary &&
          (b.getAttribute("aria-haspopup") ||
            b.hasAttribute("aria-expanded") ||
            /more|option|approve/i.test(b.getAttribute("aria-label") || ""))
      );
      if (caret) return caret;
    }
    return null;
  }

  function baSetLabel(btn, text) {
    const tnode = [...btn.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (tnode) { tnode.textContent = text; return; }
    const el = [...btn.querySelectorAll("*")].reverse().find((e) => e.children.length === 0 && e.textContent.trim());
    if (el) { el.textContent = text; return; }
    btn.textContent = text;
  }

  function baApply() {
    if (!BA_READY || !baEnabled) return;
    const primary = baFindPrimary();
    if (!primary) return;
    const caret = baFindCaret(primary);
    if (!caret) return; // ▾がなければ触らない
    if (primary.dataset.xpBillApprove === "1") return;
    primary.dataset.xpOrigLabel = primary.textContent.trim();
    baSetLabel(primary, "Approve and view next");
    primary.dataset.xpBillApprove = "1";
    primary.title = "Approve and view next — Xero Power. Use ▾ for other approve options.";
    console.log("%c[Xero Power] Bills: default set to Approve and view next ✅", "color:#0a7a4b;font-weight:bold");
  }

  function baRestore() {
    const primary = document.querySelector('button[data-xp-bill-approve="1"]');
    if (!primary) return;
    if (primary.dataset.xpOrigLabel) baSetLabel(primary, primary.dataset.xpOrigLabel);
    delete primary.dataset.xpBillApprove;
    primary.title = "";
  }

  // 「Approve and view next」項目か判定
  function baIsApproveViewNext(el, self) {
    if (el === self) return false;
    const t = baNorm(el.textContent);
    return t.startsWith("approve and view") || t.startsWith("approve & view");
  }

  function baRunApprove(primary) {
    const caret = baFindCaret(primary);
    if (!caret) return;
    caret.click();
    baWaitApprove(0);
  }

  function baWaitApprove(attempt) {
    const self = document.querySelector('button[data-xp-bill-approve="1"]');
    const item =
      [...document.querySelectorAll('[role="option"],[role="menuitem"]')].find((el) => baIsApproveViewNext(el, self)) ||
      [...document.querySelectorAll("button,a")].find((el) => baIsApproveViewNext(el, self));
    if (item) { item.click(); return; }
    if (attempt < 8) { setTimeout(() => baWaitApprove(attempt + 1), 60); return; }
    console.warn("[Xero Power] 'Approve and view next' not found — falling back to manual selection.");
  }

  let baPending = false;
  const baObserver = new MutationObserver(() => {
    if (baPending) return;
    baPending = true;
    requestAnimationFrame(() => {
      baPending = false;
      if (baEnabled && isBillPage()) baApply();
    });
  });

  function baStart() {
    if (document.body) baObserver.observe(document.body, { childList: true, subtree: true });
    baApply();
  }
  function baStop() {
    baObserver.disconnect();
    baRestore();
  }

  // Bills クリック乗っ取り
  window.addEventListener(
    "click",
    (e) => {
      if (!baEnabled) return;
      const btn = e.target.closest?.('button[data-xp-bill-approve="1"]');
      if (!btn) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      baRunApprove(btn);
    },
    true
  );

  // ─────────────────────────────────────────
  // 7. ページ別機能の起動 / 終了
  // ─────────────────────────────────────────
  function bootFeatures() {
    closePalette();
    const path = location.pathname.toLowerCase();

    if (path.includes("bankrec")) {
      // DOMの準備を待ってから初期化
      const tryInit = (attempts = 0) => {
        if (document.getElementById("ItemsToReconcile")) {
          brInit();
        } else if (attempts < 20) {
          setTimeout(() => tryInit(attempts + 1), 300);
        }
      };
      tryInit();
    } else {
      brTeardown();
    }

    // 新インボイス：Approve 既定機能
    if (path.includes("invoicing")) iaStart();
    else iaStop();

    // Bills：Approve and view next 既定機能
    if (isBillPage()) baStart();
    else baStop();
  }

  // ─────────────────────────────────────────
  // 8. SPA 遷移対応
  // ─────────────────────────────────────────
  const _push = history.pushState.bind(history);
  history.pushState = function (...a) {
    _push(...a);
    setTimeout(bootFeatures, 100);
  };
  window.addEventListener("popstate", () => setTimeout(bootFeatures, 100));

  // 初回起動
  bootFeatures();

  // ─────────────────────────────────────────
  // 9. オンボーディングトースト（初回1回のみ）
  // ─────────────────────────────────────────
  const TOAST_CSS = `
    #xp-toast {
      position: fixed;
      bottom: 24px; right: 24px;
      z-index: 2147483647;
      width: 320px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.06);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      animation: xp-toast-in .3s cubic-bezier(.16,1,.3,1);
    }
    @keyframes xp-toast-in {
      from { transform: translateY(16px); opacity: 0; }
      to   { transform: none; opacity: 1; }
    }
    #xp-toast.xp-toast-out {
      animation: xp-toast-out .3s ease forwards;
    }
    @keyframes xp-toast-out {
      to { transform: translateY(16px); opacity: 0; }
    }
    #xp-toast-header {
      background: #0a7a4b;
      color: #fff;
      padding: 10px 14px;
      display: flex; align-items: center; justify-content: space-between;
    }
    #xp-toast-title { font-size: 13px; font-weight: 700; }
    #xp-toast-close {
      cursor: pointer; font-size: 18px; line-height: 1;
      color: rgba(255,255,255,.7);
      background: none; border: none; padding: 0;
    }
    #xp-toast-close:hover { color: #fff; }
    #xp-toast-body {
      padding: 12px 14px;
      font-size: 13px; color: #374151; line-height: 1.5;
    }
    #xp-toast-body strong { color: #111827; }
    #xp-toast-tip {
      margin-top: 8px; padding: 8px 10px;
      background: #f0fdf4; border-radius: 6px;
      font-size: 12px; color: #166534;
    }
    .xp-toast-key {
      background: #dcfce7; border: 1px solid #86efac;
      border-radius: 3px; padding: 0 5px;
      font-weight: 600; font-family: monospace; font-size: 12px;
    }
    #xp-toast-link {
      display: block; margin-top: 10px; text-align: right;
      font-size: 12px; color: #0a7a4b; font-weight: 600;
      cursor: pointer; text-decoration: none;
    }
    #xp-toast-link:hover { text-decoration: underline; }
  `;

  function showOnboardingToast() {
    if (!chrome?.storage?.local) return;
    chrome.storage.local.get(['onboarding_toast_shown']).then(data => {
      if (data.onboarding_toast_shown) return;

      const style = document.createElement('style');
      style.id = 'xp-toast-styles';
      style.textContent = TOAST_CSS;
      document.head.appendChild(style);

      const toast = document.createElement('div');
      toast.id = 'xp-toast';
      const shortcut = MOD_LABEL + SC.palette.toUpperCase();
      toast.innerHTML =
        `<div id="xp-toast-header">` +
          `<span id="xp-toast-title">Xero Power is active ✓</span>` +
          `<button id="xp-toast-close" title="Dismiss">×</button>` +
        `</div>` +
        `<div id="xp-toast-body">` +
          `Your default button is now <strong>Approve</strong> — email is still one click away.` +
          `<div id="xp-toast-tip">` +
            `💡 Press <span class="xp-toast-key">${shortcut}</span> to jump anywhere in Xero` +
          `</div>` +
          `<a id="xp-toast-link">Show me what it does →</a>` +
        `</div>`;
      document.body.appendChild(toast);

      let dismissed = false;
      function dismiss() {
        if (dismissed) return;
        dismissed = true;
        chrome.storage.local.set({ onboarding_toast_shown: true });
        toast.classList.add('xp-toast-out');
        setTimeout(() => toast.remove(), 300);
      }

      document.getElementById('xp-toast-close').addEventListener('click', dismiss);
      document.getElementById('xp-toast-link').addEventListener('click', () => {
        dismiss();
        window.open(chrome.runtime.getURL('welcome.html'), '_blank');
      });

      setTimeout(dismiss, 8000);
    }).catch(() => {});
  }

  showOnboardingToast();

  console.log(
    `%c[Xero Power] v${window.__xeroPower} ✅  ${MOD_LABEL}K palette | Most used | Bank Rec: ↑↓ M C T D ↵ | Invoicing: Approve by default | Pro: options page`,
    "color:#0a7a4b;font-weight:bold;font-size:13px"
  );
})();
