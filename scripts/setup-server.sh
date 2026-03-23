#!/bin/bash
# VM 초기 설정 래퍼 스크립트
# 실행: sudo bash scripts/setup-server.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/vm/install-runtime.sh"
