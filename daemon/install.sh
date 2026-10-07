#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != Linux || "${EUID}" -ne 0 ]]; then
  echo "Run this installer as root on Linux with systemd." >&2
  exit 1
fi
if [[ $# -gt 1 ]]; then
  echo "Usage: sudo bash daemon/install.sh [/opt/lattice]" >&2
  exit 1
fi
source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
deployment="$(realpath -- "${1:-/opt/lattice}")"
for tool in php docker git systemctl; do
  command -v "$tool" >/dev/null || { echo "Missing prerequisite: $tool" >&2; exit 1; }
done
php -r 'exit(PHP_VERSION_ID >= 80200 && extension_loaded("curl") && extension_loaded("pcntl") && extension_loaded("posix") ? 0 : 1);' ||
  { echo "PHP 8.2+ with curl, pcntl, and posix is required." >&2; exit 1; }
[[ -f "$deployment/compose.yaml" && -f "$deployment/.env" ]] ||
  { echo "Configure a Lattice Docker checkout with compose.yaml and .env first." >&2; exit 1; }
if [[ -e /usr/local/bin/daemon || -L /usr/local/bin/daemon ]]; then
  [[ "$(readlink /usr/local/bin/daemon)" == /usr/local/lib/lattice-daemon/bin/daemon ]] ||
    { echo "/usr/local/bin/daemon already belongs to another installation." >&2; exit 1; }
fi

# Stop before replacing PHP classes so a running operation cannot mix releases.
if systemctl is-active --quiet lattice-daemon.service; then
  systemctl stop lattice-daemon.service
fi
install -d -m 0755 /usr/local/lib/lattice-daemon/bin /usr/local/lib/lattice-daemon/src
install -m 0644 "$source_dir/autoload.php" /usr/local/lib/lattice-daemon/autoload.php
install -m 0644 "$source_dir"/src/*.php /usr/local/lib/lattice-daemon/src/
install -m 0755 "$source_dir/bin/daemon" /usr/local/lib/lattice-daemon/bin/daemon
ln -sfn /usr/local/lib/lattice-daemon/bin/daemon /usr/local/bin/daemon
install -d -m 0700 /etc/lattice /var/lib/lattice-daemon
if [[ ! -e /etc/lattice/daemon.json ]]; then
  /usr/local/bin/daemon init --directory "$deployment"
else
  echo "Preserving /etc/lattice/daemon.json."
fi
/usr/local/bin/daemon doctor
install -m 0644 "$source_dir/systemd/lattice-daemon.service" /etc/systemd/system/lattice-daemon.service
systemctl daemon-reload
systemctl enable --now lattice-daemon.service
echo "daemon installed. Check: sudo daemon status"
echo "Updates remain opt-in: sudo daemon auto-update on"
