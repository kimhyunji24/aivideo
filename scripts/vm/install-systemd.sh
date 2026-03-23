#!/usr/bin/env bash
# AI Video systemd 유닛/환경파일/Nginx 설치
# 실행: sudo bash scripts/vm/install-systemd.sh
# 옵션:
#   APP_USER=hyunji APP_DIR=/home/hyunji/aivideo sudo bash scripts/vm/install-systemd.sh

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "[ERROR] sudo/root 권한으로 실행해 주세요."
  exit 1
fi

APP_USER="${APP_USER:-hyunji}"
APP_DIR="${APP_DIR:-/home/${APP_USER}/aivideo}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[1/6] 서비스 유닛 생성"
sed -e "s|{{APP_USER}}|${APP_USER}|g" -e "s|{{APP_DIR}}|${APP_DIR}|g" \
  "${SCRIPT_DIR}/aivideo-backend.service.tpl" \
  > /etc/systemd/system/aivideo-backend.service

sed -e "s|{{APP_USER}}|${APP_USER}|g" -e "s|{{APP_DIR}}|${APP_DIR}|g" \
  "${SCRIPT_DIR}/aivideo-frontend.service.tpl" \
  > /etc/systemd/system/aivideo-frontend.service

echo "[2/6] 환경변수 파일 생성"
install -d -m 0755 /etc/aivideo
if [[ ! -f /etc/aivideo/aivideo.env ]]; then
  cp "${SCRIPT_DIR}/aivideo.env.example" /etc/aivideo/aivideo.env
  chmod 600 /etc/aivideo/aivideo.env
  echo "  - /etc/aivideo/aivideo.env 생성됨 (운영 값으로 수정 필요)"
else
  echo "  - /etc/aivideo/aivideo.env 기존 파일 유지"
fi

echo "[3/6] Nginx 리버스 프록시 설정"
cat >/etc/nginx/sites-available/aivideo <<'NGINX'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX

ln -sf /etc/nginx/sites-available/aivideo /etc/nginx/sites-enabled/aivideo
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "[4/6] systemd reload"
systemctl daemon-reload

echo "[5/6] 서비스 enable"
systemctl enable aivideo-backend
systemctl enable aivideo-frontend

echo "[6/6] 완료"
echo "다음 단계:"
echo "  1) /etc/aivideo/aivideo.env 값 수정"
echo "  2) 코드 디렉터리 준비: ${APP_DIR}"
echo "  3) 배포 실행: bash ${APP_DIR}/scripts/vm/deploy-main.sh"
echo "  4) 로그 확인: journalctl -u aivideo-backend -f"
