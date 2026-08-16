# YouTube — Xero Power v0.9.0 デモ動画

動画の中身は `docs/video-edit-plan.md`。ここは**掲載文**だけ。

⚠️ 旧版（v0.7時代・Approveボタン単体の切り口）は破棄した。今回は3プラン全体の紹介。

---

## タイトル

**採用案**

```
Xero dark mode + a safer Approve button: 4 things Xero said it won't build
```

**代案**

```
1,572 people asked Xero for these features. Xero said no.
```
```
4 things Xero won't build for you — free Chrome extension
```

**選び方**: 採用案は先頭に `Xero dark mode` を置いている。
「xero dark mode」「xero approve button」で検索する人に当たるため。
代案1は引きが強いが**検索語が1つも入っていない**ので、既に知っている人にしか届かない。

---

## 概要欄

```
Xero has a list of things people keep asking for. These four are all marked "not in pipeline" — Xero has said it will not build them.

・Dark mode — 533 votes
・Choosing what the Approve button does, so it stops emailing your client — 444 votes
・A colour per organisation, so you know whose books you are in — 308 votes
・Making a tracking category required before a line is approved — 287 votes

So I built them, as a Chrome extension for xero.com.

Install (free): https://chromewebstore.google.com/detail/aikgpmhkhmmppadcnijgcljehhjchcmp

──────────────────────
What it does
──────────────────────

Ctrl+K anywhere in Xero opens a searchable list of 39 screens. Type "rec" and press Enter to land on bank reconciliation. It learns which screens you use and floats them to the top.

Bank reconciliation runs from the keyboard: arrow between statement lines, M to match, C to create, T to transfer, Space to pick a transaction out of the match list, Enter to reconcile, Ctrl+Enter to save. A hint bar shows the keys while you work.

The Approve button on an invoice defaults to "Approve & email", so one stray click emails your client. Xero Power makes plain Approve the default. Emailing stays one click away in the dropdown.

Dark mode covers every Xero screen.

Each organisation gets its own navigation bar colour. The extension also warns you when Xero has opened a different organisation than the one you set out from — 23 of Xero's screens carry no organisation in their address and follow whichever tab moved last.

──────────────────────
For practices
──────────────────────

Approval guardrails block Approve until every populated line carries a tracking category and a description — on invoices, on bills, and in bank reconciliation. Drafts still save, so nobody loses work in progress.

Bank reconciliation is the one that matters. For Making Tax Digital, Xero's own guidance is to separate businesses with tracking categories, and a line without one is left out of the quarterly totals sent to HMRC. Xero has said making the field required is not on its roadmap, and suggests finding the gaps afterwards with Find & Recode — after the return has gone.

──────────────────────
Plans
──────────────────────

Free — command palette, bank reconciliation shortcuts, safer Approve default, dark mode, wrong-organisation warning, two organisation colours
Solo Pro $14.99/month — unlimited organisation colours, custom shortcuts, multi-organisation workspace, list tools
Practice Pro $44.99/month — everything above plus the approval guardrails, approval queue watch, and Find & Recode review tools

──────────────────────
The Xero threads
──────────────────────

Dark mode (533)
https://productideas.xero.com/forums/967121-users-setup/suggestions/44961454-organisation-settings-dark-mode

Approve button default (444)
https://productideas.xero.com/forums/967115-invoices-quotes/suggestions/45438514-invoicing-select-default-for-approve-button-e

Organisation colour (308)
https://productideas.xero.com/forums/967121-users-setup/suggestions/44988652-organisation-settings-ability-to-set-colour-of-o

Tracking mandatory (287)
https://productideas.xero.com/forums/967124-projects-tracking/suggestions/44960332-tracking-make-mandatory-required

──────────────────────
Privacy
──────────────────────

Xero Power reads the Xero page in front of you to do its job. Nothing about your accounting data leaves your browser. No analytics, no tracking, no ads.
https://dartmass.github.io/xero-power/privacy-policy.html

──────────────────────
Chapters
──────────────────────
0:00 Four things Xero said it won't build
0:04 Ctrl+K — jump to any screen
0:16 The Approve button that emails your client
0:29 Dark mode
0:35 Bank reconciliation without the mouse
0:55 A colour for every client
1:00 Open every client at once
1:10 Stop miscoded lines before they are approved
1:30 Plans
```

---

## タグ

```
xero, xero dark mode, xero approve button, xero keyboard shortcuts, xero command palette, xero bank reconciliation, xero tracking categories, xero chrome extension, making tax digital, mtd for income tax, bookkeeping, xero tips, xero for accountants, xero power
```

---

## 公開設定

**最初は限定公開（Unlisted）にする。**

- welcome.html にもストア掲載にも埋め込める
- 検索に出ないので、内容を直したくなったとき差し替えやすい
- 固まってから公開に切り替える

## 差し込み先

`welcome.html` の `VIDEO_ID`（553行目付近）。URLの `watch?v=` の後ろの文字列。

```js
const VIDEO_ID = 'XXXXXXXXXXX';
```
