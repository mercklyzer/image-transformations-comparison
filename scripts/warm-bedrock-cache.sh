#!/usr/bin/env bash
#
# Warm the Bedrock palette cache by curling /api/palette-bedrock for every image.
#
# Usage:
#   ./scripts/warm-bedrock-cache.sh
#
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Extract all source URLs from both JSON files using node
URLS=$(node -e "
  const b = require('$PROJECT_DIR/src/data/images.json');
  const f = require('$PROJECT_DIR/src/data/images-footwear.json');
  const all = [...b, ...f];
  for (const img of all) {
    if (img.source) console.log(img.base + '\t' + img.source);
  }
")

TOTAL=$(echo "$URLS" | wc -l | tr -d ' ')
echo ""
echo "Total images: $TOTAL"
echo "Base URL: $BASE_URL"
echo ""

SUCCEEDED=0
FAILED=0
COUNT=0

while IFS=$'\t' read -r BASE SOURCE; do
  COUNT=$((COUNT + 1))
  ENCODED=$(node -e "process.stdout.write(encodeURIComponent('$SOURCE'))")
  URL="${BASE_URL}/api/palette-bedrock?url=${ENCODED}"

  echo "  → curl $URL"

  HTTP_CODE=$(curl -s -o /tmp/bedrock-response.json -w "%{http_code}" "$URL")

  BODY=$(cat /tmp/bedrock-response.json)
  HEX=$(echo "$BODY" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      try { const j=JSON.parse(d); process.stdout.write(j.hex||''); } catch {}
    });
  ")

  if [[ "$HTTP_CODE" == "200" && -n "$HEX" ]]; then
    SUCCEEDED=$((SUCCEEDED + 1))
    echo "[$COUNT/$TOTAL] ✓ $BASE → $HEX"
  else
    FAILED=$((FAILED + 1))
    echo "[$COUNT/$TOTAL] ✗ $BASE → HTTP $HTTP_CODE: $BODY"
  fi
done <<< "$URLS"

echo ""
echo "--- Summary ---"
echo "Total:     $TOTAL"
echo "Succeeded: $SUCCEEDED"
echo "Failed:    $FAILED"
