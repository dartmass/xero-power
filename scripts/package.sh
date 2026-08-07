#!/bin/bash
# Package Xero Power for Chrome Web Store submission
# Usage: bash scripts/package.sh
set -e

cd "$(dirname "$0")/.."

VERSION=$(node -e "const m=require('./manifest.json'); console.log(m.version)")
OUT="xero-power-v${VERSION}.zip"

echo "📦 Packaging Xero Power v${VERSION}..."

# Remove old zip if exists
rm -f "$OUT"

# Create zip with only the files Chrome Web Store needs
zip -r "$OUT" \
  manifest.json \
  shortcut-capture.js \
  content.js \
  background.js \
  popup.html \
  popup.js \
  options.html \
  options.js \
  welcome.html \
  icons/

echo ""
echo "✅ Created: $OUT"
echo ""
echo "Contents:"
unzip -l "$OUT"
echo ""

# ── 提出前チェック ──────────────────────────────────────────────
# 合言葉を入れれば Pro になる分岐は、入ったまま出すと解除方法を配ることになる。
# 変数名ではなく zip の中身そのものを見る。名前を変えても素通りしないように。
# ビルドは止めない（検証用のzipは作れる必要があるため）。目立つ警告だけ出す。
QA_KEYS=$(
  for f in $(unzip -Z1 "$OUT" | grep -E '\.(js|html)$'); do
    unzip -p "$OUT" "$f" \
      | grep -Hn --label="$f" -E "['\"](DEV|QA|TEST|OWNER)-[A-Z0-9-]{2,}['\"]|XP-[A-Z]+-UNLOCK|YOUR_POLAR" \
      || true
  done
)
if [ -n "$QA_KEYS" ]; then
  echo "┌──────────────────────────────────────────────────────────┐"
  echo "│  ⚠️  検証用ビルド — このzipは提出しないこと                │"
  echo "└──────────────────────────────────────────────────────────┘"
  echo "  合言葉で解除できる文字列が入っています:"
  printf '%s\n' "$QA_KEYS" | sed 's/^/    /'
  echo "  該当箇所を削ってから作り直してください。"
  echo "  検証で Pro にしたいときはコードではなく storage を直接書く（docs/qa-v0.9.0.md 参照）。"
  echo ""
  exit 0
fi

echo "✅ 提出前チェック: 合言葉による解除経路なし"
echo ""
echo "Next steps:"
echo "  1. Go to https://chrome.google.com/webstore/devconsole"
echo "  2. Upload $OUT"
