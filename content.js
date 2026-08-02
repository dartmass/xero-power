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
 * v0.6.0: Bank Rec に確定ショートカット(↵)を追加。Bills対応も試作したが方式が誤りでv0.9.0で作り直し。
 *         r/xero ユーザーリクエスト(Logical_Sea2630)を受けて実装。無料機能。
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
 *         ②トラッキング必須化(§6.4 / 287票)。請求書とBillsの両方。事務所のコーディング統一。Pro。
 *         ⑤Bills「Approve & next」ボタン(§6.6)。Xeroに該当オプションが無いため自前で追加。
 *         ③ダークモード(§6.8 / 533票)。無料。
 *         ④パレット全28件を実Xeroで検証し直し、**15件が死んでいた**のを修正。
 *           ・レポート7件は reporting.xero.com へ移転（別ホスト）
 *           ・Quotes/Chart of Accounts/Manual Journals 等は旧.aspxが404
 *           ・Bank Reconciliation は accountId 無しだと homepage に飛ばされる
 *           ・New Bill の /app/{orgId}/bills/create は404
 *           検証済みURLのみに入れ替え、Xeroナビから拾った有用な行き先も追加して39件に。
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
    if (!ocOrgId()) {
      if (attempt < 20) setTimeout(() => brRememberAccountSoon(attempt + 1), 300);
      return;
    }
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
  // 6.4 トラッキング必須化（Pro）
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
  const TK_INV_CONTENT = [
    '[data-automationid*="description"] input',
    '[data-automationid*="description"] textarea',
    '[data-automationid*="quantity"] input',
    '[data-automationid*="unitAmount"] input',
    '[data-automationid*="account"][data-automationid$="--search-field--input"]',
  ];

  // ② Bills側
  const TK_BILL_ROW   = ".x-grid3-row";
  const TK_BILL_TRACK = '[class*="x-grid3-td-colTracking"]';
  const TK_BILL_CONTENT = [
    ".x-grid3-td-colDescription",
    ".x-grid3-td-colQuantity",
    ".x-grid3-td-colUnitPrice",
    ".x-grid3-td-colAccount",
    ".x-grid3-td-colLineAmount",
  ];

  let tkEnabled = false;  // xp_require_tracking（既定OFF・Pro）
  let tkPro     = false;

  if (chrome?.storage?.local) {
    chrome.storage.local.get(["xp_require_tracking", "xp_pro"]).then((d) => {
      tkEnabled = d.xp_require_tracking === true;
      tkPro     = d.xp_pro === true;
    }).catch(() => {});

    chrome.storage.onChanged.addListener((c, area) => {
      if (area !== "local") return;
      if (c.xp_require_tracking) tkEnabled = c.xp_require_tracking.newValue === true;
      if (c.xp_pro)              tkPro     = c.xp_pro.newValue === true;
      if (!tkEnabled || !tkPro) tkClearMarks();
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

  function tkClearMarks() {
    document.querySelectorAll("[data-xp-tk-mark]").forEach((el) => {
      el.style.outline = "";
      el.style.borderRadius = "";
      delete el.dataset.xpTkMark;
    });
    document.getElementById("xp-tk-warning")?.remove();
  }

  function tkMark(rows) {
    tkClearMarks();
    const kind = tkPageKind();
    const track = kind === "invoice" ? TK_INV_TRACK : TK_BILL_TRACK;
    const read  = kind === "invoice" ? tkVal : tkText;

    rows.forEach((row) => {
      row.querySelectorAll(track).forEach((c) => {
        if (read(c) !== "") return;
        const cell = c.closest("td") || c;
        cell.style.outline = "2px solid #dc2626";
        cell.style.borderRadius = "3px";
        cell.dataset.xpTkMark = "1";
      });
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
    const n = rows.length;
    bar.textContent =
      `${n} line${n > 1 ? "s" : ""} still need a tracking category. ` +
      `Your practice requires one on every line before approving.`;
    document.body.appendChild(bar);
    setTimeout(() => bar.remove(), 6000);

    rows[0]?.scrollIntoView({ block: "center", behavior: "smooth" });
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
      if (!tkEnabled || !tkPro) return;
      if (!tkPageKind()) return;
      if (!tkIsApproveClick(e.target)) return;

      const missing = tkMissingRows();
      if (!missing.length) return;         // 問題なし → 通常の承認へ流す

      e.preventDefault();
      e.stopImmediatePropagation();
      tkMark(missing);
      console.warn(`[Xero Power] Approval blocked — ${missing.length} line(s) missing a tracking category.`);
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
  // 6.6 Bills：「Approve & next」ボタン（無料）
  //   要望: Logical_Sea2630 (r/xero 2026-06-30)
  //   「Billを承認したら一覧に戻らず、次のBillへ進みたい」
  //
  //   ⚠️ v0.6.0では Xero の ▾ にある「Approve and view next」を既定にする方式で
  //      実装したが、実機で確認したところ Bills の ▾ の中身は
  //      「Approve」と「Approve & add another」の2つだけで、
  //      **「Approve and view next」というオプションは存在しない**。
  //      既定を差し替える方式では実現不可能だったので、ボタンごと自前で足す方式に変更した。
  //
  //   仕組み（実機で確認した事実に基づく）:
  //     ①Bills一覧の各行が /app/{orgId}/bills/view/bill?id={guid} を持つ
  //       → 表示順のキューが作れる
  //     ②Bill編集画面は /AccountsPayable/Edit.aspx?InvoiceID={guid}
  //     ③承認は a.words「Approve」を代理クリックすればよい
  //
  //   承認後にXeroがどこへ着地するかは意図的に前提にしていない。
  //   「次のID」を先に控えておき、遷移後にそこへ飛ぶ作りなので、
  //   Xero側の着地先が変わっても壊れない。
  // ─────────────────────────────────────────
  let baEnabled = true;   // xp_bill_approve_view_next（既定ON・無料）
  let baQueue   = null;   // { org, ids: [...] }

  if (chrome?.storage?.local) {
    chrome.storage.local.get(["xp_bill_approve_view_next", "xp_bill_queue"]).then((d) => {
      baEnabled = d.xp_bill_approve_view_next !== false;
      baQueue   = d.xp_bill_queue || null;
      baBoot();
    }).catch(() => {});

    chrome.storage.onChanged.addListener((c, area) => {
      if (area !== "local") return;
      if (c.xp_bill_approve_view_next) {
        baEnabled = c.xp_bill_approve_view_next.newValue !== false;
        if (!baEnabled) document.getElementById("xp-ba-next")?.remove();
        else baBoot();
      }
      if (c.xp_bill_queue) baQueue = c.xp_bill_queue.newValue || null;
    });
  }

  function baOrg() { return ocOrgId(); }

  // ── ①一覧ページ: 表示順のBill IDをキューとして保存 ──
  function baIsListPage() {
    return /\/bills\/list\//i.test(location.pathname);
  }

  function baCaptureQueue() {
    const ids = [];
    document.querySelectorAll('a[href*="/bills/view/bill"]').forEach((a) => {
      let id;
      try { id = new URL(a.href, location.origin).searchParams.get("id"); } catch { return; }
      if (id && !ids.includes(id)) ids.push(id);
    });
    if (!ids.length) return;
    baQueue = { org: baOrg(), ids };
    chrome.storage?.local?.set({ xp_bill_queue: baQueue });
  }

  // ── ②編集ページ: 自前ボタンを足す ──
  function baIsEditPage() {
    return /accountspayable\/edit/i.test(location.pathname);
  }

  function baCurrentId() {
    // View.aspx は invoiceID、Edit.aspx は InvoiceID と大小が揺れるので総当たり
    const q = new URLSearchParams(location.search);
    for (const [k, v] of q) if (/^invoiceid$/i.test(k)) return v;
    return null;
  }

  function baNextId() {
    const cur = baCurrentId();
    if (!cur || !baQueue || baQueue.org !== baOrg()) return null;
    const i = baQueue.ids.indexOf(cur);
    if (i < 0 || i + 1 >= baQueue.ids.length) return null;
    return baQueue.ids[i + 1];
  }

  function baApproveLink() {
    return [...document.querySelectorAll("a")]
      .find((a) => a.offsetParent && (a.textContent || "").trim() === "Approve") || null;
  }

  function baEditUrl(id) {
    return "https://go.xero.com/AccountsPayable/Edit.aspx?InvoiceID=" + encodeURIComponent(id);
  }

  function baInjectButton() {
    if (!baEnabled || document.getElementById("xp-ba-next")) return;
    const approve = baApproveLink();
    if (!approve) return;
    const next = baNextId();
    if (!next) return;              // 一覧を経由していない／最後の1件なら出さない

    const btn = document.createElement("button");
    btn.id = "xp-ba-next";
    btn.type = "button";
    btn.textContent = "Approve & next";
    btn.title = "Approve this bill, then open the next one from the list (Xero Power)";
    // ⚠️ このフッターは全て float で組まれている。素直に挿すと Approve に重なり、
    //    押し間違いが起きる（実機で確認済み）。float:right を付けて
    //    #approveBttn の直後に挿すと Approve の左隣に収まる。
    btn.style.cssText = [
      "float:right", "margin:0 8px 0 0", "padding:5px 14px", "border-radius:4px",
      "border:1px solid #0a7a4b", "background:#0a7a4b", "color:#fff",
      "font:13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "cursor:pointer",
    ].join(";");

    btn.addEventListener("click", async (e) => {
      e.preventDefault();

      // 先に「次」を控える。ページ遷移後にこれを見て飛ぶ。
      // ⚠️ ここは best-effort。storageが失敗しても承認は必ず実行する。
      //    await で例外を投げると、押しても何も起きないボタンになる。
      try {
        await chrome.storage?.local?.set({
          xp_bill_pending: { org: baOrg(), approving: baCurrentId(), next },
        });
      } catch {
        /* 次へは進めないが、承認そのものは通す */
      }

      // 本物の Approve を叩く。トラッキング必須化(§6.4)が止めた場合は
      // dispatchEvent が false を返すので、控えを取り消す。
      const ok = approve.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
      if (!ok) chrome.storage?.local?.remove("xp_bill_pending")?.catch?.(() => {});
    });

    const group = approve.closest("#approveBttn") || approve.closest(".float-right") || approve.parentElement;
    group.insertAdjacentElement("afterend", btn);
  }

  // ── ③遷移後: 控えていた「次」へ飛ぶ ──
  function baFollowPending() {
    if (!chrome?.storage?.local) return;
    chrome.storage.local.get(["xp_bill_pending"]).then((d) => {
      const p = d.xp_bill_pending;
      if (!p) return;

      // まだ同じBillの編集画面にいる = 承認が通っていない（検証で止められた等）。
      // 勝手に次へ飛ばすと入力が失われるので、控えを捨てて何もしない。
      if (baIsEditPage() && baCurrentId() === p.approving) {
        chrome.storage.local.remove("xp_bill_pending");
        return;
      }
      chrome.storage.local.remove("xp_bill_pending");
      if (p.next && p.org === baOrg()) location.href = baEditUrl(p.next);
    }).catch(() => {});
  }

  function baBoot() {
    if (baIsListPage()) baCaptureQueue();
    if (baIsEditPage()) baInjectButton();
  }

  // 一覧も編集画面も後から描画されるのでObserverで拾う（debounce）
  let baPending = false;
  const baObserver = new MutationObserver(() => {
    if (baPending) return;
    baPending = true;
    requestAnimationFrame(() => { baPending = false; if (baEnabled) baBoot(); });
  });
  if (document.body) baObserver.observe(document.body, { childList: true, subtree: true });

  baFollowPending();

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
      ocOrgs[id] = { name: name || known?.name || id, color: known?.color || null };
      chrome.storage?.local?.set({ xp_org_colors: ocOrgs })?.catch?.(() => {});
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
    requestAnimationFrame(() => { ocPending = false; ocApply(); });
  });
  if (document.body) ocObserver.observe(document.body, { childList: true, subtree: true });

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
    html.xp-dark #xp-backdrop,
    html.xp-dark #xp-toast,
    html.xp-dark #xp-tk-warning,
    html.xp-dark #xp-org-strip {
      filter: invert(1) hue-rotate(180deg);
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
  // 7. ページ別機能の起動 / 終了
  // ─────────────────────────────────────────
  function bootFeatures() {
    closePalette();
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

    // Bills：Approve & next（一覧のキュー取得＋ボタン注入）
    baBoot();

    // 組織カラー（全ページ共通）
    ocApply();
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
