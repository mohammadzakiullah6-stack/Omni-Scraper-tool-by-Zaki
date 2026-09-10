@echo off
title OmniScrape PRO - Universal Scraper Tool
cd /d "%~dp0"
echo ====================================================
echo Starting OmniScrape PRO...
echo ====================================================
start http://localhost:4000
node server.js
pause
