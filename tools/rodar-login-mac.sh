#!/usr/bin/env bash
# Testa o login LOCAL no Mac. Nada vai pra Cloudflare: o D1 é simulado em .wrangler/state (pasta server/).
# Uso: ./tools/rodar-login-mac.sh      (Ctrl+C para parar tudo)
set -e
cd "$(dirname "$0")/.."
SITE_PORT="${SITE_PORT:-8135}"; WORKER_PORT="${WORKER_PORT:-8795}"
for p in "$SITE_PORT" "$WORKER_PORT"; do
  if lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then echo "Porta $p ocupada. Rode assim: SITE_PORT=8140 WORKER_PORT=8800 $0"; exit 1; fi
done
cd server
[ -d node_modules/wrangler ] || npm install --no-audit --no-fund
npx wrangler d1 migrations apply docao-contas --local
npx wrangler dev --port "$WORKER_PORT" --var "DEV_UNLOCK_SKINS:${DEV_UNLOCK_SKINS:-1}" > ../wrangler-login.log 2>&1 &
WR=$!
cd ..
python3 -m http.server "$SITE_PORT" > http-login.log 2>&1 &
HP=$!
trap 'kill $WR $HP 2>/dev/null' EXIT INT TERM
sleep 6
URL="http://localhost:$SITE_PORT/?server=ws://localhost:$WORKER_PORT"
echo; echo "Abrindo: $URL"; echo "(Ctrl+C para parar. Para zerar as contas de teste: apague a pasta server/.wrangler)"
open "$URL" 2>/dev/null || true
wait
