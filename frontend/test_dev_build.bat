@echo off
echo ========================================
echo Expo Development Build Test
echo ========================================
echo.
echo NOT: Bu uygulama native moduller icerdigi icin Expo Go ile CALISMAZ!
echo Development build (dev client) kullanilmali.
echo.
echo Adimlar:
echo 1. Telefonunuzu USB ile baglayin (USB Hata Ayiklama acik)
echo 2. Bu script'i calistirin
echo 3. Expo development server baslatilacak
echo 4. Telefonda uygulama otomatik acilacak veya Expo Go uygulamasi uzerinden baglanin
echo.
pause
echo.
echo Expo development server baslatiliyor...
echo.
cd /d %~dp0
npx expo start --dev-client
