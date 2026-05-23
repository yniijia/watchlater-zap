#!/bin/bash
# Simple script to package the Chrome extension for publishing

VERSION=$(grep -o '"version": "[^"]*' manifest.json | cut -d'"' -f4)
NAME="watchlater-zap-v$VERSION"

echo "Packaging WatchLater Zap v$VERSION..."

# Remove any existing package
rm -f "$NAME.zip" 2>/dev/null

# Create ZIP package with only necessary files
zip -r "$NAME.zip" \
  manifest.json \
  popup.html \
  css/ \
  js/ \
  icons/icon16.png \
  icons/icon48.png \
  icons/icon128.png \
  PRIVACY.md \
  README.md

echo "Package created: $NAME.zip"
echo "Ready for upload to the Chrome Web Store!" 