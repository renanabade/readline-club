#!/usr/bin/env bash
# Prepara uma sessão de desenvolvimento na nuvem: dependências e o D1 local com as migrations.
# Não usa segredo nem conta da Cloudflare; publicar é o workflow Deploy do GitHub.
set -euo pipefail
cd "$(dirname "$0")/.."
npm ci
CI=1 npm run db:migrate:local
echo "Pronto: npm run verify, npm run dev."
