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
# オーナーキーは実機検証用。入ったまま出すと解除方法を配ることになる。
# ビルドは止めない（検証用のzipは作れる必要があるため）。目立つ警告だけ出す。
if unzip -p "$OUT" options.js | grep -q "OWNER_KEY *= *'[^']"; then
  KEY=$(unzip -p "$OUT" options.js | grep -o "OWNER_KEY *= *'[^']*'" | head -1)
  echo "┌──────────────────────────────────────────────────────────┐"
  echo "│  ⚠️  検証用ビルド — このzipは提出しないこと                │"
  echo "└──────────────────────────────────────────────────────────┘"
  echo "  オーナーキーが入っています: $KEY"
  echo "  options.js の OWNER_KEY を '' にしてから作り直してください。"
  echo ""
  exit 0
fi

echo "✅ 提出前チェック: オーナーキーなし"
echo ""
echo "Next steps:"
echo "  1. Go to https://chrome.google.com/webstore/devconsole"
echo "  2. Upload $OUT"
