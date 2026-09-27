@echo off
chcp 65001 > nul
title SeriesHub - Local Streaming Server
echo ========================================================
echo   🎬 SeriesHub - הנטפליקס הפרטי שלך במחשב
echo ========================================================
echo.
echo מפעיל את שרת הווידאו המקומי...
echo כתובת האתר במחשב: http://localhost:5000
echo.

:: פתיחת הדפדפן לאחר השהייה קלה לוודא שהשרת עלה
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5000"

cd /d "%~dp0backend"
python -m uvicorn app:app --host 0.0.0.0 --port 5000
pause
