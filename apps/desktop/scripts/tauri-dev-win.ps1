param()

# Resolve cargo home dynamically
$cargoHome = if ($env:CARGO_HOME) { $env:CARGO_HOME } else { Join-Path $env:USERPROFILE '.cargo' }

$requiredDirs = @(
    (Join-Path $cargoHome 'bin')
)

# Discover tool paths dynamically instead of hardcoding user-specific locations
foreach ($tool in @('cmake', 'nasm', 'ninja')) {
    $cmd = Get-Command $tool -ErrorAction SilentlyContinue
    if ($cmd) {
        $toolDir = Split-Path $cmd.Source -Parent
        $requiredDirs += $toolDir
    }
}

# Also add common install locations as fallback
$cmakeFallback = 'C:\Program Files\CMake\bin'
if ((Test-Path $cmakeFallback) -and ($requiredDirs -notcontains $cmakeFallback)) {
    $requiredDirs += $cmakeFallback
}

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
