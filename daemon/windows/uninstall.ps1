#Requires -Version 5.1
#Requires -RunAsAdministrator
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$expected = '"' + (Join-Path $env:ProgramData 'LatticeDaemon\runtime\windows\daemon-host.exe') + '"'
$service = Get-CimInstance Win32_Service -Filter "Name='lattice-daemon'"
if (!$service) { Write-Host 'daemon is already unregistered.'; return }
if ($service.PathName -ne $expected) { throw 'Refusing to remove an unrelated service.' }
$controller = Get-Service lattice-daemon
if ($controller.Status -ne 'Stopped') {
    $controller.Stop()
    $controller.WaitForStatus('Stopped', [TimeSpan]::FromHours(1))
}
& "$env:WINDIR\System32\sc.exe" delete lattice-daemon
if ($LASTEXITCODE -ne 0) { throw 'Could not remove service registration.' }
Write-Host 'Service removed. Lattice containers, configuration, runtime, state, and backups are preserved.'
