#!/bin/bash
# Docker 없이 pm2(backend) + nginx(frontend 정적 파일) 조합으로 직접 운영하는 경우의
# 업데이트 스크립트. Docker 기반 배포(README 참고)와는 별개의 방식이다.
#
# 사전 조건 (최초 1회 수동 설정 필요):
#   - backend를 pm2로 기동하고 이름을 gongedu-backend로 지정
#     예) cd backend && pm2 start src/index.js --name gongedu-backend
#   - nginx(또는 다른 웹서버)가 frontend/dist를 정적으로 서빙하고
#     /api를 backend(기본 8180 포트)로 프록시하도록 설정

set -e
cd "$(dirname "$0")"

echo "=========================================="
echo "  GongEdu 업데이트 (직접 설치 환경)"
echo "=========================================="
echo

echo "[1/3] 최신 코드 받는 중..."
git pull

echo
echo "[2/3] 백엔드 업데이트 중..."
cd backend
npm ci
if ! pm2 restart gongedu-backend; then
    echo
    echo "[오류] pm2 프로세스 'gongedu-backend'를 찾을 수 없습니다."
    echo "최초 실행이라면 아래 명령으로 먼저 등록하세요:"
    echo "  pm2 start src/index.js --name gongedu-backend"
    exit 1
fi
cd ..

echo
echo "[3/3] 프론트엔드 빌드 중..."
cd frontend
npm ci
npm run build
cd ..

echo
echo "=========================================="
echo "  업데이트가 완료되었습니다."
echo "=========================================="
