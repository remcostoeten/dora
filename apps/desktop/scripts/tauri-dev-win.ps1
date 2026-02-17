<#
.SYNOPSIS
    Windows Tauri development script with proper toolchain configuration.

.DESCRIPTION
    Sets up the PATH and environment for Tauri development on Windows.
    Ensures Ninja CMake generator and proper tooling are available.

.PARAMETER CustomPaths
    Additional directories to prepend to PATH. Can be used multiple times.

.EXAMPLE
    .\tauri-dev-win.ps1

.EXAMPLE
    .\tauri-dev-win.ps1 -CustomPaths "C:\Custom\Tool\bin"
#>

param(
    [string[]]$CustomPaths = @()
)

# Standard Windows Tauri toolchain paths
$tauriRequiredDirs = @(
    $env:RUSTUP_HOME,
    $env:CARGO_HOME,
    $env:RUSTUP_TOOLCHAIN,
    'C:\Program Files\CMake\bin',
    'C:\Users\$env:USERNAME\.cargo\bin',
    'C:\Users\$env:USERNAME\tools\nasm\nasm-3.01'
)

# Add ninja if installed via winget
$ninjaPath = Get-Command ninja -ErrorAction SilentlyContinue
if ($ninjaPath) {
    $tauriRequiredDirs += $ninjaPath.Source
} elseif (Test-Path "C:\Users\$env:USERNAME\AppData\Local\Microsoft\WinGet\Packages\Ninja-build.Ninja_Microsoft.Winget.Source_8wekyb3d8bbwe") {
    $tauriRequiredDirs += "C:\Users\$env:USERNAME\AppData\Local\Microsoft\WinGet\Packages\Ninja-build.Ninja_Microsoft.Winget.Source_8wekyb3d8bbwe"
}

# Add custom paths if provided
if ($CustomPaths.Count -gt 0) {
    $tauriRequiredDirs += $CustomPaths
}

# Build new PATH
$env:PATH = ($tauriRequiredDirs | Where-Object { $_ -and $_ -ne '' } | Select-Object -Unique) -join ';'

# Set CMake generators for Tauri
$env:CMAKE_GENERATOR = 'Ninja'
$env:AWS_LC_SYS_CMAKE_GENERATOR = 'Ninja'

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Write-Host "Starting Tauri development server..." -ForegroundColor Green
    bun x tauri dev
} finally {
    Pop-Location
}
