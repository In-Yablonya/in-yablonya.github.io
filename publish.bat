@echo off
rem Zapusk publish.ps1 dvojnym shchelchkom (bez nastrojki politiki PowerShell).
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish.ps1" %*
echo.
pause
