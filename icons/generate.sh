#!/bin/bash
# Regenerate PNG icons from icon.svg

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

for size in 16 48 128; do
  rsvg-convert -w "$size" -h "$size" "$DIR/icon.svg" -o "$DIR/icon${size}.png"
  echo "Generated icon${size}.png"
done
