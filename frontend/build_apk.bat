@echo off
REM ProParcel APK Build Scripti
REM Android release APK olusturur

cd /d %~dp0

echo ========================================
echo ProParcel APK Build Baslatiliyor
echo ========================================
echo.
echo NOT: Bu islem bir kac dakika surebilir
echo.

REM Android release APK build
echo [1/2] Android Release APK build ediliyor...
cd android
call gradlew.bat assembleRelease

REM APK'yi bul ve kopyala
echo.
echo [2/2] APK dosyasi hazirlaniyor...
cd ..

REM APK dosyasini bul
set APK_PATH=android\app\build\outputs\apk\release\app-release.apk

if exist "%APK_PATH%" (
    REM APK releases klasorunu olustur
    if not exist "apk_releases" mkdir apk_releases
    
    REM APK'yi kopyala
    copy /Y "%APK_PATH%" "apk_releases\ProParcel.apk"
    
    echo.
    echo ========================================
    echo APK Basariyla Olusturuldu!
    echo ========================================
    echo APK Konumu: %CD%\apk_releases\ProParcel.apk
    echo.
    
    REM APK boyutunu goster
    for %%A in ("apk_releases\ProParcel.apk") do (
        set size=%%~zA
        set /a sizeMB=!size!/1024/1024
        echo APK Boyutu: !sizeMB! MB
    )
    
    echo.
    echo Simdi 'baslat_apk_indirme.bat' scriptini calistirarak
    echo APK'yi indirmek icin sunucuyu baslatabilirsiniz.
    echo.
) else (
    echo.
    echo HATA: APK dosyasi bulunamadi!
    echo Kontrol edin: %APK_PATH%
    echo.
)

pause
