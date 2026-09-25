#!/usr/bin/env bash
# Alle Browser-Tests gegen einen frischen statischen Server auf :8099.
#   tests/browser/alle.sh              alle
#   tests/browser/alle.sh stein drand  nur Tests, deren Name das enthaelt
# Screenshots landen in tests/browser/schuesse/ (nicht eingecheckt).
set -u
hier="$(cd "$(dirname "$0")" && pwd)"
wurzel="$(cd "$hier/../.." && pwd)"
cd "$hier"
[ -d node_modules/@noble/curves ] || npm install --silent --no-audit --no-fund >/dev/null
mkdir -p schuesse logs

# Server starten und ueber seine PID wieder beenden - nicht mit pkill -f,
# das trifft sonst die eigene Shell.
(cd "$wurzel" && exec npx --yes http-server -p 8099 -s -c-1) >/dev/null 2>&1 &
server=$!
trap 'kill $server 2>/dev/null; pkill -P $server 2>/dev/null; for p in $(pgrep -x http-server); do kill $p 2>/dev/null; done' EXIT
for i in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:8099/index.html && break; sleep 0.5; done

node "$wurzel/tests/test-zeitkonto.js" >logs/test-zeitkonto.log 2>&1 && echo "ok   test-zeitkonto" || { echo "FEHL test-zeitkonto"; fehl=1; }
fehl=${fehl:-0}
for t in test-*.js; do
  name="${t%.js}"
  if [ $# -gt 0 ]; then treffer=0; for m in "$@"; do [[ "$name" == *"$m"* ]] && treffer=1; done; [ $treffer = 1 ] || continue; fi
  if timeout 300 node "$t" >"logs/$name.log" 2>&1; then echo "ok   $name"; else echo "FEHL $name  (logs/$name.log)"; fehl=1; fi
done
exit $fehl
