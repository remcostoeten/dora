$baseDir = Resolve-Path "$PSScriptRoot\.."
$manifest = Join-Path $baseDir 'src-tauri\Cargo.toml'
$vendorDir = Join-Path $baseDir 'src-tauri\vendor\libsql-sys'

if (Test-Path $vendorDir) {
    Remove-Item $vendorDir -Recurse -Force
}

cargo vendor --manifest-path $manifest --filter libsql-sys $vendorDir
