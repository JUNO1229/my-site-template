@echo off
chcp 65001 > nul
title 원스탑 서비스 — 백업
cd /d "%~dp0"

set D=%date:~0,4%%date:~5,2%%date:~8,2%
if not exist "수동백업" mkdir "수동백업"

if not exist "data\db.json" (
  echo.
  echo   백업할 자료를 찾지 못했습니다.
  echo   서비스를 한 번이라도 실행하셨는지 확인해 주세요.
  echo.
  pause
  exit /b
)

copy /Y "data\db.json" "수동백업\db-%D%.json" > nul
echo.
echo   백업했습니다 — 수동백업\db-%D%.json
echo.
echo   이 파일을 USB나 다른 PC에도 복사해 두시면 더 안전합니다.
echo   서버가 꺼져 있을 때 복사하는 편이 좋습니다.
echo.
pause
