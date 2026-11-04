@echo off
chcp 65001 > nul
title 사회사업실 원스탑 서비스
cd /d "%~dp0"

where node > nul 2>&1
if errorlevel 1 (
  echo.
  echo   Node.js가 설치되어 있지 않습니다.
  echo   https://nodejs.org 에서 LTS 버전을 내려받아 설치한 뒤
  echo   이 창을 닫고 다시 실행해 주세요.
  echo.
  pause
  exit /b
)

node server.js

echo.
echo   서비스가 멈췄습니다. 창을 닫으셔도 됩니다.
pause
