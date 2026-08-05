@echo off
setlocal enabledelayedexpansion
title BubbaBlox Setup

rem ============================================================================
rem  BubbaBlox one-shot setup script (Windows)
rem
rem  What it does automatically:
rem    - installs prerequisites via winget (Node, PostgreSQL, .NET 6 SDK, Go,
rem      Python 3.12, FFmpeg, Git) if they are missing
rem    - installs all Node dependencies (admin, renderer, AssetProxy, api)
rem    - installs the Python packages for asset validation
rem    - copies the example config files to real ones (if not present)
rem    - generates the RSA keys
rem    - builds the .NET solution, the admin panel and the renderer
rem    - optionally loads the database schema
rem
rem  It is safe to re-run: anything already done is skipped.
rem
rem  What it CANNOT do (manual, see the end of this script / docs\SETUP.md):
rem    - fill in your secrets/paths in appsettings.json and renderer\config.json
rem    - hex-patch the 10-character domain into the RCC/Client .exe files
rem    - create the registry keys
rem ============================================================================

cd /d "%~dp0"
set "ROOT=%cd%"
set "INSTALLED_SOMETHING=0"

echo.
echo ============================================================
echo   BubbaBlox setup - running from: %ROOT%
echo ============================================================
echo.

rem ---------------------------------------------------------------------------
rem 1. Prerequisites (via winget)
rem ---------------------------------------------------------------------------
where winget >nul 2>nul
if errorlevel 1 (
    echo [warn] winget was not found. Automatic prerequisite install is unavailable.
    echo        Install these manually, then re-run this script:
    echo          Node.js 18+, PostgreSQL, .NET 6 SDK, Go 1.20+, Python 3.12, FFmpeg, Git
    echo.
) else (
    call :ensure_tool node    "OpenJS.NodeJS.LTS"        "Node.js"
    call :ensure_tool dotnet  "Microsoft.DotNet.SDK.6"   ".NET 6 SDK"
    call :ensure_tool go      "GoLang.Go"                "Go"
    call :ensure_tool python  "Python.Python.3.12"       "Python 3.12"
    call :ensure_tool psql    "PostgreSQL.PostgreSQL.16" "PostgreSQL"
    call :ensure_tool ffmpeg  "Gyan.FFmpeg"              "FFmpeg"
    call :ensure_tool git     "Git.Git"                  "Git"
)

if "%INSTALLED_SOMETHING%"=="1" (
    echo.
    echo [important] One or more tools were just installed. Their PATH may not be
    echo             active in this window. If any step below fails with
    echo             "'x' is not recognized", CLOSE this window, open a NEW
    echo             terminal, and run setup.bat again - it will skip installs
    echo             and continue.
    echo.
    pause
)

rem ---------------------------------------------------------------------------
rem 2. Node dependencies
rem ---------------------------------------------------------------------------
call :npm_install "%ROOT%\admin"      "admin panel"
call :npm_install "%ROOT%\renderer"   "renderer"
call :npm_install "%ROOT%\AssetProxy" "AssetProxy"
call :npm_install "%ROOT%\api"        "api"

rem ---------------------------------------------------------------------------
rem 3. Python packages (asset validation)
rem ---------------------------------------------------------------------------
echo.
echo [*] Installing Python packages...
where python >nul 2>nul
if errorlevel 1 (
    echo [warn] python not on PATH - skipping. Install Python 3.12 and re-run.
) else (
    python -m pip install --upgrade pip
    python -m pip install fastapi aiohttp pydub uvicorn python-magic python-magic-bin==0.4.14 python-multipart cryptography
)

rem ---------------------------------------------------------------------------
rem 4. Config scaffolding (copy examples if the real file is missing)
rem ---------------------------------------------------------------------------
echo.
echo [*] Setting up config files...
call :copy_if_missing "%ROOT%\Roblox\Roblox.Website\appsettings.example.json" "%ROOT%\Roblox\Roblox.Website\appsettings.json"
call :copy_if_missing "%ROOT%\renderer\config.example.json"                   "%ROOT%\renderer\config.json"
call :copy_if_missing "%ROOT%\AssetProxy\.env.example"                        "%ROOT%\AssetProxy\.env"

rem ---------------------------------------------------------------------------
rem 5. RSA keys
rem ---------------------------------------------------------------------------
echo.
echo [*] Generating RSA keys...
if exist "%ROOT%\Roblox\Roblox.Website\RSA\PrivateKey.pem" (
    echo     keys already exist - skipping.
) else (
    pushd "%ROOT%\Roblox\Roblox.Website\RSA"
    python Generate.py && echo     RSA keys generated. || echo [warn] RSA key generation failed - run 'python Generate.py' in Roblox\Roblox.Website\RSA manually.
    popd
)

rem ---------------------------------------------------------------------------
rem 6. Builds
rem ---------------------------------------------------------------------------
echo.
echo [*] Building .NET solution (this can take a few minutes)...
where dotnet >nul 2>nul
if errorlevel 1 (
    echo [warn] dotnet not on PATH - skipping .NET build.
) else (
    dotnet build "%ROOT%\Roblox\Roblox.sln" -c Release && echo     .NET build OK. || echo [warn] .NET build failed - see output above.
)

echo.
echo [*] Building admin panel...
if exist "%ROOT%\admin\node_modules" (
    pushd "%ROOT%\admin" & call npm run build & popd
) else (
    echo [warn] admin deps missing - skipping build.
)

echo.
echo [*] Building renderer...
if exist "%ROOT%\renderer\node_modules" (
    pushd "%ROOT%\renderer" & call npm run build & popd
) else (
    echo [warn] renderer deps missing - skipping build.
)

rem ---------------------------------------------------------------------------
rem 7. Database schema (optional)
rem ---------------------------------------------------------------------------
echo.
set "LOADDB="
set /p "LOADDB=Load the database schema now? Requires PostgreSQL running. [y/N]: "
if /i "!LOADDB!"=="y" (
    set "PGUSER="
    set /p "PGUSER=  Postgres username [postgres]: "
    if "!PGUSER!"=="" set "PGUSER=postgres"
    set "PGDB="
    set /p "PGDB=  Target database name [postgres]: "
    if "!PGDB!"=="" set "PGDB=postgres"
    echo   You will be prompted for the Postgres password...
    psql --username=!PGUSER! --dbname=!PGDB! -f "%ROOT%\api\sql\schema.sql" && echo   Schema loaded. || echo [warn] Schema load failed - check that the database exists and PostgreSQL is running.
)

rem ---------------------------------------------------------------------------
rem Done - print remaining manual steps
rem ---------------------------------------------------------------------------
echo.
echo ============================================================
echo   Automated setup finished.
echo ============================================================
echo.
echo   REMAINING MANUAL STEPS (a script cannot do these):
echo.
echo   1. Edit Roblox\Roblox.Website\appsettings.json:
echo        - Postgres connection string (password/db)
echo        - Replace every C:\Users\Admin\... path with your real paths
echo        - Set strong values for Render.Authorization, GameServerAuthorization,
echo          BotAuthorization, RccAuthorization, IPSalt, Jwt.Sessions
echo.
echo   2. Edit renderer\config.json:
echo        - "authorization" MUST equal appsettings Render.Authorization
echo        - "websiteBotAuth" MUST equal appsettings BotAuthorization
echo        - "rcc" = path to your RCC folder
echo.
echo   3. Hex-patch your 10-character domain into RCCService.exe / Client.exe
echo      (search for bbblox.org in HxD). See README section 5.
echo.
echo   4. Create the registry keys (README section 7) and patch the RSA public
echo      keys into the RCC exes (README section 6).
echo.
echo   5. Run runall.bat to start everything, then open http://localhost.
echo.
echo   Full guide: docs\SETUP.md
echo ============================================================
echo.
pause
exit /b 0

rem ===========================================================================
rem  Subroutines
rem ===========================================================================

:ensure_tool
rem %1 = command to detect, %2 = winget id, %3 = friendly name
where %1 >nul 2>nul
if errorlevel 1 (
    echo [*] Installing %3 ...
    winget install --id %2 -e --accept-package-agreements --accept-source-agreements
    set "INSTALLED_SOMETHING=1"
) else (
    echo [ok] %3 already installed.
)
exit /b 0

:npm_install
rem %1 = folder, %2 = friendly name
if not exist "%~1\package.json" (
    exit /b 0
)
echo.
echo [*] Installing dependencies for %2 ...
where npm >nul 2>nul
if errorlevel 1 (
    echo [warn] npm not on PATH - skipping %2. Install Node.js and re-run.
    exit /b 0
)
pushd "%~1"
call npm install --no-audit --no-fund
popd
exit /b 0

:copy_if_missing
rem %1 = source example, %2 = destination
if exist "%~2" (
    echo     %~nx2 already exists - leaving it.
    exit /b 0
)
if not exist "%~1" (
    echo [warn] example file not found: %~1
    exit /b 0
)
copy /y "%~1" "%~2" >nul && echo     created %~nx2 from example.
exit /b 0
