#!/bin/bash
# ─────────────────────────────────────────────────────────────────
#  Fortinet OT Demo Controller — Mac Launcher
#  Run once:  chmod +x launch.sh
#  Run daily: ./launch.sh
# ─────────────────────────────────────────────────────────────────

set -e

BOLD='\033[1m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   FORTINET OT DEMO CONTROLLER — MAC LAUNCHER    ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ── Check Node.js ──────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${RED}ERROR: Node.js not found.${NC}"
  echo ""
  echo "Install it one of two ways:"
  echo "  1. Homebrew (recommended):  brew install node"
  echo "  2. Direct download:         https://nodejs.org  (LTS version)"
  echo ""
  exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✓${NC} Node.js ${NODE_VERSION} found"

# ── Install dependencies if needed ─────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}→${NC} Installing dependencies (first run only)..."
  npm install --silent
  echo -e "${GREEN}✓${NC} Dependencies installed"
else
  echo -e "${GREEN}✓${NC} Dependencies already installed"
fi

# ── Get LAN IP for display ──────────────────────────────────────
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "unknown")

echo ""
echo -e "${CYAN}Starting demo server...${NC}"
echo ""
echo -e "  ${BOLD}App URL:${NC}          http://localhost:3000"
echo -e "  ${BOLD}On your network:${NC}  http://${LAN_IP}:3000"
echo ""
echo -e "  ${BOLD}FortiGate automation stitch webhook:${NC}"
echo -e "  ${YELLOW}  http://${LAN_IP}:3000/webhook${NC}"
echo ""
echo -e "  Configure this URL in FortiGate:"
echo -e "  ${CYAN}  Security Fabric > Automation > Stitch > Action: Webhook${NC}"
echo ""
echo -e "Press ${BOLD}Ctrl+C${NC} to stop the server."
echo ""

# ── Open browser after short delay ─────────────────────────────
(sleep 2 && open "http://localhost:3000") &

# ── Start server ────────────────────────────────────────────────
node server.js
