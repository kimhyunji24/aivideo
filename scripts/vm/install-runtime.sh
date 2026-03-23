#!/usr/bin/env bash
# Ubuntu/Debian VM 런타임 설치
# 실행: sudo bash scripts/vm/install-runtime.sh

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "[ERROR] sudo/root 권한으로 실행해 주세요."
  exit 1
fi

echo "[1/5] apt index 업데이트"
apt-get update -y

echo "[2/5] 필수 패키지 설치 (Java 21, Redis, Nginx, ffmpeg)"
apt-get install -y \
  openjdk-21-jdk \
  redis-server \
  nginx \
  ffmpeg \
  curl \
  git \
  ca-certificates \
  gnupg

echo "[3/5] Node.js 20 설치"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1)" != "v20" ]]; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -y
  apt-get install -y nodejs
fi

echo "[4/5] 서비스 부팅 자동 시작"
systemctl enable redis-server
systemctl enable nginx
systemctl restart redis-server
systemctl restart nginx

echo "[5/5] 버전 확인"
java -version
node -v
npm -v
redis-server --version
ffmpeg -version | head -1
nginx -v

echo "[DONE] 런타임 설치가 완료되었습니다."
