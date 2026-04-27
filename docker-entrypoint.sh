#!/bin/sh
set -eu

mkdir -p /data/api-responses

if [ ! -f /data/.bc-game-stats.json ]; then
  cat > /data/.bc-game-stats.json <<'EOF'
{
  "totalUsdClaimed": 0,
  "totalBcReceived": 0,
  "totalBcStaked": 0,
  "totalBcUsdValue": 0,
  "cycleCount": 0,
  "avgBcPrice": 0
}
EOF
fi

touch /data/bc-game.log

chown -R node:node /data 2>/dev/null || true

exec su-exec node "$@"
