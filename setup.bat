@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ==========================================
echo   GongEdu 설치
echo ==========================================
echo.

:: 1. .env 파일 생성
echo [1/3] 환경 변수 설정
echo ------------------------------------------

if exist "backend\.env" (
    echo 기존 .env 파일이 감지되었습니다.
    set /p OVERWRITE="덮어쓰시겠습니까? (y/n): "
    if /i not "%OVERWRITE%"=="y" goto SKIP_ENV
)

:INPUT_SECRET
set /p INPUT_SECRET="JWT 시크릿 키를 입력하세요 (필수): "
if "%INPUT_SECRET%"=="" (
    echo JWT 시크릿 키는 필수입니다.
    goto INPUT_SECRET
)

(
    echo PORT=8180
    echo JWT_SECRET=%INPUT_SECRET%
) > backend\.env
echo .env 파일이 생성되었습니다.

:SKIP_ENV
echo.

:: 2. DB 파일 초기화
echo [2/3] DB 파일 초기화...
if not exist "backend\education.db" (
    type nul > backend\education.db
    echo education.db 파일이 생성되었습니다.
) else (
    echo education.db 파일이 이미 존재합니다.
)
echo.

:: 3. Docker Compose 실행
echo [3/3] 컨테이너 빌드 및 실행 중... (시간이 걸릴 수 있습니다)
docker compose up -d --build
if errorlevel 1 (
    echo.
    echo [오류] Docker 실행에 실패했습니다. Docker가 설치되어 있는지 확인하세요.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   설치가 완료되었습니다.
echo   브라우저에서 http://localhost 로 접속하세요.
echo ==========================================
pause
