#!/usr/bin/env bash
set -euo pipefail

URL="${1:-http://127.0.0.1:4173}"
CHROME="${CHROME_BIN:-google-chrome}"

html="$($CHROME --headless --no-sandbox --disable-dev-shm-usage --disable-gpu \
  --virtual-time-budget=5000 --dump-dom "$URL" 2>/dev/null)"

grep -q 'Admin CESCA' <<<"$html"
grep -q '>Entrar<' <<<"$html"
test "$(grep -o 'id="root"' <<<"$html" | wc -l)" -eq 1

echo "Smoke frontend OK: login renderizado em $URL"
