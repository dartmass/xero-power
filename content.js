/**
 * Xero Power — content.js  v0.9.0
 * MVP: Command Palette (⌘K / Ctrl+K)
 *
 * Xero上の任意のページで ⌘K を押すと、
 * Xeroの全画面にファジー検索でジャンプできるコマンドパレットが開く。
 * RightTool（QBO版）の「250+ショートカット」をXeroに持ち込む最初の一手。
 *
 * v0.5.0: 新インボイスの既定ボタンを「Approve & email」→「Approve」に変更。
 *         Product Ideasで440票・Xeroが実装拒否(2026-01)・競合拡張ゼロのwedge。
 * v0.6.0: Bank Rec に確定ショートカット(↵)を追加。
 * v0.7.0: 初回トースト + welcome.html + background.js（オンボーディング）。
 * v0.7.1: ChromeOS対応の修正。ユーザーの64%がChromeOSで ⌘ キーが存在しないため:
 *         ①パレットキーのPro設定が効いていなかったのを修正(SC.palette未参照 + "k"ハードコード)
 *         ②popup/optionsの「⌘K」固定表示をプラットフォーム判定で切替
 *         ③ショートカット変更をstorage.onChangedで即反映(以前はタブ再読込が必要)
 *         ④ユーザー可視テキストを英語化(ユーザーの89%が米国)
 * v0.8.0: アンインストール時の1問アンケート(background.js) + popupにフィードバック導線。
 *         プライバシーポリシーを実態(Polar/Google Forms)に合わせて全面改訂。
 * v0.9.0: Xero Product Ideas の「Xeroが開発予定なしと明言」131件から、
 *         拡張機能で解けるものを実装するシリーズ。
 *         ①組織ごとのナビバー配色(§6.7 / 308票)。複数クライアントを扱う
 *           簿記担当の「間違った組織に入力する」事故を防ぐ。無料2組織/Pro無制限。
 *         ②トラッキング必須化(§6.4 / 287票)。請求書とBillsの両方。事務所のコーディング統一。Practice Pro。
 *         ③ダークモード(§6.8 / 533票)。無料。
 *         ④パレット全28件を実Xeroで検証し直し、**15件が死んでいた**のを修正。
 *           ・レポート7件は reporting.xero.com へ移転（別ホスト）
 *           ・Quotes/Chart of Accounts/Manual Journals 等は旧.aspxが404
 *           ・Bank Reconciliation は accountId 無しだと homepage に飛ばされる
 *           ・New Bill の /app/{orgId}/bills/create は404
 *           検証済みURLのみに入れ替え、Xeroナビから拾った有用な行き先も追加して39件に。
 *         ⑤Solo Pro tools: organisation workspace launcher, top-of-list page controls,
 *           and remembered page size.
 *         ⑥Practice Pro tools: configurable description guardrail, locally observed Awaiting
 *           Approval queues, and a non-destructive Find & Recode Description index.
 */
(() => {
  "use strict";

  // 二重読み込み防止
  if (window.__xeroPower) return;
  window.__xeroPower = "0.9.0";

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

  // Bank Rec は accountId が無いと homepage にリダイレクトされる（実機確認済み）。
  // 最後に開いた口座を覚えておき、パレットからは直接その口座の照合画面へ飛ばす。
  // ⚠️ accountId は組織ごとに異なるので、必ず組織IDをキーにすること。
  //    使い回すと別組織の照合画面に飛ぶ事故になる。
  let brAccounts = {};   // { [orgId]: accountId }

  chrome.storage?.local?.get(["xp_bank_accounts"])
    .then((d) => { brAccounts = Object.assign({}, d.xp_bank_accounts, brAccounts); })
    .catch(() => {});

  // Bank Rec を開いたら、その口座を現在の組織に紐づけて記憶する。
  //
  // ⚠️ 保存はstorageを読んでから書く。メモリ上の brAccounts を信用すると、
  //    上の get() が後から解決したときに書いたばかりの値を潰す。
  // ⚠️ storage待ちの最中にページが遷移すると chrome が接続を切り、
  //    "The message port closed before a response was received" が
  //    未処理の例外としてコンソールに赤く出る（実機で確認）。
  //    実害は無いが出荷物としてよくないので、ここで飲み込む。
  async function brRememberAccount() {
    const acct = new URLSearchParams(location.search).get("accountId");
    const org  = ocOrgId();
    if (!acct || !org || !chrome?.storage?.local) return;
    try {
      const d   = await chrome.storage.local.get(["xp_bank_accounts"]);
      const map = d.xp_bank_accounts || {};
      if (map[org] === acct) return;
      map[org] = acct;
      brAccounts = map;
      await chrome.storage.local.set({ xp_bank_accounts: map });
      console.log(`%c[Xero Power] Remembered bank account for ${org}`, "color:#0a7a4b");
    } catch {
      /* 遷移でstorageが切れただけ。次の読み込みでまた記憶する。 */
    }
  }

  // ⚠️ 旧URL(BankRec.aspx)には組織IDが無く、ocOrgId() はXeroのナビに
  //    描画されるリンクから拾う。document_idle の時点ではまだ描画されておらず
  //    null が返るため、一度きりの呼び出しでは保存できない（実機で再現）。
  //    ナビが出るまで待ってから保存する。
  function brRememberAccountSoon(attempt = 0) {
    if (!new URLSearchParams(location.search).get("accountId")) return;
    // 別組織に着地したときに覚えると、その組織の記憶を他社の口座IDで汚す。
    // 次に正しく開いてもずっと間違った口座に飛ぶことになるので、判定を待つ。
    if (!navIntentResolved || !ocOrgId()) {
      if (attempt < 20) setTimeout(() => brRememberAccountSoon(attempt + 1), 300);
      return;
    }
    if (navMismatch) return;
    brRememberAccount();
  }

  function buildUrl(path) {
    if (path.includes("{bankAccountId}")) {
      const acct = brAccounts[ocOrgId()];
      // 未知なら口座一覧へ。そこから1クリックで照合に入れる。
      return "https://go.xero.com" + (acct
        ? path.replace("{bankAccountId}", encodeURIComponent(acct))
        : "/Bank/BankAccounts.aspx");
    }
    // レポートは reporting.xero.com という別ホスト。絶対URLをそのまま使う。
    const base = path.startsWith("https://") ? "" : "https://go.xero.com";
    if (!path.includes("{orgId}")) return base + path;
    // ocOrgId は旧URL(.aspx)でもDOMから組織IDを拾えるので、こちらを優先する
    const id = ocOrgId() || getOrgId();
    return id
      ? base + path.replace("{orgId}", id)
      : base + path.replace("/{orgId}", ""); // fallback
  }

  // ⚠️ 2026-08-01 全件を実Xeroで検証し直した。
  //    旧 .aspx URL の多くが廃止されており、28件中15件が404かhomepageに
  //    飛んでいた（レポート7件は reporting.xero.com という別ホストに移転）。
  //    ここに載せるのは「Xero自身のナビにあるURL」か「実際に遷移して確認したURL」だけ。
  //    確認できないものは載せない。死んだリンクを並べるくらいなら件数を減らす。
  const PAGES = [
    // ── Banking ──
    {
      label: "Bank Reconciliation",
      sub: "Match transactions from your bank",
      keys: "bank reconcile reconciliation match",
      path: "/BankRec/BankRec.aspx?accountId={bankAccountId}",
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
      path: "/app/bank-rules",
      cat: "Banking",
    },
    {
      label: "Bank Statements",
      sub: "Imported statement lines",
      keys: "bank statements imported lines",
      path: "/Bank/Statements.aspx",
      cat: "Banking",
    },
    {
      label: "Spend Money",
      sub: "Record a payment out",
      keys: "spend money payment out",
      path: "/Banking/Account/",
      cat: "Banking",
    },
    {
      label: "Transfer Money",
      sub: "Move money between accounts",
      keys: "transfer money between accounts",
      path: "/Bank/Transfer.aspx",
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
      path: "/Accounts/Receivable/Quotes/Search",
      cat: "Sales",
    },
    {
      label: "New Quote",
      sub: "Create a new quote",
      keys: "new quote estimate create",
      path: "/Accounts/Receivable/Quotes/New",
      cat: "Sales",
    },
    {
      label: "Sales Overview",
      sub: "Sales dashboard",
      keys: "sales overview dashboard",
      path: "/app/{orgId}/sales-overview",
      cat: "Sales",
    },
    {
      label: "Customers",
      sub: "People who owe you money",
      keys: "customers debtors clients",
      path: "/app/{orgId}/contacts/customers",
      cat: "Sales",
    },
    {
      label: "Products and Services",
      sub: "Your inventory items",
      keys: "products services inventory items",
      path: "/Accounts/Inventory",
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
      path: "/AccountsPayable/Edit.aspx",
      cat: "Purchases",
    },
    {
      label: "Purchase Orders",
      sub: "Purchase orders to suppliers",
      keys: "purchase orders PO",
      path: "/Accounts/Payable/PurchaseOrders/Search",
      cat: "Purchases",
    },
    {
      label: "New Purchase Order",
      sub: "Raise a purchase order",
      keys: "new purchase order PO create",
      path: "/Accounts/Payable/PurchaseOrders/New",
      cat: "Purchases",
    },
    {
      label: "Purchases Overview",
      sub: "Purchases dashboard",
      keys: "purchases overview dashboard",
      path: "/Accounts/Payable/Dashboard/",
      cat: "Purchases",
    },
    {
      label: "Suppliers",
      sub: "People you owe money to",
      keys: "suppliers creditors vendors",
      path: "/app/{orgId}/contacts/suppliers",
      cat: "Purchases",
    },

    // ── Accounting ──
    {
      label: "Chart of Accounts",
      sub: "Manage account codes",
      keys: "chart of accounts COA account codes",
      path: "/GeneralLedger/ChartOfAccounts.aspx",
      cat: "Accounting",
    },
    {
      label: "Manual Journals",
      sub: "Post manual journal entries",
      keys: "manual journals journal entries",
      path: "/Journal/Search.aspx",
      cat: "Accounting",
    },
    {
      label: "New Manual Journal",
      sub: "Post a new journal",
      keys: "new manual journal entry create",
      path: "/Journal/Edit.aspx",
      cat: "Accounting",
    },
    {
      label: "Find and Recode",
      sub: "Batch recode transactions",
      keys: "find recode batch bulk reclassify",
      path: "/Accounts/Recoding",
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
      label: "History and Notes",
      sub: "Everything that changed, and who changed it",
      keys: "history notes audit activity log",
      path: "/app/{orgId}/activity-summary",
      cat: "Accounting",
    },
    {
      label: "Assurance Dashboard",
      sub: "Spot unusual activity",
      keys: "assurance dashboard audit review",
      path: "/app/{orgId}/assurance-dashboard",
      cat: "Accounting",
    },
    {
      label: "Settings",
      sub: "Organisation settings",
      keys: "settings organisation preferences",
      path: "/app/{orgId}/settings",
      cat: "Accounting",
    },

    // ── Reports ──
    // ⚠️ レポートは go.xero.com ではなく reporting.xero.com。絶対URLで持つ。
    {
      label: "Profit & Loss",
      sub: "Income statement",
      keys: "profit loss P&L income statement",
      path: "https://reporting.xero.com/{orgId}/v2/Run/New/1016",
      cat: "Reports",
    },
    {
      label: "Balance Sheet",
      sub: "Assets, liabilities, equity",
      keys: "balance sheet assets liabilities equity",
      path: "https://reporting.xero.com/{orgId}/v2/Run/New/1017",
      cat: "Reports",
    },
    {
      label: "Aged Receivables",
      sub: "Who owes you money",
      keys: "aged receivables debtors outstanding",
      path: "https://reporting.xero.com/{orgId}/v2/Run/New/1001",
      cat: "Reports",
    },
    {
      label: "Aged Payables",
      sub: "What you owe suppliers",
      keys: "aged payables creditors outstanding",
      path: "https://reporting.xero.com/{orgId}/v2/Run/New/1000",
      cat: "Reports",
    },
    {
      label: "Account Transactions",
      sub: "Transactions by account",
      keys: "account transactions general ledger detail",
      path: "https://reporting.xero.com/{orgId}/v2/Run/New/1009",
      cat: "Reports",
    },
    {
      label: "All Reports",
      sub: "Browse every report",
      keys: "reports all list browse",
      path: "https://reporting.xero.com/{orgId}",
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
      path: "/app/{orgId}/projects",
      cat: "Navigation",
    },
    {
      label: "Short-term Cash Flow",
      sub: "Where your cash is heading",
      keys: "cash flow forecast short term",
      path: "/app/{orgId}/cashflow",
      cat: "Navigation",
    },
    {
      label: "Business Snapshot",
      sub: "Performance at a glance",
      keys: "business snapshot performance metrics",
      path: "/app/{orgId}/business-snapshot/",
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
  const MOD_LABEL = IS_MAC ? "Cmd+" : "Ctrl+";

  // カスタムショートカット（Solo Pro以上）。ここは常に「実キー1文字（小文字）」を保持する。
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
    brRenderBar();
  }

  function shortcutsCanCustomize(data) {
    if (data?.xp_plan) return data.xp_plan === 'pro' || data.xp_plan === 'practice';
    return data?.xp_pro === true;
  }

  // Freeでは保存済み設定を残しつつ、実際の操作は既定キーに戻す。
  function loadActiveShortcuts() {
    return chrome.storage.local.get(['xp_shortcuts', 'xp_pro', 'xp_plan'])
      .then(data => applyShortcuts(shortcutsCanCustomize(data) ? data.xp_shortcuts : null));
  }

  loadActiveShortcuts()
    .catch(() => {});

  // options で変更したらタブ再読込なしで反映
  chrome.storage.onChanged?.addListener((changes, area) => {
    if (
      area === "local" &&
      (changes.xp_shortcuts || changes.xp_pro || changes.xp_plan)
    ) loadActiveShortcuts().catch(() => {});
  });

  // Captured at document_start so Xero page handlers cannot consume Cmd/Ctrl+K first.
  window.addEventListener("xp-toggle-command-palette", () => togglePalette());

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
    const url = buildUrl(item.path);
    navRecordIntent(url);
    window.location.href = url;
  }

  // ── 別の組織に着地したことを検出する ─────────────────────────
  // パレット39件のうち23件は組織IDを持たない旧URL（New Invoice / New Bill /
  // Contacts など）。Xeroはそれらの組織を「セッションの現在の組織」から決めるが、
  // セッションはタブ間で共有される。複数組織のタブを開いていると最後に読み込んだ
  // タブの組織が勝ち、意図と違うクライアントの帳簿に着地する。
  // 2026-08-11 実機で発生: Demo Companyのホームから Bank Reconciliation を選び bbb に着地。
  // Organisation workspace（Solo Pro）は複数組織のタブを一括で開く機能なので、
  // この状態が常態になる。
  //
  // ⚠️ ここでやるのは検出だけ。遷移前にセッションの組織を固定できるかは未検証で、
  //    パレット全体の遷移を壊しうるため入れていない。
  //    最低限の要件は「黙って別の帳簿を見せない」こと。見るだけならまだしも、
  //    New Invoice で入力を始めてから気づくのが最悪の事故になる。
  const NAV_INTENT_KEY = "xp_nav_intent";
  const NAV_INTENT_TTL = 60000;
  let navIntentResolved = false;
  let navMismatch = false;

  function navReadIntent() {
    try {
      const raw = sessionStorage.getItem(NAV_INTENT_KEY);
      if (!raw) return null;
      const intent = JSON.parse(raw);
      if (!intent?.org || Date.now() - Number(intent.at || 0) > NAV_INTENT_TTL) return null;
      return intent;
    } catch {
      return null;   // プライベートウィンドウ等でsessionStorageが使えない
    }
  }

  function navClearIntent() {
    try { sessionStorage.removeItem(NAV_INTENT_KEY); } catch { /* 同上 */ }
  }

  function navRecordIntent(url) {
    // 組織IDを含むURLはXeroがURL側を尊重するので対象外
    if (/\/app\/![A-Za-z0-9_-]+/.test(url)) return;
    const org = ocOrgId();
    if (!org) return;
    try {
      sessionStorage.setItem(NAV_INTENT_KEY, JSON.stringify({ org, at: Date.now() }));
    } catch { /* 同上 */ }
  }

  function navFinish(mismatch) {
    navMismatch = mismatch;
    navIntentResolved = true;
    navClearIntent();
  }

  function navCheckIntent(attempt = 0) {
    const intent = navReadIntent();
    if (!intent) { navFinish(false); return; }

    // 旧ページでは、組織IDはDOMのリンクが描画されるまで分からない
    const actual = ocOrgId();
    if (!actual) {
      if (attempt < 20) { setTimeout(() => navCheckIntent(attempt + 1), 300); return; }
      navFinish(false);   // 判定できないものを事故扱いしない
      return;
    }

    navFinish(actual !== intent.org);
    if (navMismatch) navWarnWrongOrg(intent.org, actual);
  }

  function navWarnWrongOrg(wantedId, actualId) {
    const render = (orgs) => {
      const name = (id) => orgs?.[id]?.name || id;
      navRenderWarning(name(wantedId), name(actualId), wantedId);
    };
    // ⚠️ chrome?.storage?.local?.get(...) は「呼べなければ undefined」を返すので、
    //    そこに .then を繋ぐと TypeError で警告ごと消える。名前が引けなくても
    //    警告は必ず出す。組織IDだけでも出したほうが黙るよりずっとよい。
    const p = chrome?.storage?.local?.get?.(["xp_org_colors"]);
    if (!p?.then) { render(null); return; }
    p.then((d) => render(d?.xp_org_colors)).catch(() => render(null));
  }

  function navRenderWarning(wantedName, actualName, wantedId) {
    document.getElementById("xp-org-warning")?.remove();

    const bar = document.createElement("div");
    bar.id = "xp-org-warning";
    // Xero側のCSSに高さを潰されないよう、寸法まわりは全部明示する。
    // 実機で2行目の下端が切れた（2026-08-12）。
    bar.style.cssText = [
      "position:fixed", "top:0", "left:0", "right:0", "z-index:2147483000",
      "box-sizing:border-box", "height:auto", "min-height:62px", "overflow:visible",
      "background:#b91c1c", "color:#fff",
      "padding:12px 16px 14px", "margin:0",
      "font:13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "display:flex", "gap:14px", "align-items:center",
      "box-shadow:0 2px 12px rgba(0,0,0,.3)",
    ].join(";");

    const text = document.createElement("div");
    text.style.cssText = "flex:1;min-width:0";
    const head = document.createElement("strong");
    head.textContent = "Wrong organisation";
    const body = document.createElement("div");
    body.style.cssText = "font-size:12px;opacity:.95;margin-top:1px";
    // textContent で入れる。組織名はXeroのDOM由来なので埋め込まない。
    body.textContent = `Xero opened ${actualName}, not ${wantedName}. Check before you enter anything.`;
    text.append(head, body);

    const btn = document.createElement("button");
    btn.textContent = `Switch to ${wantedName}`;
    btn.style.cssText = [
      "flex:0 0 auto", "border:0", "border-radius:6px", "padding:7px 13px",
      "background:#fff", "color:#b91c1c", "font:inherit", "font-weight:700",
      "cursor:pointer",
    ].join(";");
    btn.addEventListener("click", () => {
      location.href = `https://go.xero.com/app/${encodeURIComponent(wantedId)}/homepage`;
    });

    const close = document.createElement("button");
    close.textContent = "Dismiss";
    close.style.cssText = [
      "flex:0 0 auto", "border:1px solid rgba(255,255,255,.6)", "border-radius:6px",
      "padding:7px 11px", "background:transparent", "color:#fff", "font:inherit",
      "cursor:pointer",
    ].join(";");
    close.addEventListener("click", () => bar.remove());

    bar.append(text, btn, close);
    document.body.prepend(bar);
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
          <span class="xp-hint"><span class="xp-key">Enter</span> go</span>
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
      `<a id="xp-upsell-link">Try Solo Pro →</a>` +
      `<span id="xp-upsell-dismiss" title="Dismiss">×</span>`;
    footer.before(bar);

    document.getElementById('xp-upsell-link').addEventListener('mousedown', e => {
      e.preventDefault();
      chrome.storage.local.set({ xp_upsell_shown: true }).catch(() => {});
      closePalette();
      window.open(chrome.runtime.getURL('options.html'));
    });

    document.getElementById('xp-upsell-dismiss').addEventListener('mousedown', e => {
      e.preventDefault();
      chrome.storage.local.set({ xp_upsell_shown: true }).catch(() => {});
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

  // brIdx は当てにならない。Xeroはフォームを触ると行を再描画するので、
  // 拡張が付けた印ごと消える。マウスで別の行を触られた場合も同じ。
  // 実機で「Ctrl+Enterは届いているのに、別の行のOKを探して空振り」を確認した。
  // フォーカスが行の中にあるなら、そこが今の作業行。brIdx を追従させる。
  function brActiveLine(lines) {
    const list = lines || brLines();
    const focused = list.findIndex((l) => l.contains(document.activeElement));
    if (focused >= 0) brIdx = focused;
    return list[brIdx] || null;
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
    const lines = brLines();
    const line  = brActiveLine(lines);
    if (!line) return;
    const btn = line.querySelector(actionClass);
    if (!btn) return;
    if (actionType !== "match") {
      brCandMode = false;
      brCandPendingMove = 0;
      clearTimeout(brCandTimer);
      brCandClear();
    }
    brLastAction = actionType;
    btn.click();
    brRenderBar();
    // Create/Transfer後: フォームの最初のinputにフォーカスして即入力できるように
    if (actionType === "create" || actionType === "transfer") {
      setTimeout(() => {
        const input = line.querySelector('input:not([type="hidden"]), select, textarea');
        input?.focus();
      }, 150);
    }
    // Match後: Xeroが候補を自動提示しない場合は候補リストが出る。
    // そこをキーボードで選べるようにする（出ない場合は何もしない）。
    if (actionType === "match") brCandWait();
    brRescan();
  }

  // ─────────────────────────────────────────
  // Match の候補リスト操作
  //   実Xero(2026-08-02)で確認した構造:
  //     候補リスト = .tables .selectList
  //     候補1行    = .transaction-row
  //     チェック   = 行内の input[type="checkbox"]
  //   「Select all」は #selectAllTransactions で .transaction-row の外にあるため、
  //   行を起点にすれば自然に除外される。
  //
  //   ⚠️ .selectList は「1.候補リスト」と「2.選択済みリスト」の両方に付いている。
  //      .tables を付けずに拾うと、チェックを入れるたびに選択済み側にも同じ行が
  //      現れて件数が増え、カーソル位置がずれる（実機で再現）。
  //      候補側だけが .tables の中にあるので、これで絞る。
  // ─────────────────────────────────────────
  let brCandMode = false;
  let brCandIdx  = 0;
  let brCandTimer = null;
  let brCandPendingMove = 0;

  function brCandidates() {
    const line = brActiveLine();
    if (!line) return [];

    // Xero has shipped both div-based and table-based versions of Find & Match.
    // Pick the first visible candidate list containing transaction checkboxes.
    const roots = [
      ...line.querySelectorAll(".tables .selectList"),
      ...line.querySelectorAll(".tables"),
      ...line.querySelectorAll('table,[role="table"]'),
    ];
    for (const root of [...new Set(roots)]) {
      if (!root.getClientRects().length) continue;
      const rows = [...root.querySelectorAll('.transaction-row,tr,[role="row"]')]
        .filter((row) => {
          if (!row.getClientRects().length) return false;
          const checkbox = row.querySelector('input[type="checkbox"]');
          if (!checkbox || checkbox.disabled) return false;
          const text = String(row.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
          if (/^(select all|show (received|.* items only))/.test(text)) return false;
          return Boolean(row.querySelector("a"));
        });
      if (rows.length) return rows;
    }
    return [];
  }

  function brCandHighlight(cands, idx) {
    cands.forEach((c, i) => {
      c.dataset.xpBrCandidate = "1";
      c.style.outline      = i === idx ? "2px solid #0a7a4b" : "";
      c.style.background   = i === idx ? "#f0fff8" : "";
      c.style.borderRadius = i === idx ? "4px" : "";
    });
    cands[idx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function brCandClear() {
    document.querySelectorAll('[data-xp-br-candidate]').forEach((c) => {
      c.style.outline = c.style.background = c.style.borderRadius = "";
      delete c.dataset.xpBrCandidate;
    });
  }

  function brCandEnter() {
    if (brCandMode) return true;
    const cands = brCandidates();
    if (!cands.length) return false;
    brCandMode = true;
    brCandIdx = Math.max(0, Math.min(brCandPendingMove, cands.length - 1));
    brCandPendingMove = 0;
    brCandHighlight(cands, brCandIdx);
    brRenderBar();
    return true;
  }

  function brCandWait(attempt = 0) {
    clearTimeout(brCandTimer);
    if (brLastAction !== "match" || brCandEnter() || attempt >= 20) return;
    brCandTimer = setTimeout(() => brCandWait(attempt + 1), 250);
  }

  function brCandExit() {
    if (!brCandMode) return;
    brCandMode = false;
    // Esc means abandoning this Match attempt and returning to statement rows.
    // Without clearing this, the next arrow key immediately reopened candidates.
    brLastAction = null;
    brCandPendingMove = 0;
    clearTimeout(brCandTimer);
    brCandClear();
    brHighlight(brLines(), brIdx);
    brRenderBar();
  }

  function brCandToggle() {
    brCandidates()[brCandIdx]?.querySelector('input[type="checkbox"]')?.click();
  }

  // ── 銀行照合のトラッキング必須化（Practice Pro）─────────────────
  // なぜここが要るか:
  //   Xero自身がMTD for Income Taxの事業切り分けに「トラッキングカテゴリを使え」と
  //   案内しており、トラッキングの無い明細は四半期申告の集計から**除外される**。
  //   そのトラッキングの必須化を、Xeroは2025年7月に「作らない」と明言している。
  //   承認ワークフロー製品（ApprovalMax等）は「書類を吸い上げ→承認→Xeroへ戻す」
  //   構造なので、承認という概念が無い銀行照合には構造上届かない。
  //   個人事業主・大家の取引はほぼ銀行照合から生まれるため、露出はここに集中する。
  //
  // 実DOM（2026-08-12 Demo Company で採取）:
  //   div.tracking > div.x-form-field-wrap > input.x-form-text
  //     未選択: class に x-form-empty-field が付き、value はカテゴリ名（"Region"）
  //     選択済: x-form-empty-field が消え、value は選択肢名（"Eastside"）
  //   ⚠️ idは ext-comp-1011 のようなExtJSの自動採番なので使わないこと。
  //   ⚠️ 「valueが空か」でも判定できない。未選択でもカテゴリ名が入っている。
  //   div.tracking の数 = その組織のトラッキングカテゴリ数。
  const BR_TK_BOX   = "div.tracking";
  const BR_TK_INPUT = "input.x-form-text";
  const BR_TK_EMPTY = "x-form-empty-field";

  function brTrackingFields(line) {
    return [...(line?.querySelectorAll(BR_TK_BOX) || [])]
      .map((box) => box.querySelector(BR_TK_INPUT))
      .filter((el) => el && el.getClientRects().length);
  }

  // 未選択のトラッキング欄。Matchやトラッキング未設定の組織では常に空配列。
  function brTrackingMissing(line) {
    return brTrackingFields(line).filter((el) => el.classList.contains(BR_TK_EMPTY));
  }

  function brTrackingClear(line) {
    (line || document).querySelectorAll("[data-xp-br-tk]").forEach((el) => {
      el.style.outline = "";
      el.style.borderRadius = "";
      el.removeAttribute("data-xp-br-tk");
    });
  }

  function brTrackingMark(fields) {
    fields.forEach((el) => {
      el.style.outline = "2px solid #dc2626";
      el.style.borderRadius = "3px";
      el.setAttribute("data-xp-br-tk", "1");
    });
  }

  // 止めるべきなら true。止めたときは印と理由を出す。
  function brTrackingBlocks(line) {
    if (!tkEnabled || !tkPractice) return false;
    brTrackingClear(line);
    const missing = brTrackingMissing(line);
    if (!missing.length) return false;
    brTrackingMark(missing);
    // 明細1件に対してカテゴリ欄が複数ある場合がある。「行」と数えないこと。
    brSay(missing.length === 1
      ? "This line needs a tracking category"
      : `This line is missing ${missing.length} tracking categories`);
    return true;
  }

  // マウスでOKを押された場合。キーボード経路は brConfirm 側で見ている。
  // ⚠️ capture で、Xero自身のハンドラより先に止める必要がある。
  window.addEventListener(
    "click",
    (e) => {
      if (!brActive || !tkEnabled || !tkPractice) return;
      const ok = e.target?.closest?.("a.okayButton,button.okayButton,button.save-button");
      if (!ok) return;
      const line = ok.closest("#statementLines .line");
      if (!line || !brTrackingBlocks(line)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true
  );

  // 候補選択中のキー処理。入力欄の内外どちらからも呼ぶ。
  // Space でチェックボックスを押すとフォーカスがそこへ移り、以降は「入力欄の中」
  // 扱いになる。そこを Xero に素通しすると、バーに Enter OK と出ているのに
  // 確定できない状態になる（実機で確認）。処理したら true を返す。
  function brCandKey(e) {
    if (!brCandMode) return false;
    const cands = brCandidates();
    if (!cands.length) { brCandExit(); return false; }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      brCandIdx = e.key === "ArrowDown"
        ? Math.min(brCandIdx + 1, cands.length - 1)
        : Math.max(brCandIdx - 1, 0);
      brCandHighlight(cands, brCandIdx);
      return true;
    }
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      brCandToggle();
      return true;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      brConfirm();
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      brCandExit();
      return true;
    }
    return false;
  }

  function brButtonLabel(el) {
    return String(
      el?.getAttribute?.("aria-label") ||
      el?.getAttribute?.("title") ||
      el?.value ||
      el?.textContent ||
      ""
    ).replace(/\s+/g, " ").trim().toLowerCase();
  }

  function brFindButton(line, labels, legacySelector) {
    const legacy = legacySelector ? line.querySelector(legacySelector) : null;
    if (legacy?.getClientRects().length) return legacy;
    return [...line.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"]')]
      .find((el) => el.getClientRects().length && labels.includes(brButtonLabel(el))) || null;
  }

  function brConfirm() {
    const lines = brLines();
    const line  = brActiveLine(lines);
    if (!line) return false;
    // トラッキング欄が無い行（Match等）では常に false なので、ここで一律に見てよい
    if (brTrackingBlocks(line)) return false;
    let button = null;
    if (brLastAction === "match") {
      button = brFindButton(line, ["reconcile", "ok", "okay"], "a.okayButton");
    } else if (brLastAction === "create" || brLastAction === "transfer") {
      // Current Xero labels both Create and Transfer confirmation as "OK".
      // Keep the old Save selector for organisations still on the previous UI.
      button = brFindButton(
        line,
        ["ok", "okay", "save"],
        "button.save-button,a.okayButton,button.okayButton"
      );
    }
    if (!button) {
      brSay("Nothing to confirm on this line yet");
      return false;
    }
    if (button.disabled || button.getAttribute("aria-disabled") === "true") {
      // 例: 候補を2件選ぶと合計が明細と合わず、XeroがReconcileを無効にする。
      brSay(brFailReason(line) || `Xero has not enabled "${brButtonLabel(button)}" yet`);
      return false;
    }
    button.click();
    brLastAction = null;
    brCandMode   = false;
    brCandPendingMove = 0;
    clearTimeout(brCandTimer);
    brCandClear();
    brRenderBar();
    brRescan();
    return true;
  }

  // ⚠️ キー表記は記号ではなく単語で書く。⌘ や ↵ はMacのキーボードにしか
  //    印字されておらず、ユーザーの64%を占めるChromeOSでは読めない。
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
    anchor.insertBefore(bar, anchor.firstChild);
    brRenderBar();
  }

  // 候補選択中は使えるキーが変わるので、バーの中身も差し替える。
  // 使えないキーを並べ続けると案内として嘘になる。
  // 押しても無反応、が一番困る。壊れているのか自分が間違えたのか判断できない。
  // 確定できなかった理由を出す。
  // ⚠️ 緑のバーには出さないこと。Find & Match のパネルは縦に長く、
  //    確定ボタンは一番下にある。そこを見ているときバーは画面外にある（実機で確認）。
  //    見ている場所に出す必要があるので、スクロールに依存しない fixed で出す。
  let brNoticeTimer = null;
  function brSay(msg) {
    clearTimeout(brNoticeTimer);
    let el = document.getElementById("xp-br-notice");
    if (!el) {
      el = document.createElement("div");
      el.id = "xp-br-notice";
      // Xero側のCSSに寸法を潰されないよう全部明示する。
      // 組織警告バーで同じ手当てをして実機で出るようになった（2026-08-12）。
      el.style.cssText = [
        "position:fixed", "left:50%", "bottom:24px", "transform:translateX(-50%)",
        "z-index:2147483000",
        "box-sizing:border-box", "width:auto", "height:auto",
        "max-width:min(560px,90vw)", "min-height:40px", "overflow:visible",
        "background:#b45309", "color:#fff",
        "padding:11px 16px 13px", "margin:0", "border-radius:8px",
        "font:13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        "box-shadow:0 6px 20px rgba(0,0,0,.28)",
        "pointer-events:none", "text-align:center", "white-space:normal",
      ].join(";");
      document.body.appendChild(el);
    }
    el.textContent = msg;   // textContent なのでXero由来の文字列でも安全
    el.style.display = "block";
    brNoticeTimer = setTimeout(() => { el.style.display = "none"; }, 4500);
  }

  // Xeroが出している警告文をそのまま借りる。こちらで文言を推測すると外れる。
  function brFailReason(line) {
    const alert = [...line.querySelectorAll(
      '[role="alert"],[class*="error"],[class*="warning"],[class*="alert"]'
    )].find((el) => el.getClientRects().length && (el.textContent || "").trim());
    const text = alert ? String(alert.textContent).replace(/\s+/g, " ").trim() : "";
    return text.slice(0, 90);
  }

  function brRenderBar() {
    const bar = document.getElementById("xp-br-bar");
    if (!bar) return;
    const K = (k, label) =>
      `<span><b style='background:rgba(255,255,255,.25);border-radius:3px;padding:1px 5px'>${k}</b> ${label}</span>`;
    const actionHints = brLastAction === "create"
      ? [K(MOD_LABEL + "Enter", "Save")]
      : brLastAction === "transfer"
        ? [K("Enter", "Save")]
        : [K("Enter", "confirm"), K(MOD_LABEL + "Enter", "Save")];

    bar.innerHTML = brCandMode
      ? [
          "<strong>Xero Power</strong>",
          "<span style='opacity:.85'>Choosing a match</span>",
          K("↑↓", "move"),
          K("Space", "select"),
          K("Enter", "Reconcile"),
          K("Esc", "back to rows"),
        ].join("")
      : [
          "<strong>Xero Power</strong>",
          K("↑↓", "navigate"),
          K(SC.match.toUpperCase(), "Match"),
          K(SC.create.toUpperCase(), "Create"),
          K(SC.transfer.toUpperCase(), "Transfer"),
          K(SC.discuss.toUpperCase(), "Discuss"),
          ...actionHints,
          K("Esc", "back to rows"),
        ].join("");
  }

  function brTeardown() {
    brActive = false;
    brCandMode = false;
    brCandPendingMove = 0;
    clearTimeout(brCandTimer);
    brCandClear();
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
    console.log(
      `%c[Xero Power] Bank Rec shortcuts ✅  ↑↓ ${SC.match.toUpperCase()} ` +
      `${SC.create.toUpperCase()} ${SC.transfer.toUpperCase()} ${SC.discuss.toUpperCase()}`,
      "color:#0a7a4b;font-weight:bold"
    );
  }

  // ─────────────────────────────────────────
  // 6. グローバルキーボードイベント
  // ─────────────────────────────────────────
  window.addEventListener(
    "keydown",
    (e) => {
      // ── ⌘K / Ctrl+K：パレット開閉（最優先）──
      // SC.palette は options で変更可（Solo Pro以上）。ChromeOS の検索キーも metaKey を発火する。
      const paletteKeyMatches = (e.key || "").toLowerCase() === SC.palette ||
        e.code === `Key${SC.palette.toUpperCase()}`;
      if ((e.metaKey || e.ctrlKey) && paletteKeyMatches) {
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
      if (!brActive) return;
      const tag = document.activeElement?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // 入力中でも効かせたい2つを先に処理する。
      // C/T を押すとフォームの入力欄に自動フォーカスするため、ここを通さないと
      //   ・↑↓ で行に戻れない（マウスを使うしかない袋小路になる）
      //   ・Enter が届かず、バーに書いてある「Save」に到達できない
      // という状態になる（実機で確認）。
      // 候補選択中は入力欄の内外を問わず先に処理する。Space のあとフォーカスが
      // チェックボックスへ移るため、下の inField 分岐に落とすと Enter が届かない。
      if (brCandKey(e)) return;

      if (inField) {
        if (e.key === "Escape") {
          e.preventDefault();
          document.activeElement.blur();
          brHighlight(brLines(), brIdx);   // 行移動に戻す
          return;
        }
        // 素の Enter は Xero 側の候補選択に使われるので奪わない。
        // 保存は修飾キー付きにして衝突を避ける。
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          // ExtJSのコンボは、候補が開いたままだと値が確定していない。見た目には
          // 入っていてもXeroは「勘定科目が未設定」と判断し、自前のエラーを出す
          // （実機で確認: "You must set a payee, account and tax rate…"）。
          // Whyは必須ではないので、What で選び切らずに保存しようとする人は必ず踏む。
          // ⚠️ blurすると activeElement から行を特定できなくなるので、
          //    brActiveLine() を先に呼んで brIdx を今の行に固定してから外す。
          brActiveLine();
          document.activeElement?.blur?.();
          setTimeout(brConfirm, 0);
          return;
        }
        return;                            // それ以外は Xero に渡す
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // ── Match の候補選択中 ──
      // 候補リストが出ている間は ↑↓ を候補の移動に使う。
      // M/C/T/D は下の通常処理へ落として、アクションを選び直せるようにする。
      // 非同期表示が遅かった場合も、次のキー操作時に候補を取り直す。
      if (brLastAction === "match" && !brCandMode) {
        // Xeroが候補を自動提示した行では、あとから Find & Match を押して初めて
        // 一覧が出る。そのとき候補モードに入る「きっかけになったキー」を
        // ここで消費しないと、下の switch にも流れて明細行が動いてしまう。
        if (brCandEnter()) {
          // 入った直後の↑↓は「一覧に入る」操作。先頭を選んだ状態で止める。
          // ここで更に1つ動かすと、先頭がハイライトされる瞬間が見えない。
          if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); return; }
          if (brCandKey(e)) return;
        } else {
          // Find & Match は非同期に描画される。到着前の↑↓は明細行を動かさず、
          // 候補リスト用に取っておく。
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            brCandPendingMove += e.key === "ArrowDown" ? 1 : -1;
            brCandPendingMove = Math.max(0, brCandPendingMove);
            brCandWait();
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            brLastAction = null;
            brCandPendingMove = 0;
            clearTimeout(brCandTimer);
            brRenderBar();
            return;
          }
        }
      }
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
  // 6.4 承認前コーディングガードレール（Practice Pro）
  //   背景: Xero Product Ideas で287票、Xeroは「開発予定なし」と明言。
  //   事務所では担当者ごとにコーディングがバラつくのが決算時の手戻りになる。
  //   トラッキング未入力の行があるまま Approve できないようにする。
  //
  //   ⚠️ これは「ガードレール」であって統制ではない。拡張を切れば回避できる。
  //      設定画面にもその旨を明記すること。
  //
  //   Xeroには世代の違う2つのUIがあり、どちらも実機で確認済み(2026-08-01)。
  //   どちらも列見出しは組織が付けた名前（例 "Region"）だが、内部の識別子は
  //   固定なので、クライアントがカテゴリを何と名付けても効く。
  //
  //   ① 新インボイス（React / /app/{orgId}/invoicing）
  //      行   = tbody tr
  //      入力 = [data-automationid*="tracking-"][...="--search-field--input"] の .value
  //      承認 = [data-automationid^="ApproveAndEmailButton"]
  //
  //   ② Bills（ExtJS 3 / /AccountsPayable/Edit.aspx）
  //      行   = .x-grid3-row
  //      セル = .x-grid3-td-colTracking1 （値はテキスト。inputは編集中のセルにしか無い）
  //      承認 = a.words「Approve」＋ ▾の「Approve & add another」
  //      ※ ExtJSは空セルを &nbsp; で埋めるので   を除去してから空判定すること。
  // ─────────────────────────────────────────

  // ① 新インボイス側
  const TK_INV_ROW   = "tbody tr";
  const TK_INV_TRACK = '[data-automationid*="tracking-"][data-automationid$="--search-field--input"]';
  const TK_INV_DESC = [
    '[data-automationid*="description"] textarea',
    '[data-automationid*="description"] input',
  ];
  const TK_INV_CONTENT = [
    '[data-automationid*="description"] input',
    '[data-automationid*="description"] textarea',
    '[data-automationid*="unitAmount"] input',
    '[data-automationid*="account"][data-automationid$="--search-field--input"]',
  ];

  // ② Bills側
  const TK_BILL_ROW   = ".x-grid3-row";
  const TK_BILL_TRACK = '[class*="x-grid3-td-colTracking"]';
  const TK_BILL_DESC = [".x-grid3-td-colDescription"];
  const TK_BILL_CONTENT = [
    ".x-grid3-td-colDescription",
    ".x-grid3-td-colUnitPrice",
    ".x-grid3-td-colAccount",
  ];

  let tkEnabled  = false;  // xp_require_tracking（既定OFF・Practice Pro）
  let descEnabled = false; // xp_require_description（既定OFF・Practice Pro）
  let tkPractice = false;

  function tkCanUse(data) {
    // 旧Pro互換: xp_plan 導入前の有料ユーザーは$44.99のPractice Proとして扱う。
    if (data?.xp_plan) return data.xp_plan === "practice";
    return data?.xp_pro === true;
  }

  if (chrome?.storage?.local) {
    chrome.storage.local.get(["xp_require_tracking", "xp_require_description", "xp_pro", "xp_plan"]).then((d) => {
      tkEnabled  = d.xp_require_tracking === true;
      descEnabled = d.xp_require_description === true;
      tkPractice = tkCanUse(d);
    }).catch(() => {});

    chrome.storage.onChanged.addListener((c, area) => {
      if (area !== "local") return;
      if (c.xp_require_tracking) tkEnabled = c.xp_require_tracking.newValue === true;
      if (c.xp_require_description) descEnabled = c.xp_require_description.newValue === true;
      if (c.xp_pro || c.xp_plan) {
        tkPractice = tkCanUse({
          xp_pro: c.xp_pro?.newValue,
          xp_plan: c.xp_plan?.newValue,
        });
      }
      if ((!tkEnabled && !descEnabled) || !tkPractice) tkClearMarks();
    });
  }

  function tkPageKind() {
    const p = location.pathname.toLowerCase();
    if (p.includes("invoicing")) return "invoice";
    if (p.includes("accountspayable/edit")) return "bill";
    return null;
  }

  // input の値。無ければ空文字。
  function tkVal(el) { return el ? (el.value || "").trim() : ""; }

  // セルの表示テキスト。ExtJSの空セルは &nbsp; なので潰してから判定する。
  function tkText(el) {
    return el ? (el.textContent || "").replace(/ /g, " ").trim() : "";
  }

  // 空行は検証しない。何か入力がある行だけが対象。
  function tkRowHasContent(row, sels, read) {
    return sels.some((s) => read(row.querySelector(s)) !== "");
  }

  // トラッキング未入力の行を返す（ページ種別で読み方を切り替える）
  function tkMissingRows() {
    const kind = tkPageKind();
    if (!kind) return [];

    const cfg = kind === "invoice"
      ? { row: TK_INV_ROW,  track: TK_INV_TRACK,  content: TK_INV_CONTENT,  read: tkVal }
      : { row: TK_BILL_ROW, track: TK_BILL_TRACK, content: TK_BILL_CONTENT, read: tkText };

    return [...document.querySelectorAll(cfg.row)].filter((row) => {
      if (!tkRowHasContent(row, cfg.content, cfg.read)) return false;
      const cells = [...row.querySelectorAll(cfg.track)];
      if (!cells.length) return false;   // トラッキング未設定の組織では何もしない
      return cells.some((c) => cfg.read(c) === "");
    });
  }

  function descMissingRows() {
    const kind = tkPageKind();
    if (!kind) return [];

    const cfg = kind === "invoice"
      ? { row: TK_INV_ROW, desc: TK_INV_DESC, content: TK_INV_CONTENT, read: tkVal }
      : { row: TK_BILL_ROW, desc: TK_BILL_DESC, content: TK_BILL_CONTENT, read: tkText };

    return [...document.querySelectorAll(cfg.row)].filter((row) => {
      if (!tkRowHasContent(row, cfg.content, cfg.read)) return false;
      const description = cfg.desc.map((selector) => row.querySelector(selector)).find(Boolean);
      if (!description) return false;
      return cfg.read(description) === "";
    });
  }

  function tkClearMarks() {
    document.querySelectorAll("[data-xp-tk-mark]").forEach((el) => {
      el.style.outline = "";
      el.style.borderRadius = "";
      delete el.dataset.xpTkMark;
    });
    document.getElementById("xp-tk-warning")?.remove();
  }

  function tkMark(trackingRows, descriptionRows) {
    tkClearMarks();
    const kind = tkPageKind();
    const track = kind === "invoice" ? TK_INV_TRACK : TK_BILL_TRACK;
    const read  = kind === "invoice" ? tkVal : tkText;
    const description = kind === "invoice" ? TK_INV_DESC : TK_BILL_DESC;

    trackingRows.forEach((row) => {
      row.querySelectorAll(track).forEach((c) => {
        if (read(c) !== "") return;
        const cell = c.closest("td") || c;
        cell.style.outline = "2px solid #dc2626";
        cell.style.borderRadius = "3px";
        cell.dataset.xpTkMark = "1";
      });
    });

    descriptionRows.forEach((row) => {
      const field = description.map((selector) => row.querySelector(selector)).find(Boolean);
      if (!field || read(field) !== "") return;
      const cell = field.closest("td") || field;
      cell.style.outline = "2px solid #dc2626";
      cell.style.borderRadius = "3px";
      cell.dataset.xpTkMark = "1";
    });

    const bar = document.createElement("div");
    bar.id = "xp-tk-warning";
    bar.setAttribute("role", "alert");
    bar.style.cssText = [
      "position:fixed", "left:50%", "transform:translateX(-50%)", "top:16px",
      "z-index:2147483647", "background:#fef2f2", "border:1px solid #fca5a5",
      "color:#991b1b", "border-radius:10px", "padding:12px 16px",
      "font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "box-shadow:0 8px 24px rgba(0,0,0,.15)", "max-width:520px",
    ].join(";");
    const messages = [];
    if (trackingRows.length) {
      messages.push(`${trackingRows.length} line${trackingRows.length > 1 ? "s" : ""} need tracking`);
    }
    if (descriptionRows.length) {
      messages.push(`${descriptionRows.length} line${descriptionRows.length > 1 ? "s" : ""} need a description`);
    }
    bar.textContent = `${messages.join("; ")}. Complete the highlighted fields before approving.`;
    document.body.appendChild(bar);
    setTimeout(() => bar.remove(), 6000);

    (trackingRows[0] || descriptionRows[0])?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  // 承認系のクリックか判定。下書き保存は止めない（作業を人質に取らない）。
  function tkIsApproveClick(target) {
    const kind = tkPageKind();

    if (kind === "invoice") {
      if (target.closest?.('[data-automationid^="ApproveAndEmailButton"]')) return true;
      const opt = target.closest?.('[role="option"],[role="menuitem"]');
      return !!opt && /^approve/i.test((opt.textContent || "").trim());
    }

    if (kind === "bill") {
      // 主ボタン a.words「Approve」と、▾の「Approve & add another」の両方。
      // 「Save」（下書き）は通す。
      const a = target.closest?.("a");
      return !!a && /^approve/i.test((a.textContent || "").trim());
    }

    return false;
  }

  // ⚠️ このリスナーは §6.5 の Approve 乗っ取りより先に登録すること。
  //    先に検証しないと、未入力のまま承認が走ってしまう。
  window.addEventListener(
    "click",
    (e) => {
      if ((!tkEnabled && !descEnabled) || !tkPractice) return;
      if (!tkPageKind()) return;
      if (!tkIsApproveClick(e.target)) return;

      const missingTracking = tkEnabled ? tkMissingRows() : [];
      const missingDescriptions = descEnabled ? descMissingRows() : [];
      if (!missingTracking.length && !missingDescriptions.length) return;

      e.preventDefault();
      e.stopImmediatePropagation();
      tkMark(missingTracking, missingDescriptions);
      console.warn(
        `[Xero Power] Approval blocked — ${missingTracking.length} tracking and ` +
        `${missingDescriptions.length} description issue(s).`
      );
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
  let iaEmailPassthrough = false;
  let iaPlainApprovePassthrough = false;

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
    if (primary) {
      if (primary.dataset.xpOrigLabel) iaSetLabel(primary, primary.dataset.xpOrigLabel);
      delete primary.dataset.xpApprove;
      primary.title = "";
    }
    document.querySelectorAll('[data-xp-approve-email="1"]').forEach((el) => {
      iaRelabelApproveOption(el, false);
      delete el.dataset.xpApproveEmail;
    });
  }

  // クリックを乗っ取り、ドロップダウンの「Approve」を代理クリック
  function iaRunApprove(primary) {
    const swapped = document.querySelector('[data-xp-approve-email="1"]');
    if (swapped) {
      iaPlainApprovePassthrough = true;
      swapped.click();
      queueMicrotask(() => { iaPlainApprovePassthrough = false; });
      return;
    }
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

  function iaRunApproveEmail(primary) {
    if (
      !primary?.isConnected ||
      primary.disabled ||
      primary.getAttribute("aria-disabled") === "true"
    ) return;
    iaSetLabel(primary, primary.dataset.xpOrigLabel || "Approve & email");
    iaEmailPassthrough = true;
    primary.click();
    queueMicrotask(() => {
      iaEmailPassthrough = false;
      if (primary.isConnected && primary.dataset.xpApprove === "1") iaSetLabel(primary, "Approve");
    });
  }

  function iaRelabelApproveOption(option, emailMode) {
    const walker = document.createTreeWalker(option, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const label = emailMode
      ? nodes.find((node) => iaNorm(node.textContent) === "approve")
      : nodes.find((node) => /^approve\s*(?:&|and)\s*email$/i.test(iaNorm(node.textContent)));
    if (!label) return false;
    label.textContent = emailMode ? "Approve & email" : "Approve";

    const shortcut = nodes.find((node) => /(?:cmd|ctrl).*(?:opt|alt).*[ae]/i.test(node.textContent));
    if (shortcut) {
      shortcut.textContent = emailMode
        ? (IS_MAC ? "Cmd-Opt-E" : "Ctrl-Alt-E")
        : (IS_MAC ? "Cmd-Opt-A" : "Ctrl-Alt-A");
    }
    return true;
  }

  // Xero's dropdown omits the current primary action. Reuse its existing Approve
  // row as Approve & email so the React-managed list keeps its native geometry.
  function iaEnsureEmailOption(primary, attempt = 0) {
    if (!primary?.isConnected || !iaEnabled) return;
    if (document.querySelector('[data-xp-approve-email="1"]')) return;
    const plain = [...document.querySelectorAll('[role="option"],[role="menuitem"]')]
      .find((el) => iaIsPlainApprove(el, primary));
    if (!plain) {
      if (attempt < 10) setTimeout(() => iaEnsureEmailOption(primary, attempt + 1), 60);
      return;
    }

    if (!iaRelabelApproveOption(plain, true)) return;
    plain.dataset.xpApproveEmail = "1";
    plain.addEventListener("click", (event) => {
      if (!iaEnabled) return;
      if (iaPlainApprovePassthrough) {
        iaPlainApprovePassthrough = false;
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      iaRunApproveEmail(primary);
    }, true);
    plain.addEventListener("keydown", (event) => {
      if (!iaEnabled) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      iaRunApproveEmail(primary);
    }, true);
  }

  function iaWaitApprove(attempt) {
    const self = document.querySelector('button[data-xp-approve="1"]');
    const swapped = document.querySelector('[data-xp-approve-email="1"]');
    if (swapped) {
      iaPlainApprovePassthrough = true;
      swapped.click();
      queueMicrotask(() => { iaPlainApprovePassthrough = false; });
      return;
    }
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
      if (btn) {
        if (iaEmailPassthrough) {
          iaEmailPassthrough = false;
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        iaRunApprove(btn);
        return;
      }

      const primary = document.querySelector('button[data-xp-approve="1"]');
      const caret = iaFindCaret(primary);
      if (caret && (e.target === caret || caret.contains(e.target))) {
        setTimeout(() => iaEnsureEmailOption(primary), 0);
      }
    },
    true
  );

  // ─────────────────────────────────────────
  // 6.7 組織ごとのナビバー配色
  //   背景: 複数クライアントを持つ簿記担当は組織を切り替えながら作業するため、
  //   「間違った組織に入力する」事故が起きる。組織ごとにナビの色を変えれば
  //   目に入った瞬間に気づける。
  //
  //   実Xero(2026-08-01 Demo Company)でライブ確認済み:
  //     ナビバー = nav#wac-top-panel（全幅・高さ64px・IDが安定）
  //     組織名   = .x-nav--tenant-menu-button-text
  //     組織ID   = 新URL /app/!xxxxx/... のパス、旧URL(.aspx)はDOM内の
  //                /app/!xxxxx/ リンクから拾う（両方でライブ確認済み）
  // ─────────────────────────────────────────

  // ナビの文字色が白なので、白文字が読める濃さの色だけを用意する
  const OC_PALETTE = [
    { id: "slate",  label: "Slate",  hex: "#334155" },
    { id: "red",    label: "Red",    hex: "#b91c1c" },
    { id: "orange", label: "Orange", hex: "#c2410c" },
    { id: "olive",  label: "Olive",  hex: "#4d7c0f" },
    { id: "green",  label: "Green",  hex: "#15803d" },
    { id: "teal",   label: "Teal",   hex: "#0f766e" },
    { id: "indigo", label: "Indigo", hex: "#4338ca" },
    { id: "plum",   label: "Plum",   hex: "#a21caf" },
  ];

  // 無料で色を割り当てられる組織数。Proなら無制限。
  const OC_FREE_LIMIT = 2;

  let ocOrgs  = {};    // { [orgId]: { name, color } }
  let ocIsPro = false;

  function ocOrgId() {
    // ① 新URL形式: /app/!xxxxx/...
    //    orgIdは必ず "!" 始まり。付けないと /app/onboarding-ui のような
    //    ルート名を組織IDと誤認する。
    const m = location.pathname.match(/^\/app\/(![^/]+)/);
    if (m) return m[1];
    // ② 旧URL形式(.aspx): パスに無いのでDOM内のリンクから拾う
    const a = document.querySelector('a[href*="/app/!"]');
    const m2 = a && a.getAttribute("href").match(/\/app\/(![A-Za-z0-9_-]+)/);
    return m2 ? m2[1] : null;
  }

  function ocOrgName() {
    return document.querySelector(".x-nav--tenant-menu-button-text")?.textContent.trim() || null;
  }

  function ocOrgIdFromHref(href) {
    try {
      const path = new URL(href, location.origin).pathname;
      return path.match(/^\/app\/(![A-Za-z0-9_-]+)(?:\/|$)/)?.[1] || null;
    } catch {
      return null;
    }
  }

  function ocNameFromLink(link, id) {
    const preferred = link.querySelector(
      '[data-automationid*="tenant-name"], [class*="tenant-name"], [class*="organisation-name"]'
    );
    const name = (preferred?.textContent || link.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
    return name && name.length <= 120 ? name : id;
  }

  function ocCollectOrganisations() {
    const organisations = new Map();
    const currentId = ocOrgId();
    const currentName = ocOrgName();
    if (currentId) organisations.set(currentId, currentName || currentId);

    document.querySelectorAll('a[href*="/app/!"]').forEach((link) => {
      const id = ocOrgIdFromHref(link.getAttribute("href"));
      if (!id || id === currentId) return;
      organisations.set(id, ocNameFromLink(link, id));
    });

    return [...organisations].map(([id, name]) => ({ id, name }));
  }

  let ocDiscoveryFingerprint = "";
  async function ocDiscoverOrganisations({ force = false } = {}) {
    const organisations = ocCollectOrganisations();
    const fingerprint = JSON.stringify(organisations.sort((a, b) => a.id.localeCompare(b.id)));
    if (!force && fingerprint === ocDiscoveryFingerprint) {
      return { found: organisations.length, added: 0 };
    }
    ocDiscoveryFingerprint = fingerprint;
    try {
      const result = await chrome.runtime.sendMessage({
        type: "xp-register-organisations",
        organisations,
      });
      return { found: organisations.length, added: result?.added || 0 };
    } catch {
      return { found: organisations.length, added: 0 };
    }
  }

  function ocTenantMenuButton() {
    const label = document.querySelector(".x-nav--tenant-menu-button-text");
    return label?.closest("button, [role=button]") || null;
  }

  async function ocRefreshOrganisations() {
    const button = ocTenantMenuButton();
    const wasExpanded = button?.getAttribute("aria-expanded") === "true";
    let opened = false;

    if (button && !wasExpanded) {
      button.click();
      opened = true;
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    let result = await ocDiscoverOrganisations({ force: true });
    for (let attempt = 0; button && result.found <= 1 && attempt < 4; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 250));
      result = await ocDiscoverOrganisations({ force: true });
    }

    if (opened) button.click();
    return result;
  }

  // 色を適用してよい組織か（無料枠の判定）
  function ocAllowed(orgId) {
    if (ocIsPro) return true;
    const colored = Object.keys(ocOrgs).filter((id) => ocOrgs[id]?.color);
    return colored.indexOf(orgId) > -1 && colored.indexOf(orgId) < OC_FREE_LIMIT;
  }

  function ocPaint(hex) {
    const nav = document.getElementById("wac-top-panel");
    if (nav) {
      if (nav.dataset.xpOrigBg === undefined) {
        nav.dataset.xpOrigBg = nav.style.backgroundColor || "";
      }
      nav.style.setProperty("background-color", hex, "important");
      document.getElementById("xp-org-strip")?.remove();
      return;
    }
    // ナビが見つからない場合の保険: 画面最上部に細い帯を出す
    let strip = document.getElementById("xp-org-strip");
    if (!strip) {
      strip = document.createElement("div");
      strip.id = "xp-org-strip";
      strip.style.cssText =
        "position:fixed;top:0;left:0;right:0;height:5px;z-index:2147483647;pointer-events:none";
      document.documentElement.appendChild(strip);
    }
    strip.style.backgroundColor = hex;
  }

  function ocClear() {
    const nav = document.getElementById("wac-top-panel");
    if (nav && nav.dataset.xpOrigBg !== undefined) {
      nav.style.backgroundColor = nav.dataset.xpOrigBg;
      delete nav.dataset.xpOrigBg;
    }
    document.getElementById("xp-org-strip")?.remove();
  }

  function ocApply() {
    const id = ocOrgId();
    if (!id) return;                       // 組織を判定できないページでは何もしない

    // 初訪問の組織は色なしで登録（optionsの一覧に出すため）
    const name = ocOrgName();
    const known = ocOrgs[id];
    if (!known || (name && known.name !== name)) {
      ocDiscoverOrganisations({ force: true });
    }

    const color = ocOrgs[id]?.color;
    if (color && ocAllowed(id)) ocPaint(color);
    else ocClear();
  }

  if (chrome?.storage?.local) {
    chrome.storage.local.get(["xp_org_colors", "xp_pro"]).then((d) => {
      ocOrgs  = d.xp_org_colors || {};
      ocIsPro = d.xp_pro === true;
      ocApply();
    }).catch(() => {});

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.xp_org_colors) ocOrgs  = changes.xp_org_colors.newValue || {};
      if (changes.xp_pro)        ocIsPro = changes.xp_pro.newValue === true;
      if (changes.xp_org_colors || changes.xp_pro) ocApply();
    });
  }

  // Xeroのナビは再描画で色が飛ぶので貼り直す（debounce）
  let ocPending = false;
  const ocObserver = new MutationObserver(() => {
    if (ocPending) return;
    ocPending = true;
    requestAnimationFrame(() => {
      ocPending = false;
      ocApply();
      ocDiscoverOrganisations();
    });
  });
  if (document.body) ocObserver.observe(document.body, { childList: true, subtree: true });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "xp-discover-organisations") return false;
    ocRefreshOrganisations()
      .then(result => sendResponse({ ok: true, ...result }))
      .catch(() => sendResponse({ ok: false, found: 0, added: 0 }));
    return true;
  });

  // ─────────────────────────────────────────
  // 6.8 ダークモード（無料）
  //   背景: Xero Product Ideas で533票、Xeroは「開発予定なし」と明言。
  //   131件の拒否済み要望の中で、最も「拡張機能で解ける」項目。
  //
  //   実装方針: Xeroは :root にCSS変数でテーマを持っていない（実機確認済み）。
  //   クラス名を個別に潰すと新旧2世代のUI全てを追う保守地獄になるので、
  //   ルートを反転 → 反転させたくない要素だけ二重反転で戻す方式を採る。
  //
  //   実機確認(2026-08-01)で見つかった相互作用:
  //     ①画像/ロゴ  → 二重反転しないとネガになる
  //     ②ナビバー   → 組織カラー(§6.7)が反転して別の色に化ける
  //     ③自前のUI   → ヒントバー等の緑が色あせる
  //   ②③も二重反転の対象に含めること。
  // ─────────────────────────────────────────
  const DARK_CSS = `
    html.xp-dark { filter: invert(0.92) hue-rotate(180deg); background: #fff; }
    html.xp-dark img,
    html.xp-dark video,
    html.xp-dark svg,
    html.xp-dark canvas,
    html.xp-dark iframe,
    html.xp-dark [style*="background-image"],
    html.xp-dark #wac-top-panel,
    html.xp-dark #xp-br-bar,
    html.xp-dark #xp-br-notice,
    html.xp-dark #xp-org-warning,
    html.xp-dark #xp-backdrop,
    html.xp-dark #xp-toast,
    html.xp-dark #xp-tk-warning,
    html.xp-dark #xp-org-strip,
    html.xp-dark #xp-top-pagination,
    html.xp-dark #xp-recode-index {
      filter: invert(1) hue-rotate(180deg);
    }
    html.xp-dark #wac-top-panel {
      z-index: 2147483000 !important;
      overflow: visible !important;
    }
    html.xp-dark #wac-top-panel svg,
    html.xp-dark #wac-top-panel img {
      filter: none;
    }
    html.xp-dark [class*="tenant-menu"],
    html.xp-dark [data-automationid*="tenant-menu"] {
      z-index: 2147483001 !important;
    }
  `;

  function dmApply(on) {
    if (on && !document.getElementById("xp-dark-css")) {
      const st = document.createElement("style");
      st.id = "xp-dark-css";
      st.textContent = DARK_CSS;
      (document.head || document.documentElement).appendChild(st);
    }
    document.documentElement.classList.toggle("xp-dark", !!on);
  }

  if (chrome?.storage?.local) {
    chrome.storage.local.get(["xp_dark_mode"])
      .then((d) => dmApply(d.xp_dark_mode === true))
      .catch(() => {});

    chrome.storage.onChanged.addListener((c, area) => {
      if (area === "local" && c.xp_dark_mode) dmApply(c.xp_dark_mode.newValue === true);
    });
  }

  // ─────────────────────────────────────────
  // 6.9 Solo Pro tools
  //   Freeの既存機能は動かさず、Solo Pro / Practice Proに追加する作業効率化。
  //   Xeroの既存操作を代理する機能は、対象を明確に特定できた場合だけ動かす。
  // ─────────────────────────────────────────
  const SOLO_PREF_DEFAULTS = {
    topPagination: true,
    rememberPageSize: true,
  };

  let soloPaid = false;
  let soloPrefs = { ...SOLO_PREF_DEFAULTS };
  let soloPageSizes = {};

  const SOLO_CSS = `
    #xp-top-pagination {
      display: flex; align-items: center; justify-content: flex-end; gap: 4px;
      min-height: 38px; margin: 0 0 10px; padding: 5px 8px;
      border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #xp-top-pagination button {
      min-width: 30px; height: 28px; padding: 0 8px;
      border: 1px solid #cbd5e1; border-radius: 4px;
      background: #fff; color: #334155; cursor: pointer;
      font: 500 12px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      letter-spacing: 0;
    }
    #xp-top-pagination button:hover:not(:disabled) { border-color: #0a7a4b; color: #0a7a4b; }
    #xp-top-pagination button[aria-current="page"] { background: #0a7a4b; border-color: #0a7a4b; color: #fff; }
    #xp-top-pagination button:disabled { opacity: .4; cursor: not-allowed; }
  `;

  function soloCanUse(data) {
    if (data?.xp_plan) return data.xp_plan === "pro" || data.xp_plan === "practice";
    return data?.xp_pro === true;
  }

  function soloVisible(el) {
    if (!el || el.closest?.("#xp-top-pagination")) return false;
    const style = getComputedStyle(el);
    return el.getClientRects().length > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function soloNorm(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function soloLabel(el) {
    return soloNorm(
      el?.getAttribute?.("aria-label") ||
      el?.getAttribute?.("title") ||
      el?.textContent
    );
  }

  function soloEnsureStyle() {
    if (document.getElementById("xp-solo-styles")) return;
    const style = document.createElement("style");
    style.id = "xp-solo-styles";
    style.textContent = SOLO_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  // ── Top-of-list page controls ─────────────
  function soloIsPagerAction(label) {
    return /^(go to )?(first|previous|prev|next|last)( page)?$/.test(label) || /^[‹›«»←→]+$/.test(label);
  }

  function soloPagerControls(root) {
    return [...root.querySelectorAll("button,a")].filter((el) => {
      if (!soloVisible(el)) return false;
      const label = soloLabel(el);
      return soloIsPagerAction(label) || /^\d{1,4}$/.test(label);
    });
  }

  function soloFindPager() {
    const actions = [...document.querySelectorAll("button,a")]
      .filter((el) => soloVisible(el) && soloIsPagerAction(soloLabel(el)))
      .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
    for (const action of actions) {
      let root = action.parentElement;
      for (let depth = 0; root && depth < 5; depth += 1, root = root.parentElement) {
        const controls = soloPagerControls(root);
        if (controls.length >= 2 && controls.length <= 20) return { root, controls };
      }
    }
    return null;
  }

  function soloPagerTarget(pagerRoot) {
    const pagerTop = pagerRoot.getBoundingClientRect().top + window.scrollY;
    const candidates = [...document.querySelectorAll('table,[role="table"],#statementLines,.x-grid3')]
      .filter((el) => {
        if (!soloVisible(el)) return false;
        const rect = el.getBoundingClientRect();
        const bottom = rect.bottom + window.scrollY;
        return rect.height > 80 && bottom <= pagerTop + 24;
      })
      .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
    return candidates[0] || null;
  }

  function soloApplyTopPagination() {
    const existing = document.getElementById("xp-top-pagination");
    if (!soloPaid || !soloPrefs.topPagination) {
      existing?.remove();
      return;
    }

    const pager = soloFindPager();
    if (!pager || pager.root.closest("#xp-top-pagination")) {
      existing?.remove();
      return;
    }

    const signature = pager.controls.map((el) => [
      soloLabel(el),
      el.disabled || el.getAttribute("aria-disabled") === "true" ? "0" : "1",
      el.getAttribute("aria-current") || "",
    ].join(":")).join("|");
    if (existing?.dataset.signature === signature) return;
    existing?.remove();

    const target = soloPagerTarget(pager.root);
    if (!target?.parentElement) return;

    const bar = document.createElement("div");
    bar.id = "xp-top-pagination";
    bar.dataset.signature = signature;
    bar.setAttribute("aria-label", "Xero Power page navigation");

    pager.controls.forEach((original) => {
      const button = document.createElement("button");
      const label = soloLabel(original);
      button.type = "button";
      button.textContent = original.textContent.trim() || original.getAttribute("aria-label") || label;
      button.title = `Go to ${label}`;
      button.disabled = original.disabled || original.getAttribute("aria-disabled") === "true";
      if (original.getAttribute("aria-current") === "page") button.setAttribute("aria-current", "page");
      button.addEventListener("click", () => {
        if (!button.disabled && original.isConnected) original.click();
      });
      bar.appendChild(button);
    });

    target.parentElement.insertBefore(bar, target);
  }

  // ── Remember items per page ───────────────
  function soloPageKey(select, index) {
    const path = location.pathname.replace(/^\/app\/![^/]+/, "/app/:org");
    return `${location.hostname}${path}#${select.name || select.id || index}`;
  }

  function soloPageSizeSelects() {
    return [...document.querySelectorAll("select")].filter((select) => {
      const numbers = [...select.options]
        .map((option) => String(option.value || option.textContent).trim())
        .filter((value) => /^\d+$/.test(value))
        .map(Number);
      return soloVisible(select) && numbers.length >= 2 && Math.min(...numbers) <= 100 && Math.max(...numbers) >= 50;
    });
  }

  function soloApplyPageSizes() {
    if (!soloPaid || !soloPrefs.rememberPageSize) return;
    soloPageSizeSelects().forEach((select, index) => {
      const key = soloPageKey(select, index);
      if (!select.dataset.xpPageSizeBound) {
        select.dataset.xpPageSizeBound = "1";
        select.addEventListener("change", () => {
          if (!soloPaid || !soloPrefs.rememberPageSize) return;
          soloPageSizes[key] = select.value;
          chrome.storage?.local?.set({ xp_page_sizes: soloPageSizes })?.catch?.(() => {});
        });
      }

      const saved = soloPageSizes[key];
      if (!saved || select.value === saved || ![...select.options].some((option) => option.value === saved)) return;
      select.value = saved;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  function soloCleanup() {
    document.getElementById("xp-top-pagination")?.remove();
  }

  function soloApplyAll() {
    if (!soloPaid) { soloCleanup(); return; }
    soloEnsureStyle();
    soloApplyTopPagination();
    soloApplyPageSizes();
  }

  function soloLoadState() {
    if (!chrome?.storage?.local) return;
    chrome.storage.local.get([
      "xp_pro", "xp_plan", "xp_solo_top_pagination",
      "xp_solo_remember_page_size", "xp_page_sizes",
    ]).then((data) => {
      soloPaid = soloCanUse(data);
      soloPrefs = {
        topPagination: data.xp_solo_top_pagination !== false,
        rememberPageSize: data.xp_solo_remember_page_size !== false,
      };
      soloPageSizes = data.xp_page_sizes || {};
      soloApplyAll();
    }).catch(() => {});
  }

  if (chrome?.storage?.local) {
    soloLoadState();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      const keys = [
        "xp_pro", "xp_plan", "xp_solo_top_pagination",
        "xp_solo_remember_page_size", "xp_page_sizes",
      ];
      if (keys.some((key) => changes[key])) soloLoadState();
    });
  }

  let soloPending = false;
  const soloObserver = new MutationObserver(() => {
    if (soloPending || !soloPaid) return;
    soloPending = true;
    requestAnimationFrame(() => {
      soloPending = false;
      soloApplyAll();
    });
  });
  if (document.body) soloObserver.observe(document.body, { childList: true, subtree: true });

  // ─────────────────────────────────────────
  // 6.10 Practice Pro review tools
  //   Awaiting Approval: Xeroの一覧に表示された件数だけを端末内に記録する。
  //   Find & Recode: Xeroの行順は変更せず、説明欄の索引から元行へ移動する。
  // ─────────────────────────────────────────
  const PRACTICE_CSS = `
    #xp-recode-index {
      margin: 0 0 12px; border: 1px solid #cbd5e1; border-radius: 6px;
      background: #fff; color: #1f2937;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #xp-recode-index summary {
      display: flex; align-items: center; justify-content: space-between;
      min-height: 38px; padding: 8px 10px; cursor: pointer;
      font-size: 13px; font-weight: 700; list-style: none;
    }
    #xp-recode-index summary::-webkit-details-marker { display: none; }
    #xp-recode-index summary span { color: #6b7280; font-size: 11px; font-weight: 500; }
    #xp-recode-index .xp-recode-tools {
      display: grid; grid-template-columns: minmax(120px, 1fr) auto;
      gap: 8px; padding: 0 10px 10px;
    }
    #xp-recode-index input {
      min-width: 0; height: 32px; border: 1px solid #cbd5e1; border-radius: 4px;
      padding: 0 9px; color: #1f2937; background: #fff; font: inherit;
    }
    #xp-recode-index .xp-recode-order { display: inline-flex; }
    #xp-recode-index .xp-recode-order button {
      height: 32px; border: 1px solid #cbd5e1; background: #fff; color: #374151;
      padding: 0 9px; cursor: pointer; font: inherit; font-size: 11px; font-weight: 600;
    }
    #xp-recode-index .xp-recode-order button:first-child { border-radius: 4px 0 0 4px; }
    #xp-recode-index .xp-recode-order button:last-child { border-radius: 0 4px 4px 0; border-left: 0; }
    #xp-recode-index .xp-recode-order button[aria-pressed="true"] { background: #0a7a4b; color: #fff; border-color: #0a7a4b; }
    #xp-recode-index .xp-recode-results {
      max-height: 220px; overflow: auto; border-top: 1px solid #e5e7eb;
    }
    #xp-recode-index .xp-recode-item {
      display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 8px;
      width: 100%; min-height: 34px; padding: 7px 10px;
      border: 0; border-bottom: 1px solid #f3f4f6; background: #fff;
      color: #374151; text-align: left; cursor: pointer; font: inherit; font-size: 12px; line-height: 1.35;
    }
    #xp-recode-index .xp-recode-item:hover { background: #f0fdf4; }
    #xp-recode-index .xp-recode-row { color: #9ca3af; text-align: right; }
    #xp-recode-index .xp-recode-empty { padding: 12px; color: #6b7280; font-size: 12px; }
  `;

  let practicePaid = false;
  let practiceApprovalWatch = false;
  let practiceRecodeIndex = true;
  let practiceRecodeQuery = "";
  let practiceRecodeOrder = "asc";
  let practiceQueuePending = false;
  const practiceQueueSeen = {};

  function practiceCanUse(data) {
    if (data?.xp_plan) return data.xp_plan === "practice";
    return data?.xp_pro === true;
  }

  function practiceEnsureStyle() {
    if (document.getElementById("xp-practice-styles")) return;
    const style = document.createElement("style");
    style.id = "xp-practice-styles";
    style.textContent = PRACTICE_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  // ── Awaiting Approval Watch ───────────────
  function practiceApprovalKind() {
    const path = location.pathname.toLowerCase();
    const status = [...new URLSearchParams(location.search).entries()]
      .filter(([key]) => /status|view|tab/i.test(key))
      .map(([, value]) => value)
      .join(" ")
      .toLowerCase()
      .replace(/[-_]+/g, " ");
    const isAwaitingApproval =
      path.includes("awaiting-approval") ||
      path.includes("awaitingapproval") ||
      status.includes("awaiting approval") ||
      status.includes("submitted");
    if (!isAwaitingApproval) return null;

    if (path.includes("accountsreceivable/search") || path.includes("/invoicing")) return "invoices";
    if (path.includes("accountspayable/search") || path.includes("/bills")) return "bills";
    return null;
  }

  function practiceAwaitingCount() {
    const candidates = [...document.querySelectorAll('a,button,[role="tab"],[role="option"]')]
      .filter(soloVisible);
    const counts = candidates.map((el) => {
      const label = soloNorm([
        el.getAttribute?.("aria-label"),
        el.getAttribute?.("title"),
        el.textContent,
      ].filter(Boolean).join(" "));
      const start = label.indexOf("awaiting approval");
      if (start < 0) return null;
      const match = label.slice(start + "awaiting approval".length).match(/\b([\d,]+)\b/);
      return match ? Number(match[1].replace(/,/g, "")) : null;
    }).filter(Number.isFinite);
    return counts.length ? Math.max(...counts) : null;
  }

  function practiceApprovalUrl(kind, orgId) {
    return location.href;
  }

  async function practiceRecordApprovalQueue() {
    if (!practicePaid || !practiceApprovalWatch || !chrome?.storage?.local || practiceQueuePending) return;
    const kind = practiceApprovalKind();
    const orgId = ocOrgId();
    const count = practiceAwaitingCount();
    if (!kind || !orgId || count === null) return;

    const key = `${orgId}:${kind}`;
    const now = Date.now();
    const seen = practiceQueueSeen[key];
    if (seen?.count === count && now - seen.checkedAt < 30000) return;
    practiceQueueSeen[key] = { count, checkedAt: now };

    practiceQueuePending = true;
    try {
      const data = await chrome.storage.local.get(["xp_approval_queues"]);
      const queues = data.xp_approval_queues || {};

      Object.keys(queues).forEach((queueKey) => {
        if (now - Number(queues[queueKey]?.observedAt || 0) > 30 * 86400000) delete queues[queueKey];
      });
      const previous = queues[key];
      if (previous?.count === count && now - Number(previous.observedAt || 0) < 300000) return;

      const entry = {
        orgId,
        orgName: ocOrgName() || previous?.orgName || orgId,
        kind,
        count,
        observedAt: now,
        url: practiceApprovalUrl(kind, orgId),
      };
      queues[key] = entry;
      await chrome.storage.local.set({ xp_approval_queues: queues });

      if (previous && count > Number(previous.count || 0)) {
        await chrome.runtime?.sendMessage?.({
          type: "xp-approval-increased",
          entry,
          previousCount: Number(previous.count || 0),
        })?.catch?.(() => null);
      }
    } catch {
      // The Xero tab may navigate while storage is being updated.
    } finally {
      practiceQueuePending = false;
    }
  }

  // ── Find & Recode Description Index ──────
  function practiceIsRecodePage() {
    return location.pathname.toLowerCase().includes("/accounts/recoding");
  }

  function practiceIsDescriptionHeader(cell) {
    return soloNorm(cell?.textContent) === "description";
  }

  function practiceStandardRecodeSource() {
    for (const table of document.querySelectorAll("table")) {
      if (!soloVisible(table)) continue;
      const headerRows = [...table.querySelectorAll("thead tr, tr")];
      const headerRow = headerRows.find((row) =>
        [...row.children].some(practiceIsDescriptionHeader)
      );
      if (!headerRow) continue;
      const headers = [...headerRow.children];
      const descriptionIndex = headers.findIndex(practiceIsDescriptionHeader);
      if (descriptionIndex < 0) continue;
      const rows = [...table.querySelectorAll("tbody tr")].filter(soloVisible);
      const entries = rows.map((row, index) => ({
        row,
        index: index + 1,
        description: String(row.children[descriptionIndex]?.textContent || "").replace(/\s+/g, " ").trim(),
      })).filter((entry) => entry.description);
      if (entries.length) return { root: table, entries };
    }
    return null;
  }

  function practiceExtRecodeSource() {
    for (const grid of document.querySelectorAll(".x-grid3")) {
      if (!soloVisible(grid)) continue;
      const headerRow = [...grid.querySelectorAll(".x-grid3-hd-row")].find((row) =>
        [...row.querySelectorAll("td")].some(practiceIsDescriptionHeader)
      );
      const headers = headerRow ? [...headerRow.querySelectorAll("td")] : [];
      const descriptionIndex = headers.findIndex(practiceIsDescriptionHeader);
      if (descriptionIndex < 0) continue;
      const rows = [...grid.querySelectorAll(".x-grid3-row")].filter(soloVisible);
      const entries = rows.map((row, index) => {
        const cells = [...row.querySelectorAll(".x-grid3-cell,td")];
        const named = row.querySelector([
          '[class*="x-grid3-td-colDescription"]',
          '[class*="x-grid3-td-Description"]',
          '[class*="description" i]',
          '[data-columnid*="description" i]',
          '[data-field*="description" i]',
        ].join(","));
        return {
          row,
          index: index + 1,
          description: String((named || cells[descriptionIndex])?.textContent || "").replace(/\s+/g, " ").trim(),
        };
      }).filter((entry) => entry.description);
      if (entries.length) return { root: grid, entries };
    }
    return null;
  }

  function practiceRecodeRows(root = document) {
    const selector = [
      ".x-grid3-row",
      ".x-grid-row",
      '[role="row"]',
      "tbody tr",
      '[class*="grid-row" i]',
      '[class*="table-row" i]',
    ].join(",");
    return [...root.querySelectorAll(selector)].filter((row) => {
      if (!soloVisible(row)) return false;
      return !row.querySelector('th,[role="columnheader"],.x-grid3-hd,.x-column-header');
    });
  }

  function practiceRecodeCells(row) {
    const selector = [
      "td",
      '[role="cell"]',
      '[role="gridcell"]',
      ".x-grid3-cell",
      ".x-grid-cell",
    ].join(",");
    const cells = [...row.querySelectorAll(selector)].filter(soloVisible);
    return cells.length ? cells : [...row.children].filter(soloVisible);
  }

  function practiceRecodeRoot(rows) {
    const first = rows[0];
    if (!first) return null;
    return first.closest([
      '[role="grid"]',
      ".x-grid3",
      ".x-grid",
      ".x-grid-panel",
      '[class*="grid-container" i]',
      "table",
    ].join(",")) || first.parentElement;
  }

  function practiceNamedRecodeSource() {
    const rows = practiceRecodeRows();
    if (!rows.length) return null;
    const selector = [
      '[class*="x-grid3-td-colDescription"]',
      '[class*="x-grid3-td-Description"]',
      '[class*="description" i]',
      '[data-columnid*="description" i]',
      '[data-field*="description" i]',
    ].join(",");
    const entries = rows.map((row, index) => ({
      row,
      index: index + 1,
      description: String(row.querySelector(selector)?.textContent || "").replace(/\s+/g, " ").trim(),
    })).filter((entry) => entry.description);
    const root = practiceRecodeRoot(rows);
    return root && entries.length ? { root, entries } : null;
  }

  function practiceVisualRecodeSource() {
    const header = [...document.querySelectorAll([
      "th",
      '[role="columnheader"]',
      ".x-grid3-hd",
      ".x-grid3-hd-inner",
      ".x-column-header",
      ".x-column-header-text",
    ].join(","))].find((candidate) => soloVisible(candidate) && practiceIsDescriptionHeader(candidate));
    if (!header) return null;

    const headerRect = header.getBoundingClientRect();
    const descriptionX = headerRect.left + (headerRect.width / 2);
    const rows = practiceRecodeRows().filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.width > 0
        && rect.height > 0
        && rect.bottom > headerRect.bottom
        && rect.left <= descriptionX
        && rect.right >= descriptionX;
    });
    if (!rows.length) return null;
    const entries = rows.map((row, index) => {
      const cell = practiceRecodeCells(row).find((candidate) => {
        if (!soloVisible(candidate)) return false;
        const rect = candidate.getBoundingClientRect();
        return rect.width > 0 && rect.left <= descriptionX && rect.right >= descriptionX;
      });
      return {
        row,
        index: index + 1,
        description: String(cell?.textContent || "").replace(/\s+/g, " ").trim(),
      };
    }).filter((entry) => entry.description);
    const root = practiceRecodeRoot(rows);
    return root && entries.length ? { root, entries } : null;
  }

  function practiceRecodeSource() {
    return practiceStandardRecodeSource()
      || practiceExtRecodeSource()
      || practiceNamedRecodeSource()
      || practiceVisualRecodeSource();
  }

  function practiceRecodeSignature(entries) {
    let hash = 5381;
    entries.forEach((entry) => {
      for (const char of entry.description) hash = ((hash << 5) + hash) ^ char.charCodeAt(0);
    });
    return `${entries.length}:${hash >>> 0}`;
  }

  function practiceRenderRecodeItems(container, entries) {
    const query = soloNorm(practiceRecodeQuery);
    const filtered = entries
      .filter((entry) => !query || soloNorm(entry.description).includes(query))
      .sort((a, b) => {
        const result = a.description.localeCompare(b.description, undefined, { numeric: true, sensitivity: "base" });
        return practiceRecodeOrder === "asc" ? result : -result;
      });
    container.innerHTML = "";

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "xp-recode-empty";
      empty.textContent = "No visible descriptions match.";
      container.appendChild(empty);
      return;
    }

    filtered.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "xp-recode-item";
      const rowNumber = document.createElement("span");
      rowNumber.className = "xp-recode-row";
      rowNumber.textContent = String(entry.index);
      const description = document.createElement("span");
      description.textContent = entry.description;
      button.append(rowNumber, description);
      button.addEventListener("click", () => {
        if (!entry.row.isConnected) return;
        const previousOutline = entry.row.style.outline;
        entry.row.style.outline = "2px solid #0a7a4b";
        entry.row.scrollIntoView({ block: "center", behavior: "smooth" });
        setTimeout(() => {
          if (entry.row.isConnected) entry.row.style.outline = previousOutline;
        }, 1600);
      });
      container.appendChild(button);
    });
  }

  function practiceApplyRecodeIndex() {
    const existing = document.getElementById("xp-recode-index");
    if (!practicePaid || !practiceRecodeIndex || !practiceIsRecodePage()) {
      existing?.remove();
      return;
    }

    const source = practiceRecodeSource();
    if (!source?.root?.parentElement) {
      existing?.remove();
      return;
    }
    const signature = practiceRecodeSignature(source.entries);
    if (
      existing?.dataset.signature === signature &&
      existing.__xpRecodeRoot === source.root &&
      existing.__xpFirstRow === source.entries[0]?.row
    ) return;
    existing?.remove();

    const details = document.createElement("details");
    details.id = "xp-recode-index";
    details.dataset.signature = signature;
    details.__xpRecodeRoot = source.root;
    details.__xpFirstRow = source.entries[0]?.row;
    details.open = true;

    const summary = document.createElement("summary");
    summary.textContent = "Description index";
    const count = document.createElement("span");
  count.textContent = `${source.entries.length} descriptions`;
    summary.appendChild(count);

    const tools = document.createElement("div");
    tools.className = "xp-recode-tools";
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Filter descriptions";
    search.value = practiceRecodeQuery;
    search.setAttribute("aria-label", "Filter descriptions");

    const order = document.createElement("div");
    order.className = "xp-recode-order";
    const asc = document.createElement("button");
    const desc = document.createElement("button");
    asc.type = desc.type = "button";
    asc.textContent = "A-Z";
    desc.textContent = "Z-A";
    asc.setAttribute("aria-pressed", String(practiceRecodeOrder === "asc"));
    desc.setAttribute("aria-pressed", String(practiceRecodeOrder === "desc"));
    order.append(asc, desc);
    tools.append(search, order);

    const results = document.createElement("div");
    results.className = "xp-recode-results";
    practiceRenderRecodeItems(results, source.entries);

    search.addEventListener("input", () => {
      practiceRecodeQuery = search.value;
      practiceRenderRecodeItems(results, source.entries);
    });
    [asc, desc].forEach((button, index) => {
      button.addEventListener("click", () => {
        practiceRecodeOrder = index === 0 ? "asc" : "desc";
        asc.setAttribute("aria-pressed", String(practiceRecodeOrder === "asc"));
        desc.setAttribute("aria-pressed", String(practiceRecodeOrder === "desc"));
        practiceRenderRecodeItems(results, source.entries);
      });
    });

    details.append(summary, tools, results);
    source.root.parentElement.insertBefore(details, source.root);
  }

  function practiceCleanup() {
    document.getElementById("xp-recode-index")?.remove();
  }

  function practiceApplyAll() {
    if (!practicePaid) { practiceCleanup(); return; }
    practiceEnsureStyle();
    practiceRecordApprovalQueue();
    practiceApplyRecodeIndex();
  }

  function practiceLoadState() {
    if (!chrome?.storage?.local) return;
    chrome.storage.local.get([
      "xp_pro", "xp_plan", "xp_practice_approval_watch", "xp_practice_recode_index",
    ]).then((data) => {
      practicePaid = practiceCanUse(data);
      practiceApprovalWatch = data.xp_practice_approval_watch === true;
      practiceRecodeIndex = data.xp_practice_recode_index !== false;
      practiceApplyAll();
    }).catch(() => {});
  }

  if (chrome?.storage?.local) {
    practiceLoadState();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      const keys = ["xp_pro", "xp_plan", "xp_practice_approval_watch", "xp_practice_recode_index"];
      if (keys.some((key) => changes[key])) practiceLoadState();
    });
  }

  let practicePending = false;
  const practiceObserver = new MutationObserver(() => {
    if (practicePending || !practicePaid) return;
    practicePending = true;
    requestAnimationFrame(() => {
      practicePending = false;
      practiceApplyAll();
    });
  });
  if (document.body) practiceObserver.observe(document.body, { childList: true, subtree: true });

  // ─────────────────────────────────────────
  // 7. ページ別機能の起動 / 終了
  // ─────────────────────────────────────────
  function bootFeatures() {
    closePalette();
    // パレットで指定した組織に着地したかを毎回確かめる。
    // 組織IDを持たない旧URLはセッション頼みなので、ここでしか気づけない。
    navCheckIntent();
    const path = location.pathname.toLowerCase();

    if (path.includes("bankrec")) {
      brRememberAccountSoon();
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

    // 組織カラー（全ページ共通）
    ocApply();

    // Solo Pro tools（全ページを安全に再評価）
    soloApplyAll();

    // Practice Pro tools（承認キューとFind & Recode索引）
    practiceApplyAll();
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
    `%c[Xero Power] v${window.__xeroPower} ✅  ${MOD_LABEL}K palette | Most used | Bank Rec: arrows M C T D Enter | Invoicing: Approve by default | Plans: options page`,
    "color:#0a7a4b;font-weight:bold;font-size:13px"
  );
})();
