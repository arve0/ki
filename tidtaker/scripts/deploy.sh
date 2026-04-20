#!/usr/bin/env bash
set -euo pipefail

# Deploy tidtaker to a Hetzner server
# Requires: hcloud CLI, ssh access
#
# Usage:
#   ./scripts/deploy.sh <version>
#   Example: ./scripts/deploy.sh 1.0.0

VERSION="${1:?Usage: deploy.sh <version>}"
SERVER_NAME="tidtaker-prod"

# Get or create server
if ! hcloud server describe "${SERVER_NAME}" &>/dev/null; then
  echo "Creating server ${SERVER_NAME}..."
  hcloud server create --name "${SERVER_NAME}" --type cpx11 --image ubuntu-24.04 --ssh-key default
fi

SERVER_IP=$(hcloud server ip "${SERVER_NAME}")
echo "Server IP: ${SERVER_IP}"
echo "${SERVER_IP}" > server.txt

# Initial server setup (idempotent)
echo "Setting up server..."
ssh -o StrictHostKeyChecking=accept-new root@"${SERVER_IP}" bash <<'SETUP'
apt-get update -qq && apt-get install -y -qq ca-certificates curl > /dev/null
useradd --system --home /opt/tidtaker --shell /usr/sbin/nologin tidtaker 2>/dev/null || true
mkdir -p /opt/tidtaker/releases /opt/tidtaker/data
chown -R tidtaker:tidtaker /opt/tidtaker
SETUP

# Build for Linux
echo "Building version ${VERSION}..."
GOOS=linux GOARCH=amd64 go build -o "dist/tidtaker-${VERSION}" .

# Upload binary (only if not already present)
echo "Uploading binary..."
ssh root@"${SERVER_IP}" "test -f /opt/tidtaker/releases/tidtaker-${VERSION}" || \
  scp "dist/tidtaker-${VERSION}" root@"${SERVER_IP}":/opt/tidtaker/releases/
ssh root@"${SERVER_IP}" "chmod +x /opt/tidtaker/releases/tidtaker-${VERSION}"

# Create systemd service
echo "Creating systemd service..."
cat <<EOF | ssh root@"${SERVER_IP}" "cat > /etc/systemd/system/tidtaker-${VERSION}.service"
[Unit]
Description=Tidtaker PocketBase ${VERSION}
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/tidtaker
ExecStart=/opt/tidtaker/releases/tidtaker-${VERSION} serve --http=0.0.0.0:8090 --dir=/opt/tidtaker/data
Restart=always
RestartSec=3
User=tidtaker

[Install]
WantedBy=multi-user.target
EOF

# Stop old versions
echo "Stopping old versions..."
for svc in $(ssh root@"${SERVER_IP}" "systemctl list-units --type=service --all --no-legend 'tidtaker-*.service'" | awk '{print $1}'); do
  if [ "${svc}" != "tidtaker-${VERSION}.service" ]; then
    ssh root@"${SERVER_IP}" "systemctl stop ${svc} && systemctl disable ${svc}" || true
  fi
done

# Start new version
echo "Starting tidtaker ${VERSION}..."
ssh root@"${SERVER_IP}" "systemctl daemon-reload && systemctl enable tidtaker-${VERSION}.service && systemctl start tidtaker-${VERSION}.service"

echo ""
echo "Deployed! Service running at http://${SERVER_IP}:8090"
echo "Check status: ssh root@${SERVER_IP} systemctl status tidtaker-${VERSION}.service"
