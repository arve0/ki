#!/usr/bin/env bash
set -euo pipefail

# Build tidtaker for the current platform
VERSION="${1:-dev}"
OUTPUT="dist/tidtaker-${VERSION}"

echo "Building tidtaker ${VERSION}..."
go build -o "${OUTPUT}" .
echo "Built: ${OUTPUT}"
