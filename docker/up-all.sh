#!/usr/bin/env bash
# Запуск всего стека HRMS Belarus в правильном порядке.
# Запускать из корня проекта: bash docker/up-all.sh
# Требуется: Docker, папка docker/supabase-repo и docker/supabase-repo/docker/.env

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

NETWORK="hrms-belarus-network"
SUPABASE_ENV="docker/supabase-repo/docker/.env"
SUPABASE_COMPOSE="docker/supabase-repo/docker/docker-compose.yml"
OVERRIDE_COMPOSE="docker/docker-compose.supabase-network.yml"

echo ""
echo "=== HRMS Belarus: запуск стека ==="
echo ""

# 1. Создать общую сеть (если нет)
if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  echo "[1/3] Создаю сеть $NETWORK ..."
  docker network create "$NETWORK"
else
  echo "[1/3] Сеть $NETWORK уже есть."
fi

# 2. Запустить основной compose
echo ""
echo "[2/3] Запуск hrms-web, n8n, n8n-db ..."
docker compose up -d --build
echo "OK."

# 3. Supabase (если есть репозиторий и .env)
if [ ! -f "$SUPABASE_COMPOSE" ]; then
  echo ""
  echo "[3/3] Supabase не найден (нет $SUPABASE_COMPOSE). Пропуск."
  echo "      Клонируйте: git clone --depth 1 https://github.com/supabase/supabase.git docker/supabase-repo"
  echo "      Затем создайте .env и снова запустите этот скрипт."
  echo ""
  exit 0
fi
if [ ! -f "$SUPABASE_ENV" ]; then
  echo ""
  echo "[3/3] Файл $SUPABASE_ENV не найден. Копирую из .env.example ..."
  cp docker/supabase-repo/docker/.env.example "$SUPABASE_ENV"
  echo "      Отредактируйте $SUPABASE_ENV и при необходимости перезапустите скрипт."
  echo ""
fi
echo ""
echo "[3/3] Запуск Supabase в сети $NETWORK ..."
docker compose -f "$SUPABASE_COMPOSE" -f "$OVERRIDE_COMPOSE" --env-file "$SUPABASE_ENV" up -d
echo "OK."

echo ""
echo "=== Готово ==="
echo ""
echo "  Фронт:     http://localhost:3000"
echo "  n8n:       http://localhost:5678"
echo "  Supabase:  http://localhost:8000"
echo ""
echo "В n8n в учётной записи Supabase укажите Host: http://kong:8000 (см. docker/QUICKSTART.md)."
echo ""
