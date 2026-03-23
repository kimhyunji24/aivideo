#!/bin/bash
# GCloud VM 서버 초기 설정 스크립트
# 용도: ffmpeg 및 필수 패키지 설치
# 실행: sudo bash scripts/setup-server.sh

set -e

echo "=== ffmpeg 설치 ==="
apt-get update -y
apt-get install -y ffmpeg

echo "=== ffmpeg 버전 확인 ==="
ffmpeg -version | head -1
ffprobe -version | head -1

echo "=== 설치 완료 ==="
