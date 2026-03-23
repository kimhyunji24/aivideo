#!/usr/bin/env bash
# main 브랜치 기준 VM 배포 스크립트 (systemd 전용)
# 실행: bash scripts/vm/deploy-main.sh

set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/aivideo}"
BRANCH="${BRANCH:-main}"

cd "${APP_DIR}"

echo "[1/7] 코드 동기화 (${BRANCH})"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

echo "[2/7] 백엔드 빌드"
cd backend
chmod +x ./gradlew
./gradlew clean bootJar
cd "${APP_DIR}"

echo "[3/7] 프론트 의존성 설치"
npm ci

echo "[4/7] 프론트 빌드"
npm run build

echo "[5/7] Redis 기동 확인"
sudo systemctl start redis-server
sudo systemctl is-active --quiet redis-server

echo "[6/7] 앱 서비스 재시작"
sudo systemctl restart aivideo-backend
sudo systemctl restart aivideo-frontend

echo "[7/7] 상태 점검"
sudo systemctl --no-pager --full status aivideo-backend | sed -n '1,12p'
sudo systemctl --no-pager --full status aivideo-frontend | sed -n '1,12p'
curl -fsS "http://127.0.0.1:8080/api/v1/sessions" -X POST >/dev/null
curl -fsS "http://127.0.0.1/" >/dev/null

echo "[DONE] 배포 완료"
