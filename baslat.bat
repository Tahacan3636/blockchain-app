@echo off
chcp 65001 >nul
echo ==============================================
echo  Blockchain Tabanli Secim Sistemi baslatiliyor
echo ==============================================
echo.

docker info >nul 2>&1
if errorlevel 1 (
    echo [HATA] Docker calismiyor. Lutfen Docker Desktop'i acip tekrar deneyin.
    echo        Docker yoksa KURULUM.md dosyasindaki "Docker olmadan" adimlarini izleyin.
    pause
    exit /b 1
)

echo Ilk calistirmada indirme nedeniyle birkac dakika surebilir...
start "" cmd /c "timeout /t 25 >nul && start http://localhost:3000"
docker compose up --build
pause
