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
echo "Next steps:"
echo "  1. Go to https://chrome.google.com/webstore/devconsole"
echo "  2. Click '+ New item'"
echo "  3. Upload $OUT"
