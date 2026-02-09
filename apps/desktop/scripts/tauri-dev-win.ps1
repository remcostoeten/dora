param()

$requiredDirs = @(
    'C:\Users\Remco\.cargo\bin',
    'C:\Program Files\CMake\bin',
    'C:\Users\Remco\tools\nasm\nasm-3.01',
    'C:\Users\Remco\AppData\Local\Microsoft\WinGet\Packages\Ninja-build.Ninja_Microsoft.Winget.Source_8wekyb3d8bbwe'
)

$env:PATH = ($requiredDirs + ($env:PATH -split ';')) | Where-Object { $_ -and $_ -ne '' } | Select-Object -Unique
$env:PATH = $env:PATH -join ';'
$env:CMAKE_GENERATOR = 'Ninja'
$env:AWS_LC_SYS_CMAKE_GENERATOR = 'Ninja'

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    bun x tauri dev
} finally {
    Pop-Location
}
