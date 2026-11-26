$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "1/3 — Synchronisation du code web dans l'application Android..." -ForegroundColor Cyan
npx.cmd cap sync android

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Write-Host "`n[!] Java JDK 17 et Android Studio ne sont pas encore installes sur ce PC." -ForegroundColor Yellow
    Write-Host "    Deux solutions simples pour obtenir votre fichier SleepTransit.apk :" -ForegroundColor White
    Write-Host "    A) Sans rien installer : poussez le dossier 'sleeptransit' sur GitHub -> l'onglet Actions compile l'APK gratuitement en 3 min." -ForegroundColor Green
    Write-Host "    B) En local : installez Android Studio (https://developer.android.com/studio), puis relancez .\build-apk.ps1" -ForegroundColor Green
    exit 1
}

Write-Host "2/3 — Compilation de SleepTransit.apk (Gradle)..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\android"
.\gradlew.bat assembleDebug

$apkSrc = "$PSScriptRoot\android\app\build\outputs\apk\debug\app-debug.apk"
$apkDst = "$PSScriptRoot\SleepTransit.apk"
Copy-Item $apkSrc $apkDst -Force
Write-Host "`n3/3 — TERMINE ! Votre application Android est prete :" -ForegroundColor Green
Write-Host "      $apkDst" -ForegroundColor Yellow
Write-Host "      Transferez ce fichier sur votre telephone Android et ouvrez-le pour l'installer." -ForegroundColor White
