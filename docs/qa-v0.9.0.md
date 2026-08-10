# v0.9.0 実機検証チェックリスト

検証環境: Demo Company (Global)

凡例: ✅ 確認済み ／ ⏳ 途中 ／ ⬜ 未着手 ／ ❌ 不具合あり ／ 廃止 対象外

## 検証中にプランを切り替える方法

v0.9.0の提出にあたり、コード内の解除キー（`XP-OWNER-UNLOCK` / `XP-SOLO-QA-UNLOCK` / `DEV-PRO`）は
**すべて削除した**。合言葉でProになる経路はもう存在しない。以下の記録に出てくるキー名は当時の手順で、
今は使えない。

代わりに storage を直接書く。`chrome://extensions` → Xero Power → `Service Worker` → Console:

```js
// Practice Pro
chrome.storage.local.set({ xp_pro: true, xp_plan: 'practice', xp_pro_owner: true })

// Solo Pro
chrome.storage.local.set({ xp_pro: true, xp_plan: 'pro', xp_pro_owner: true })

// Free へ戻す
chrome.storage.local.remove(['xp_pro','xp_plan','xp_pro_owner','xp_license_local_qa'])
```

`xp_pro_owner: true` を入れるとプラン表示が `(owner)` 付きになる。本物の課金状態と見分けがつくので、
検証中の画面をそのまま宣材に使う事故を防げる。定期再検証もこのフラグで飛ぶ。

実キーで `Activate` すると `xp_pro_owner` は `false` に上書きされるため、検証用フラグが本番の
ライセンス状態に残ることはない。

---

## 無料機能

| # | 機能 | 状態 | 確認内容 |
|---|---|---|---|
| 1 | Cmd/Ctrl+K パレットが開く | ✅ | 通常画面に加え、Bank Recの明細選択状態からも開くことを確認 |
| 2 | ⭐Most used の学習 | ✅ | 2回以上使った画面が上位に出ることを確認 |
| 3 | Bank Reconciliation（口座未記憶） | ✅ | 口座一覧に着地。**これが仕様**（accountIdが無いとXeroがホームに飛ばすため） |
| 4 | Bank Reconciliation（口座記憶後） | ✅ | ホームからCtrl+K→照合画面へ直行を確認。修正が効いた |
| 5 | パレットの他の行き先 | ✅ | All Reports / Profit & Loss / Balance Sheet / Chart of Accounts / Manual Journalsへの遷移を確認 |
| 6 | Bank Rec ショートカット ↑↓ M C T D | ✅ | 全キー動作を確認 |
| 7 | Bank Rec 確定 ↵ (Match) | ✅ | Find & MatchでEnter確定後、Reconcile件数が26→25になり照合完了を確認 |
| 7b | Bank Rec 保存（Create / Transfer） | ✅ | CreateはCmd/Ctrl+Enter、TransferはEnterで保存・照合できることを実機確認 |
| 7c | 操作中からEscで行移動に戻る | ✅ | M→候補を↑↓、Esc→別明細へ↑↓、移動先でMを1回→候補を↑↓、の一連操作を確認 |
| 7d | Match候補のキーボード選択 | ✅ | M→↑↓で候補移動 / Spaceで選択 / EnterでReconcileまで確認 |
| 8 | Approve既定の変更（請求書） | ✅ | 主ボタンはApprove、▾の先頭はApprove & email。Xero純正の配置・背景・選択状態を維持していることを確認 |
| 9 | ダークモード | ✅ | Invoice・Bank Recで表示し、文字・入力欄・メニューに大きな崩れがないことを確認 |
| 10 | 組織カラー（2組織まで無料） | ✅ | aaa・bbbの2組織に色を設定。3組織目のDemo Companyは色ボタン無効＋Pro案内表示を確認。自動保存・即時反映・選択中表示も正常 |
| 11 | ダークモード × 組織カラー | ✅ | ダークモードON/OFFの両方で指定色を維持し、ロゴ・アイコン・組織メニューも正常表示されることを確認 |
| 12 | Bills「Approve & next」 | 廃止 | Xero標準の「Approve & view next」を実機確認。同じ機能を重複提供しないため拡張側を削除 |

### Free回帰確認（2026-08-04）

- ✅ `content.js`、`shortcut-capture.js`、`options.js`、`popup.js`、`background.js`の構文チェック
- ✅ manifestのJSON、登録スクリプト、配布対象ファイルの存在確認
- ✅ SettingsとPopupの全DOM参照、ID重複、Free表示、有料コントロールのロックを静的確認
- ✅ Cmd/Ctrl+Kの捕捉、通常キーの無視、保存キー変更の即時反映を実行スモークで確認
- ✅ コマンドパレット39件の必須項目、ラベル・URL重複、主要6遷移先を確認
- ✅ Bank Recの既定キー、口座未記憶時のフォールバック、組織別口座保存処理を確認
- ✅ Invoice Approve、ダークモード、組織カラーの起動処理が残っていることを確認
- ✅ 組織カラーパレット8色と無料上限2組織がSettings・Xero側で一致
- ✅ Solo Pro / Practice Proの処理がFreeではクリーンアップだけを行い、機能を追加しないことを確認
- ✅ 廃止したBills機能は、旧保存値の削除処理とこの履歴以外に残存参照なし
- **結果: Free機能のデグレは見つからなかった**。Xero実画面の挙動はQA 1〜11の実機結果で確認済み

## 有料機能（オーナーキーでPractice Pro解除）

| # | 機能 | 状態 | 確認内容 |
|---|---|---|---|
| 13 | オーナーキーでPractice Pro解除 | ✅ | Settingsで「Practice Pro (owner) ✅」、popupでPractice Pro、Solo/Practice設定とショートカット編集の有効化、端末解除ボタンを確認 |
| 14 | トラッキング必須化（請求書 / Practice Pro） | ✅ | Region未入力でApproveを実行し、Draftのまま停止。「1 line need tracking」警告とRegionセルだけの赤枠を確認 |
| 15 | トラッキング必須化（Bills / Practice Pro） | ✅ | Region未入力でApproveを実行し、同じNew Bill画面で停止。「1 line need tracking」警告とRegionセルだけの赤枠を確認 |
| 16 | **Save は止まらないこと** | ✅ | Region未入力のBillでSaveが通り、「Draft Bill Saved」表示とDraft一覧への保存を確認 |
| 17 | 空行を誤ってブロックしないこと | ✅ | 入力済み1行＋空行4行のBillで、Region入力後に警告なしで承認。「Bill approved」とAwaiting Paymentへの移行を確認 |
| 18 | 組織カラー3組織目以降（Solo Pro以上） | ✅ | 組織切替メニュー／Refreshによる一括同期を確認。有料状態で3組織目にも色を設定し、Xeroのナビバーへ反映 |
| 19 | ショートカットキーの変更（Solo Pro以上） | ✅ | MatchをM→Xに変更し、XでMatchへ入ることと緑のヘルプバーがX表示へ同期することを確認 |
| 20 | Organisation workspace（Solo Pro以上） | ✅ | popupで複数組織を選択し、各Dashboardが別タブで開くこと、先頭タブがactiveになること、組織カラー反映を確認。大量組織向けに検索、検索結果の一括選択/解除、選択数、スクロール案内を追加し、30組織の自動UI試験済み |
| 21 | Invoice PDF button（Solo Pro以上） | 廃止 | Sales InvoiceとCredit Noteの両方でXero純正Print PDFを確認。重複価値がないためSettings・実装・商品説明から削除 |
| 22 | Top pagination（Solo Pro以上） | ✅ | Billsを25件表示にして2ページ化。上部のPrevious Page / Next Page表示、下部のXero純正Page 1 of 2との同期、上部ボタンによる往復操作を確認 |
| 23 | Remember page size（Solo Pro以上） | ✅ | Billsを25件表示に変更し、別画面から同じ一覧へ再訪後も25件表示へ復元されることを確認 |
| 24 | Skip payment promotion（Solo Pro以上） | 廃止 | 不定期なプロモーションの1クリック省略に対し、支払画面の自動操作リスクと保守コストが見合わないため削除 |
| 25 | Solo gating | ✅ | Free popup、既定キー、設定ロック、Workspace/Practice queue非表示、2組織カラー＋保存済み3組織目の非適用を確認。Solo Pro実キーの境界確認はQA32で実施 |
| 26 | Description必須化（Invoice / Practice Pro） | ✅ | Description空欄の入力済み1行でApproveを停止。「1 line need a description」警告とDescriptionセルだけの赤枠を確認 |
| 27 | Description必須化（Bills / Practice Pro） | ✅ | Description空欄でApprove停止・Descriptionセルだけ赤枠を確認。同じ状態でもSaveは通りDraft一覧へ保存された |
| 28 | Tracking + Description同時エラー | ✅ | Billの1明細でtracking・description各1件の警告を同時表示し、DescriptionとRegionの両セルだけが赤枠になることを確認 |
| 29 | Awaiting Approval Watch | ✅ | macOSのChrome通知許可後、実データの4→5件で正しい通知を確認。5件のまま再読み込みして重複通知が出ないことも確認 |
| 30 | Practice approval queue popup | ✅ | Bills 5件とInvoices 0件を組織別・種別別に表示。Bills行から安全なXero URLを新規タブで開くことを確認 |
| 31 | Find & Recode Description index | ✅ | 38件中Descriptionあり37件を索引化。A-Z/Z-A、Filter、行ジャンプ＋約1.6秒の強調、元表の行順維持を確認 |
| 32 | Practice gating | ✅ | 一時Solo QAキーでSolo機能のみ有効、Practice機能はロックされることを確認済み |
| 33 | Manage subscription導線 | ✅ | Polar Customer Portalのサインイン画面（`/portal/request`）が新規タブで開くことを確認 |
| 34 | 端末解除の表示 | ✅ | Freeへの復帰、ブラウザのみ解除の案内、Manage subscription維持、owner keyでの再有効化を確認 |
| 35 | 定期ライセンス再検証 | ✅ | 起動時スロットル＋24時間alarm、現行Polar endpointを静的・モック確認 |
| 36 | 解約・期限切れ | ✅ | 明確なinvalidで`xp_pro`/`xp_plan`を削除し、保存キーをinactive表示用に維持 |
| 37 | Practice → Solo変更 | ✅ | Practice benefit失効＋Solo benefit有効時に`xp_plan: pro`へ変更 |
| 38 | Polar通信障害（定期再検証） | ✅ | network/5xxでは既存の有料状態を維持（`background.js`側） |
| 39 | Polar通信障害（初回Activate） | ✅ | **QA38の穴を塞いだ**。38は`background.js`だけを見ており、客が最初に踏む`options.js`のActivateは未検査だった。旧実装は429/5xx/通信断でも即`false`を返し、当たるはずのSolo側の問い合わせに到達しないまま「Invalid license key」と表示していた。11通りの応答パターンで自動確認 |
| 40 | 通知を**押した**ときの遷移 | ✅ | **QA29の穴**。29は通知が出るところまでで押していなかった。A（テスト通知）・B（増加通知→Bills一覧が新規タブで開く）・C（権限を後から許可しSWを再起動しない並び）をすべて実機で確認 |
| 41 | popupの寸法（プラン別） | ✅ | **Solo Proにした実機で発覚。** workspace(272px)が出て661pxとなりChromeのポップアップ上限600pxを超え、最大枠(800×600)が出て白い余白ができていた。Practice Proでは承認キュー(142px)も乗り約800px。高さを580pxで抑え内側スクロールに変更。Free相当354px（余白なし）／Solo・Practice とも300×580、300px超の要素ゼロを実測 |

---

## 完了: QA 25 — Solo gating

### テスト前UI修正

- popup最上部の右側に目立つ `Settings` ボタンを追加
- 既存の下部 `Settings & Plans` と同じSettings画面を開く
- 300px幅の実描画でタイトル・プラン表示との非重複を自動確認済み

### 事前条件

- Freeへ戻す前に、現在のPractice Pro (owner) 状態と有料設定を確認する
- Free確認後に再びオーナーキー `XP-OWNER-UNLOCK` を入力できるように控えておく

### テスト手順

1. Settingsの `Deactivate this browser` を押してFreeへ戻す
2. Settings上部とpopupがFree表示になることを確認する
3. ショートカット編集、Organisation workspace、3組織目以降のカラー、Top pagination、Remember page sizeがロックまたは非作動になることを確認する
4. Free機能のコマンドパレット、Bank Recショートカット、ダークモード、2組織までのカラーが引き続き使えることを確認する
5. オーナーキー `XP-OWNER-UNLOCK` を入力してPractice Proへ戻す
6. SettingsとpopupがPractice Pro表示になり、有料機能が再び有効になることを確認する

### 現在の確認状況

- ✅ Settingsでライセンス解除後のFree状態を確認
- ✅ ショートカット編集などの有料設定がロックされている
- ✅ Free時の `Save shortcuts` / `Reset to defaults` を操作不能かつグレー表示に修正
- ✅ 組織カラーは削除せず保存し、Freeでは2組織だけを有効にする
- ✅ 3組織目以降は `Saved: 色名 · Upgrade to apply` と表示し、現在は非適用であることを明確化
- ✅ Freeでは保存済みカスタムキーを削除せず、表示・実動作だけを既定の `Cmd/Ctrl+K`, `M/C/T/D` に戻す
- ✅ 実描画テスト: Freeバッジ、既定キー、Organisation workspace / Practice queue非表示を確認
- ✅ 実機でツールバーのXPアイコンからpopup本体が開き、Freeバッジが表示されることを確認
- ✅ Freeではpopup自体は開くが、Organisation workspaceとPractice approval queueは表示しない
- ✅ 有料側の機能有効化はQA13・18〜20の実機結果で確認済み

### 仕様通りの結果

- Freeでは既存の無料機能を維持したまま、有料UIと有料処理だけが利用できなくなる
- ロックされた設定値を画面操作で有効化できない
- Practice Proへ戻すとSolo Pro機能とPractice Pro機能の両方が復帰する
- プラン切替だけでXero上のデータや保存済みショートカット・組織カラーを削除しない
- Free中の3組織目以降の保存色とカスタムキーは非適用になり、再有効化後に復帰する

---

## 完了: QA 26 — Description必須化（Invoice / Practice Pro）

### テスト手順

1. Settingsでオーナーキー `XP-OWNER-UNLOCK` を入力し、Practice Proへ戻す
2. `Approval guardrail — require line descriptions` をONにする
3. 結果を分けやすくするため、`require tracking categories` は一旦OFFにする
4. Xeroで新規InvoiceまたはDraft Invoiceを開く
5. Contact、日付、数量、単価、Accountなどを入力し、明細のDescriptionだけ空欄にする
6. `Approve` を押す
7. 警告と赤枠を確認後、Descriptionを入力してもう一度 `Approve` を押す

### 仕様通りの結果

- Description空欄では承認されず、同じDraft Invoice画面に残る
- `1 line needs a description` 相当の警告が表示される
- 赤枠になるのは不足しているDescriptionセルだけ
- Description入力後は警告が消え、通常どおり承認できる
- 空の未使用行は不足件数に数えない

---

## 完了: QA 27 — Description必須化（Bills / Practice Pro）

### テスト手順

1. Settingsで `Approval guardrail — require line descriptions` をONにする
2. 結果を分けやすくするため、`require tracking categories` は一旦OFFにする
3. Xeroで `Purchases` → `Bills` → `New bill` を開く
4. From、日付、数量、単価、Accountなどを入力し、明細のDescriptionだけ空欄にする
5. `Approve` を押す
6. 警告と赤枠を確認する
7. 同じ状態で `Save` を押し、Draftとして保存できることを確認する

### 仕様通りの結果

- Description空欄では承認されず、同じBill画面に残る
- `1 line needs a description` 相当の警告が表示される
- 赤枠になるのは不足しているDescriptionセルだけ
- `Save` は止めず、Description空欄でもDraftとして保存できる
- 空の未使用行は不足件数に数えない

---

## 完了: QA 28 — Tracking + Description同時エラー

### テスト手順

1. Settingsで `require tracking categories` と `require line descriptions` の両方をONにする
2. Xeroで新規InvoiceまたはNew Billを開く
3. 入力済みの明細を1行作り、DescriptionとRegionの両方を空欄にする
4. `Approve` を押す
5. 警告文と、Description・Region両セルの赤枠を確認する
6. Descriptionだけ入力して再度 `Approve` を押す
7. 最後にRegionも入力し、再度 `Approve` を押す

### 仕様通りの結果

- 最初は `1 line need tracking; 1 line need a description` 相当の警告が表示される
- DescriptionセルとRegionセルの両方が赤枠になる
- Description入力後はtracking不足だけの警告になり、赤枠もRegionだけになる
- Regionも入力すると承認を妨げず、通常どおり承認できる
- 1行に2種類の不足があっても、それぞれの不足数を正しく表示する

---

## 完了: QA 29 — Awaiting Approval Watch

### 現在の確認状況

- ✅ BillsのAwaiting approval一覧で基準値2件を確認
- ✅ BillをSubmit for approvalし、一覧が3件へ増えたことを確認
- ❌ 2件から3件への増加時にChrome通知を視認できなかった
- 🔧 Draftなど別タブでもAwaiting approvalタブの件数を先に記録できる問題を修正
- 🔧 実際のAwaiting approval一覧を開いたときだけ比較し、通知を確認するまで残すよう修正
- ✅ 修正後、拡張機能は3件から4件への増加を正しく記録
- ✅ Chrome拡張機能の `notifications` 権限が許可済みであることを確認
- ❌ 3件から4件への増加時にも通知バナーを視認できなかった
- ✅ macOSでGoogle Chromeの通知を許可後、`Send test notification` の通知表示を確認
- 🔧 テスト通知の固定件数 `1 → 2` は実件数と誤認しやすいため、件数を含まない診断文へ変更
- ✅ 実際の4件から5件への増加時に「5 bills awaiting approval, up from 4」のChrome通知を確認
- ✅ 通知の組織名、種別、現在件数、前回件数がXeroの一覧と一致
- ✅ 5件のまま再読み込みし、重複通知が出ないことを確認

### テスト手順

1. 拡張機能を再読み込みし、Settingsを再読み込みする
2. Practice Proのまま、Settingsで `Watch Awaiting Approval queues` がONであることを確認する
3. 直下の `Send test notification` を押す
4. Settingsに表示される診断文と、Chrome通知バナーの有無を確認する
5. `Chrome accepted the notification` と出るのにバナーが出ない場合は、macOSの `システム設定` → `通知` → `Google Chrome` で通知を許可する
6. ✅ Xeroで `Purchases` → `Bills` → `Awaiting approval` を開き、4件を基準値として記録する
7. ✅ 新しいBillを `Submit for approval` で追加する
8. ✅ 同じ組織の `Bills` → `Awaiting approval` を再度開き、5件を確認する
9. ✅ 4件から5件への増加通知が表示されることを確認する
10. ✅ 現在の通知を閉じ、件数を5件のまま一覧を再読み込みして、同じ通知が再表示されないことを確認する

### 仕様通りの結果

- 初回に一覧を開いたときは基準件数を保存するだけで、通知しない
- 同じ組織・同じBills一覧の件数が前回より増えたときだけ通知する
- 通知には組織名、Bills、現在件数、前回件数が分かる内容を表示する
- 件数が同じ場合や減った場合は通知しない
- Xero APIをバックグラウンド巡回せず、対象一覧を開いたときに件数を観測する
- テスト通知が失敗した場合はSettingsに権限不足またはChrome APIのエラー理由を表示する
- Chromeが通知を受理した場合は、macOS側の通知設定を確認できる案内を表示する

---

## 完了: QA 30 — Practice approval queue popup

### 現在の確認状況

- ✅ popupに `Demo Company (Global)` / `bills` / `5` が表示される
- ✅ Bills行を押すと新しいタブが開く
- ✅ Demo CompanyのBills `Awaiting approval` 一覧へ遷移し、5件表示と一致する
- ✅ Invoices `Awaiting Approval (0)` を観測し、popupに `invoices` / `0` が表示される
- ℹ️ Invoices行の遷移は0件表示までで受入完了。Bills行で新規タブ遷移を確認済み
- ℹ️ Invoicesの正数件数は未確認。Billsでは5件の表示と4→5件の増加通知を確認済み

### テスト手順

1. ✅ ChromeツールバーのXero Powerアイコンを押してpopupを開く
2. ✅ `Practice approval queue` に `Demo Company (Global)` の `bills` が5件と表示されることを確認する
3. ✅ そのBills行を押す
4. ✅ XeroのDemo CompanyのBills `Awaiting approval` 一覧が新しいタブで開くことを確認する
5. ✅ XeroでSalesのInvoices `Awaiting approval` 一覧を一度開く
6. ✅ Xero Powerのpopupを開き直し、同じ組織の `invoices` 行と最新件数0件が追加されることを確認する
7. ℹ️ Invoices行の遷移は省略し、Bills行の同一処理で担保する

### 仕様通りの結果

- Practice Proのpopupだけに `Practice approval queue` を表示する
- 観測済みのキューを組織別・`bills` / `invoices` 別に表示する
- 各行に組織名、種別、最新件数、最終観測からの経過時間を表示する
- 行を押すと、その組織・種別で最後に観測したXeroの安全なURLを新しいタブで開く
- 一覧をまだ観測していない組織・種別は表示せず、Xero APIによる自動取得は行わない

---

## 現在のテスト: QA 31 — Find & Recode Description index

### テスト手順

1. Practice Proのまま、Settingsで `Find & Recode — show Description index` をONにして `Save & apply` を押す
2. Xeroで `Accounting` → `Advanced` → `Find and recode` を開く。見つからない場合は `Cmd+K` から `Find and Recode` を開く
3. `Account transactions` などを選び、検索条件を指定してDescription列を含む結果を表示する
4. 結果表の上に `Description index` と表示件数が現れることを確認する
5. `A-Z` と `Z-A` を切り替え、索引内の説明だけが昇順・降順に変わることを確認する
6. `Filter descriptions` に結果内の語句を入力し、索引が絞り込まれることを確認する
7. 索引の項目を1件押し、対応するXeroの元行までスクロールして緑枠が一時表示されることを確認する
8. Xeroの元の結果表の行順が、索引の並べ替えや検索で変わっていないことを確認する

### 確認結果

- Bill条件で検索し、38件の結果と `Description` 列が表示されることを確認済み
- Xeroの旧式グリッドで `Description index` が出ない不具合を確認
- 1回目の列検出修正後も索引が表示されず、再試験NGを確認
- 原因は、結果表の検出が同一table内の見出し・明細、または旧 `.x-grid3-row` 構造を前提としていたこと。現在のXeroのように見出しと明細が分かれたグリッドでは、表示中の38行を0件として扱っていた
- `.x-grid-row`、ARIA grid、分割tableの明細行・セルを対象に加え、Description見出しとセルの横位置を照合する検出へ修正。拡張機能とXeroページの再読み込み後、手順4から再開する
- 修正後、38件中Descriptionが入っている37件を索引化し、`Description index` と `37 descriptions` の表示を確認済み
- `A-Z` で `20-second...` → `aaa` → `Annual...`、`Z-A` で `Taxi services` → `Room hire` → `Replacement...` の順になることを確認
- `aaa` で索引が該当4件だけに絞られることを確認
- 索引項目を押すと対応する元明細へスクロールし、約1.6秒だけ緑色で強調されることを確認
- 索引の並べ替えや絞り込み後も、Xeroの元表の行順が変わらないことを確認
- QA 31 合格

### 仕様通りの結果

- Practice Proかつ設定ONのFind & Recode結果画面だけに表示される
- Descriptionが入っている現在表示中の行だけを索引化する
- `A-Z` / `Z-A` と検索は索引だけに作用し、Xeroの結果表は並べ替えない
- 索引項目を押すと元行を中央付近へ移動し、約1.6秒だけ緑の枠で示す
- Description列を含む結果がないときは索引を表示しない

---

## 完了: QA 32 — Practice gating

### 確認結果

- ✅ Free 表示を確認
- ✅ Free では Find & Recode の `Description index` が表示されない
- ✅ Free のポップアップに `Practice approval queue` が表示されない
- ✅ Settings上でPractice Pro toolsがロックされ、操作できない
- ✅ Trackingだけ未入力、Descriptionだけ未入力の両方で、FreeではXero Powerの承認警告が出ない
- ✅ Free側のロックを確認
- ✅ 一時Solo QAキー `XP-SOLO-QA-UNLOCK` で `Solo Pro` として有効化された
- ✅ Keyboard shortcutsを含むSolo Pro機能だけが操作可能になった
- ✅ Practice Pro機能はロックされたままで、Description index・approval queue・approval guardrailは有効にならなかった

### テスト手順

#### A. Free

1. SettingsのLicense key欄で `Deactivate this browser` を押す
2. Settingsとポップアップのプラン表示が `Free` になることを確認する
3. SettingsでPractice Pro toolsがロックされ、操作できないことを確認する
4. QA 31と同じFind & Recode結果画面を開き、`Description index` が表示されないことを確認する
5. ポップアップに `Practice approval queue` が表示されないことを確認する
6. DescriptionまたはTrackingを空欄にしたテスト用Invoice/BillでApproveを押し、Xero Powerの赤いガード警告が出ないことを確認する

#### B. Solo Pro

1. 一時QAキー `XP-SOLO-QA-UNLOCK` をActivateする
2. Settingsとポップアップのプラン表示が `Solo Pro` になることを確認する
3. Solo Pro toolsは操作でき、Practice Pro toolsはロックされていることを確認する
4. Find & Recodeで `Description index` が表示されないことを確認する
5. `Practice approval queue` とApproval guardrailが動作しないことを確認する

#### C. Practice Proへ戻す

1. `XP-OWNER-UNLOCK` をActivateする
2. 表示が `Practice Pro (owner)` に戻り、Practice Pro toolsを再び操作できることを確認する

### 仕様通りの結果

- QA 26〜31のPractice機能はPractice Proだけで利用できる
- FreeとSolo ProではPractice機能のUIがロックされ、Xero画面にも機能を追加しない
- Freeでは既存の無料機能、Solo Proでは無料機能とSolo Pro機能が引き続き利用できる
- `XP-SOLO-QA-UNLOCK` はSolo Proだけをローカル解放し、Practice Pro機能は解放しない
- `XP-OWNER-UNLOCK` と `XP-SOLO-QA-UNLOCK` は検証専用で、ストア提出前にコードから削除する

---

## 完了: QA 33 — Manage subscription導線

### 確認結果

- ✅ `https://polar.sh/xero-power/portal/request` が新しいタブで開いた
- ✅ 購入時のメールアドレスと認証コードでCustomer Portalへ入るサインイン画面を確認
- ✅ Checkoutではなく購入管理の認証導線で、元のSettingsタブも残った

### テスト手順

1. Xero Powerポップアップ上部の `Settings` を押す
2. SettingsのLicense key欄まで移動する
3. `Manage subscription` を押す
4. 新しいタブでPolarのCustomer Portalが開くことを確認する
5. 元のSettingsタブが残り、ローカルのライセンス状態が変わらないことを確認する

### 仕様通りの結果

- URLが `https://polar.sh/xero-power/portal` で始まる
- PolarのCustomer Portalまたはサインイン画面が新規タブで表示される
- Checkoutページではなく、解約・支払方法変更・領収書取得を行う管理導線になっている
- `Manage subscription` を押しただけではブラウザのライセンスは解除されず、プラン表示も変わらない

### 合格条件

上記4項目をすべて満たせばQA 33合格。

---

## 完了: QA 34 — 端末解除の表示

### 確認結果

- ✅ owner keyでPractice Proを有効化できる
- ✅ 「Deactivate this browser」でFreeへ戻り、ライセンスキー欄が未入力に戻る
- ✅ 有料設定がロックされ、ポップアップ表示もFreeへ戻る
- ✅ このブラウザだけを解除し、Polarの課金は別管理であることが表示される
- ✅ 「Manage subscription」は解除後も利用できる
- ✅ owner keyを再入力するとPractice Proへ復帰できる

### テスト手順

1. `XP-OWNER-UNLOCK` を入力して `Activate` し、`Practice Pro (owner)` になっていることを確認する
2. License key欄の `Deactivate this browser` を押す
3. Settings上部のプラン表示と各有料設定の状態を確認する
4. License key欄の入力値と、その下に表示されるメッセージを確認する
5. Xero Powerポップアップを開き直し、必要ならXeroタブを再読み込みしてFree表示になっていることを確認する
6. `Manage subscription` が残り、課金停止を完了したとは表示されないことを確認する
7. `XP-OWNER-UNLOCK` を再入力して `Activate` し、有料状態へ戻せることを確認する

### 仕様通りの結果

- Settingsはすぐに `Free` へ戻り、保存されていたライセンスキーは入力欄から消える
- `License deactivated on this browser. Billing is managed separately in Polar.` と表示される
- Solo Pro / Practice Proの設定はロックされ、カスタムショートカットは既定値へ戻る
- この操作は現在のChromeだけを解除するもので、Polarの契約・課金は停止しない
- 契約管理は引き続き `Manage subscription` からPolar Customer Portalで行う
- 有効なキーを再入力すれば有料プランへ再有効化できる

### 合格条件

上記6項目をすべて満たせばQA 34合格。

---

## 未実施: QA 40 — 通知を押したときの遷移

QA29は通知が**出る**ところまでで終わっている。押したときにXeroの一覧が開くかは誰も確認していない。

### 直したこと（実機確認が要る理由）

`notifications` は `optional_permissions` なので、許可される前にService Workerが起動していると
`chrome.notifications` ごと存在せず、クリックのリスナーを張る先が無い。起動時に1回試すだけの実装
だったため、**権限を許可した直後の最初の通知を押しても何も起きない**可能性があった。

権限が付いた瞬間（`chrome.permissions.onAdded`）と、通知を作る直前にも張り直すようにした。
自動試験で5パターン確認済みだが、Service Workerの実際の起動タイミングは実機でしか出ない。

### テスト手順

1. Settingsで `Watch Awaiting Approval queues` を一度OFFにし、通知権限も外す
2. `chrome://extensions` で拡張機能を再読み込みする（権限が無い状態でSWを起動させる）
3. Settingsで `Watch Awaiting Approval queues` をONにし、通知権限を許可する
4. **SWを再起動させずに** `Send test notification` を押す
5. 出た通知バナーを**クリックする**
6. 続けて実データでも確認する: Billsの `Awaiting approval` を開いて件数を記録 → 1件増やす →
   同じ一覧を開き直す → 増加通知が出たらそれを**クリックする**

### 確認結果

- ✅ **A**: `Send test notification` の通知を押すとバナーが閉じる。新規タブは開かない（対応するキューが無いため仕様通り）
- ✅ **B**: Billsを5→6件に増やして出た通知を押すと、Demo CompanyのBills `Awaiting approval` が新しいタブで開いた。6件表示と一致
- ✅ **C**: 権限を外してSWを起動 → 権限を許可 → SWを再起動せずにテスト通知を出して押す、の並びでバナーが閉じた。**修正前に無反応だったはずの経路**。A・Bは権限が既にある状態なので旧実装でも通っていた可能性が高く、修正の効果を実際に示したのはこのCだけ

### 仕様通りの結果

- テスト通知（`xp-approval:test`）を押しても新しいタブは開かない。対応するキューが無いため。通知は閉じる
- 実データの増加通知を押すと、その組織・種別で最後に観測したXeroの一覧が新しいタブで開く
- 手順2〜4の並び（権限を後から許可し、SWを再起動しない）でも押した反応がある
- 開くURLは `*.xero.com` に限られ、それ以外は開かない

---

## 🚧 未解決（2026-08-07 中断）— 撮影とセットで再開する

### 撮影を再開するとき

Macで撮ると拡張のUIが `Cmd+K` と表示する。ユーザーの64%はChromeOSなので、
**撮影中だけ非Mac扱いにする**。`content.js` / `popup.js` / `options.js` の

```js
const IS_MAC = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform || "");
```

を `const IS_MAC = false;` に変えて拡張を再読み込みするだけ。押すキーはCmdのままで、
表示だけが `Ctrl` になる。**撮影後は必ず戻す。**
`scripts/package.sh` が検知して提出手順を止めるので、戻し忘れても事故にはならない。

### 直したこと（実機で効果未確認）

- `brActiveLine()` を追加。`brConfirm` / `brClickAction` / `brCandidates` が `lines[brIdx]` ではなく
  **フォーカスのある行**に追従する。Xeroはフォームを触ると行を再描画して拡張の印を消すため、
  `brIdx` は当てにならない。マウスで行を選んだ場合も同じ。
  実機診断: `brIdx=-1 / フォーカス行=13` でズレを確認済み
- `brCandKey()` を追加。候補選択中のキーを入力欄の内外どちらからも拾う。
  Space でチェックボックスにフォーカスが移るため、従来は続く Enter が Xero に食われていた
- `brSay()` を追加。確定できなかった理由を画面下中央に `position:fixed` で表示

### ❌ 別クライアントの帳簿に着地する（最優先・未修正）

**2026-08-11 実機で発生。** 3組織（Demo Company / aaa / bbb）のタブを開いた状態で、
**Demo Companyのホームから Ctrl+K → Bank Reconciliation を選んだら bbb の照合画面に着地した。**
もう一度やると正しく着地した＝再現性は不安定。

原因はURLの構造。

```
/BankRec/BankRec.aspx?accountId={bankAccountId}
```

**このURLに組織IDが一切含まれていない。** Xeroは旧.aspxページの組織をセッションの
「現在の組織」から決める。セッションはタブ間で共有されるので、**最後にどのタブが組織を
切り替えたかで着地先が変わる。**

`xp_bank_accounts` を組織IDでキーにする対策は入っているが、それは「どのaccountIdを渡すか」
の話であって、**Xeroがどの組織で開くかは制御できていない。**

⚠️ **Organisation workspace（Solo Pro・v0.9.0の新機能）が事態を悪化させている。**
複数組織のタブを一括で開く機能なので、この曖昧な状態が常態になる。

簿記担当にとって「別のクライアントの帳簿を開く」は最悪の事故。**提出前に必ず対処すること。**

対策案（要実機検証）:

1. 先に組織スコープのURL（`/app/{orgId}/homepage` など）へ寄ってセッションの組織を固定し、
   それからBank Recへ移動する。2段遷移になるが確実な可能性。**この方式が効くか未検証**
2. 着地後に `ocOrgId()` が意図した組織と一致するか検証し、違えば大きく警告して止める。
   1が効かない場合でも**これは必ず入れる**（黙って別の帳簿を見せないため）
3. 同様に組織IDを持たない他の旧.aspx行き先（パレット39件のうち相当数）も同じ問題を抱える。
   Bank Recだけの話ではないので、`buildUrl` の層で解くのが筋

### ❌ 残っている問題

**`brSay()` の表示がユーザーに見えない。**（2026-08-07 実機で「理由が見えない」と報告）

最初は緑のバー内に出していたが、Find & Match のパネルが縦に長く確定ボタンが最下部にあるため、
バーが画面外だった。`position:fixed` の浮動表示に変えたが**それでも見えていない**。原因未特定。

次に確かめること:

- `#xp-br-notice` が DOM に生成されているか（`document.getElementById('xp-br-notice')`）
- 生成されていて見えないなら: `z-index` 負け / Xero側の `overflow:hidden` を持つ祖先 /
  `transform` を持つ祖先による `position:fixed` の封じ込め
- そもそも `brSay()` が呼ばれているか（`brConfirm` が `button` を見つけていない可能性）
- 4.5秒で消えるので、押した直後を見ていない可能性も潰す

### 中断した撮影

`docs/video-shoot-plan.md` の Phase 1 は 1-1〜1-9 まで撮影済み。
**1-10（Match候補の確定）と 1-11（Create の保存）が未撮影** — 上のバグのため。
Phase 2（Solo Pro）・Phase 3（Practice Pro）は未着手。

---

## 前提条件（引っかかりやすい点）

- **トラッキング必須化**: その組織にトラッキングカテゴリが必要（Demo Companyは「Region」）。未設定の組織では**何も起きないのが正常**
- **組織カラー**: 無料枠の確認に2組織、有料解除の確認に3組織必要
- **Awaiting Approval Watch**: 設定ON時にChrome通知権限を許可する。Xero APIを巡回しないため、各一覧を一度開いて件数を観測する必要がある
- **Find & Recode index**: 検索実行後、Description列を含む結果が画面に表示されている必要がある
