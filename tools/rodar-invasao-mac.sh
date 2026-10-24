#!/usr/bin/env bash
# Testa o modo INFECÇÃO 🧟 (zumbis × sobreviventes, até 50) LOCAL no Mac. Nada vai pra Cloudflare: D1 simulado em server/.wrangler/state.
# Uso: ./tools/rodar-invasao-mac.sh          (Ctrl+C para parar tudo)   ·   Portas: SITE_PORT (8138) e WORKER_PORT (8798)
#      TESTE=1 ./tools/rodar-invasao-mac.sh  liga os ganchos de teste (ALLOW_TEST=1, SÓ local) usados por tools/test-online-infeccao.mjs
# Vários jogadores: abra o link em outras abas/janelas anônimas (ou outro navegador) e entre com o código da sala (&sala=CÓDIGO).
set -e
cd "$(dirname "$0")/.."
SITE_PORT="${SITE_PORT:-8138}"; WORKER_PORT="${WORKER_PORT:-8798}"
for p in "$SITE_PORT" "$WORKER_PORT"; do
  if lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then echo "Porta $p ocupada. Rode assim: SITE_PORT=8142 WORKER_PORT=8802 $0"; exit 1; fi
done
cd server
[ -d node_modules/wrangler ] || npm install --no-audit --no-fund
npx wrangler d1 migrations apply docao-contas --local   # banco LOCAL (o modo não precisa de migração nova)
EXTRA=(); [ "${TESTE:-0}" = "1" ] && EXTRA=(--var ALLOW_TEST:1)
npx wrangler dev --port "$WORKER_PORT" "${EXTRA[@]}" > ../wrangler-invasao.log 2>&1 &
WR=$!
cd ..
python3 -m http.server "$SITE_PORT" > http-invasao.log 2>&1 &
HP=$!
trap 'kill $WR $HP 2>/dev/null' EXIT INT TERM
sleep 6
URL="http://localhost:$SITE_PORT/?server=ws://localhost:$WORKER_PORT"
echo; echo "Abrindo: $URL"
echo "1) JOGAR ONLINE → Modo: Infecção 🧟 (mapa Fazendona, máx. até 50, bots completam até 15)"
echo "2) Crie a sala e abra o mesmo link em outra aba anônima com &sala=CÓDIGO para entrar como 2º jogador"
echo "3) 15 s depois do início sai o surto: o zumbi só tem faca (golpe infecta) e o Q arremessa a faquinha"
[ "${TESTE:-0}" = "1" ] && echo "Teste automático (outro terminal):  node tools/test-online-infeccao.mjs http://127.0.0.1:$SITE_PORT/ ws://127.0.0.1:$WORKER_PORT"
open "$URL" 2>/dev/null || true
wait
