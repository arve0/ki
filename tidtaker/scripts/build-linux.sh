#!/usr/bin/env bash
set -euo pipefail

# Build tidtaker for Linux (for deployment to Hetzner)
VERSION="${1:-dev}"
OUTPUT="dist/tidtaker-${VERSION}"

echo "Cross-compiling tidtaker ${VERSION} for linux/amd64..."
GOOS=linux GOARCH=amd64 go build -o "${OUTPUT}" .
echo "Built: ${OUTPUT}"
