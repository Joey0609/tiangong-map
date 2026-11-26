@echo off
cd /d "%~dp0"
python -B -X utf8 serve.py %*
if errorlevel 1 pause

