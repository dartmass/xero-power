# デモ動画 編集台本（FCPX）

**尺の目標: 90秒。** 音声なし、テロップだけで進める。
置き場所は `welcome.html` の `VIDEO_ID`（初回インストール時に全員が見る）とストア掲載、Reddit。

素材は `screen_video/`。

---

## 方針

**プランの紹介にしない。** 「Free ではこれができます、Solo Pro では…」は退屈で、
見ている人は自分に関係あるか分からない。

**痛み → 解消**を並べる。プラン名は右下に小さく出すだけにする。

音がないので**テロップが全部を背負う**。1カットに1文まで。読ませようとしない。

⚠️ **Mac専用記号を使わない。** `Cmd` `Ctrl` `Enter` と単語で書く。ユーザーの主体はWindows。

---

## 構成

### 宣言（0:00 – 0:04）

黒背景にテロップ3枚。映像は無し。

```
Dark mode. A safe Approve button.
A colour per client. Required tracking.

1,572 people asked Xero for these.
Xero said no to all four.

So here they are.
```

**根拠（Xero Product Ideas・すべて "Not in pipeline"）**

| 機能 | 票 |
|---|---|
| Organisation settings - Dark mode | 533 |
| Invoicing - Select default for 'Approve' Button | 444 |
| Organisation Settings - Ability to set colour of org | 308 |
| Tracking - Make mandatory / required | 287 |
| | **1,572** |

この動画の主要機能は**全部Xeroが断ったもの**。偶然ではなく、`OPEN_EXPLICIT_NO` から選んだ結果。
「便利です」はこちらの主張だが、**票数とXeroの回答は検証可能な事実**なので、そこから始める。

### つかみ（0:04 – 0:16）

| 素材 | 尺 | テロップ |
|---|---|---|
| 1-4（メニューを手でクリック） | 6秒 | `Purchases → Bills → Awaiting approval` |
| 1-2（Ctrl+K で一発） | 6秒 | `Ctrl + K` |

**ここが動画の全て。** 手でクリックする退屈な6秒を削らないこと。比較対象が無いと速さは伝わらない。

最後に一言だけ: `39 screens. No mouse.`

---

### 承認ボタン（0:16 – 0:29）

| 素材 | 尺 | テロップ |
|---|---|---|
| 1-5（Approve既定） | 13秒 | `Xero's default sends an email to your client` → `440 people asked Xero to change it` → `Xero said no` → `Now it just approves. Email is still one click away.` |

**票数を出す。** 「便利です」ではなく「みんなが頼んで断られた」という事実が効く。

---

### 銀行照合（0:29 – 0:49）

| 素材 | 尺 | テロップ |
|---|---|---|
| 1-9（↑↓ M C T D） | 8秒 | `Up / Down · M · C · T · D` |
| 1-10（候補選択） | 8秒 | `Space to pick` → `Enter to reconcile` |
| 1-11（Create保存） | 4秒 | `Ctrl + Enter to save` |

1-9 は緑のヒントバーが映るように。**キーを押した瞬間にテロップを出す**（キーキャストを使わない代わり）。

---

### 迷子防止（0:49 – 0:54）

| 素材 | 尺 | テロップ |
|---|---|---|
| 1-7（組織カラー） | 5秒 | `A colour for every client` |
| （あれば別組織警告） | 5秒 | `23 Xero screens don't say which organisation they open` → `Now you find out before you type` |

警告の実写が無ければ、組織カラーだけで5秒に縮める。

---

### 複数組織（0:54 – 1:04）※Solo Pro

| 素材 | 尺 | テロップ |
|---|---|---|
| 2-4（ワークスペース） | 10秒 | `Open every client at once` ／ 右下に小さく `Solo Pro` |

**2-3（キー変更）・2-5・2-6 は落とす。** 尺が足りない。単体では弱い。

---

### 承認ガードレール（1:04 – 1:24）※Practice Pro

| 素材 | 尺 | テロップ |
|---|---|---|
| 3-4（tracking + description 同時） | 8秒 | `Approve is blocked until the line is coded` |
| 3-5（Saveは通る） | 4秒 | `Drafts still save. Nobody loses work.` |
| **3-9（銀行照合）** | 8秒 | `Xero leaves untracked lines out of your MTD quarterly totals` → `and won't make the field required` → `So we did` |

**3-9 が動画で一番強い。** 他社が構造的に入れない場所なので。
編集では **1-11（Freeでは通る）→ 3-9（Practice Proでは止まる）** の順に置くと差が一目で分かるが、
尺が厳しければ 3-9 単体でもよい。

3-2 / 3-3 は 3-4 と内容が重なるので落とす。3-6（Find & Recode）・3-7（承認キュー）も落とす。
**3-8（通知）は、尺が余ったら最後に4秒。**

---

### 締め（1:24 – 1:29）

静止画で十分。

```
Xero Power
Free — palette, shortcuts, dark mode, 2 organisation colours
Solo Pro $14.99 / Practice Pro $44.99
Chrome Web Store
```

---

## 落とすもの（迷ったとき用）

1. 3-8（通知）
2. 2-4（ワークスペース）
3. 1-7（組織カラー）
4. 1-11（Create保存）

**最後まで残すのは、つかみ・承認ボタン・1-10・3-9 の4つ。**

---

## テロップの作り方

FCPXで**タイトルを1つ作って保存**し、複製して文字だけ差し替える。

- 位置: 下1/3。Xeroの操作対象に被せない
- キー表記は `Ctrl + K` のように単語で（`⌘` は使わない）
- 表示は最低1.5秒。動画は縮小されて見られる

---

## 使わない素材

- **1-9 の後半**（`1-9_後半はバグ発見したので不要.mov`）— 前半だけ使う
- **`画面収録 2026-08-11 4.43.47.mov`** — 使わない

---

## テロップ一覧（出す順・そのまま打ち込む）

```
0a  Dark mode. A safe Approve button.
    A colour per client. Required tracking.
0b  1,572 people asked Xero for these.
    Xero said no to all four.
0c  So here they are.

1   Purchases → Bills → Awaiting approval
2   Ctrl + K
3   39 screens. No mouse.

4   Xero's default sends an email to your client
5   440 people asked Xero to change it
6   Xero said no
7   Now it just approves. Email is still one click away.

8   Up / Down · M · C · T · D
9   Space to pick
10  Enter to reconcile
11  Ctrl + Enter to save

12  A colour for every client

13  Open every client at once
14  Solo Pro                          ← 右下に小さく

15  Approve is blocked until the line is coded
16  Drafts still save. Nobody loses work.
17  Practice Pro                      ← 右下に小さく

18  Xero leaves untracked lines out of your MTD quarterly totals
19  and won't make the field required
20  So we did

21  Xero Power
22  Free — palette, shortcuts, dark mode, 2 organisation colours
23  Solo Pro $14.99 / Practice Pro $44.99
24  Chrome Web Store
```

**20 で一拍置く。** ここが動画の主張なので、次のカットに急がない。
