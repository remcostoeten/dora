$baseDir = Resolve-Path "$PSScriptRoot\.."
$manifest = Join-Path $baseDir 'src-tauri\Cargo.toml'
$vendorDir = Join-Path $baseDir 'src-tauri\vendor\libsql-sys'
$tmpDir = Join-Path $baseDir 'src-tauri\vendor\_libsql-sys-tmp'

# Clean up any leftover temp directory
if (Test-Path $tmpDir) {
    Remove-Item $tmpDir -Recurse -Force
}

# Vendor into temp directory first (--filter is not supported by cargo vendor)
cargo vendor --manifest-path $manifest $tmpDir

if ($LASTEXITCODE -ne 0) {
    Write-Error "cargo vendor failed (exit code $LASTEXITCODE). Existing vendor dir left intact."
    if (Test-Path $tmpDir) { Remove-Item $tmpDir -Recurse -Force }
    exit 1
}

# Atomic swap: only remove old dir after successful vendor
if (Test-Path $vendorDir) {
    Remove-Item $vendorDir -Recurse -Force
}
Rename-Item $tmpDir $vendorDir

Write-Host "Vendored libsql-sys refreshed successfully."
