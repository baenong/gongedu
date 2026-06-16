#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "=========================================="
echo "  GongEdu 설치"
echo "=========================================="
echo

# 1. .env 파일 생성
echo "[1/3] 환경 변수 설정"
echo "------------------------------------------"

SKIP_ENV=0
if [ -f "backend/.env" ]; then
    echo "기존 .env 파일이 감지되었습니다."
    read -p "덮어쓰시겠습니까? (y/n): " OVERWRITE
    if [ "${OVERWRITE}" != "y" ] && [ "${OVERWRITE}" != "Y" ]; then
        echo "설정을 건너뜁니다."
        SKIP_ENV=1
    fi
fi

if [ "${SKIP_ENV}" -eq 0 ]; then
    while true; do
        read -p "JWT 시크릿 키를 입력하세요 (필수): " INPUT_SECRET
        if [ -n "${INPUT_SECRET}" ]; then
            break
        fi
        echo "JWT 시크릿 키는 필수입니다."
    done

    cat > backend/.env <<EOF
PORT=8180
JWT_SECRET=${INPUT_SECRET}
EOF
    echo ".env 파일이 생성되었습니다."
fi
echo

# 2. DB 파일 초기화
echo "[2/3] DB 파일 초기화..."
if [ ! -f "backend/education.db" ]; then
    touch backend/education.db
    echo "education.db 파일이 생성되었습니다."
else
    echo "education.db 파일이 이미 존재합니다."
fi
echo

# 3. Docker Compose 실행
echo "[3/3] 컨테이너 빌드 및 실행 중... (시간이 걸릴 수 있습니다)"
docker compose up -d --build

echo
echo "=========================================="
echo "  설치가 완료되었습니다."
echo "  브라우저에서 http://서버IP 로 접속하세요."
echo "=========================================="
