@echo off
set DEST=%USERPROFILE%\.config\opencode\plugins
if not exist "%DEST%" mkdir "%DEST%"
copy /Y "%~dp0capri-opencode.js" "%DEST%\capri-opencode.js"
echo Installed to %DEST%. Restart opencode (and keep Capri running).
pause
