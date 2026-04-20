#!/usr/bin/env bash
set -euo pipefail

# Run the tidtaker development server
echo "Starting tidtaker dev server..."
echo "Dashboard: http://localhost:8090/_/"
echo "App:       http://localhost:8090/"
echo ""

go run . serve --http=127.0.0.1:8090 --dev
