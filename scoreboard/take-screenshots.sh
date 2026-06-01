#!/usr/bin/env bash
set -e

SCOREBOARD_DIR="$(cd "$(dirname "$0")" && pwd)"
PLAYWRIGHT_DIR="$SCOREBOARD_DIR/../tidtaker"

# Kill any running server
pkill -f "node server.js" 2>/dev/null || true
sleep 1

for N in 1 2 3 4 5 6 7; do
  echo "=== Starting server with MAX_MODULE=$N ==="
  MAX_MODULE=$N node "$SCOREBOARD_DIR/server.js" &
  SERVER_PID=$!
  sleep 4

  echo "Taking screenshot deteksjon-del-$N.png"
  node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '$SCOREBOARD_DIR/deteksjon-del-$N.png', fullPage: true });
  await browser.close();
  console.log('Screenshot $N done');
})();
" --input-type=module 2>&1 || node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '$SCOREBOARD_DIR/deteksjon-del-$N.png', fullPage: true });
  await browser.close();
  console.log('Screenshot $N done');
})();
"

  kill $SERVER_PID 2>/dev/null || true
  wait $SERVER_PID 2>/dev/null || true
  sleep 1
done

echo "All screenshots done"
