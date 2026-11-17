$ErrorActionPreference = 'Stop'

[array]$keys = Get-UninstallRegistryKey -SoftwareName 'Dora'

foreach ($key in $keys) {
  Uninstall-ChocolateyPackage `
    -PackageName $env:ChocolateyPackageName `
    -FileType 'exe' `
    -SilentArgs '/S' `
    -File ($key.UninstallString -replace '"', '')
}
