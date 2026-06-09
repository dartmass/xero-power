/**
 * Xero Power — content.js  v0.1.0
 * MVP: Command Palette (⌘K / Ctrl+K)
 *
 * Xero上の任意のページで ⌘K を押すと、
 * Xeroの全画面にファジー検索でジャンプできるコマンドパレットが開く。
 * RightTool（QBO版）の「250+ショートカット」をXeroに持ち込む最初の一手。
 */
(() => {
  "use strict";

  // 二重読み込み防止
  if (window.__xeroPower) return;
  window.__xeroPower = "0.1.0";

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

  function renderList(items) {
    visibleItems = items;
    selIdx = Math.min(selIdx, Math.max(0, items.length - 1));
    const list = document.getElementById("xp-list");
    if (!list) return;

    if (items.length === 0) {
      list.innerHTML = '<div id="xp-empty">No results — try another keyword</div>';
      return;
    }

    const groups = groupBy(items);
    let html = "";
    let flatIdx = 0;

    groups.forEach((groupItems, cat) => {
      html += `<div class="xp-group-label">${cat}</div>`;
      for (const item of groupItems) {
        const idx = flatIdx++;
        html += `
          <div class="xp-item ${idx === selIdx ? "xp-sel" : ""}" data-idx="${idx}">
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
    });

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
    renderList(PAGES);

    const input = document.getElementById("xp-input");
    input.focus();

    input.addEventListener("input", () => {
      selIdx = 0;
      renderList(search(input.value));
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
  // 5. Bank Rec キーボードショートカット
  //    DOM構造（DevToolsで確認済み）:
  //    a.t1=Match / a.t2=Create / a.t3=Transfer / a.t4=Discuss
  //    各トランザクション行 = div.line（#statementLines の直下）
  // ─────────────────────────────────────────
  let brActive = false;   // Bank Rec モードが有効か
  let brIdx    = 0;       // 現在フォーカスしている行インデックス

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

  function brClickAction(actionClass) {
    const lines = brLines();
    const line  = lines[brIdx];
    if (!line) return;
    const btn = line.querySelector(actionClass);
    if (!btn) return;
    btn.click();
    // クリック後に行が消える場合があるので 350ms 後に再スキャン
    setTimeout(() => {
      const next = brLines();
      brIdx = Math.min(brIdx, Math.max(0, next.length - 1));
      brHighlight(next, brIdx);
    }, 350);
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
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
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
          brHighlight(lines, brIdx);
          break;
        case "ArrowUp":
          e.preventDefault();
          brIdx = Math.max(brIdx - 1, 0);
          brHighlight(lines, brIdx);
          break;
        case "m": case "M": e.preventDefault(); brClickAction("a.t1"); break;
        case "c": case "C": e.preventDefault(); brClickAction("a.t2"); break;
        case "t": case "T": e.preventDefault(); brClickAction("a.t3"); break;
        case "d": case "D": e.preventDefault(); brClickAction("a.t4"); break;
      }
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

  console.log(
    "%c[Xero Power] v0.2.0 ✅  ⌘K パレット | Bank Rec: ↑↓ M C T D",
    "color:#0a7a4b;font-weight:bold;font-size:13px"
  );
})();
