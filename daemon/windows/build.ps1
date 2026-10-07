#Requires -Version 5.1
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path -LiteralPath $compiler)) { throw '.NET Framework 4.8 and 64-bit Windows are required.' }
& $compiler /nologo /target:exe /optimize+ /platform:anycpu /reference:System.ServiceProcess.dll /reference:System.Web.Extensions.dll "/out:$PSScriptRoot\daemon-host.exe" "$PSScriptRoot\DaemonHost.cs"
if ($LASTEXITCODE -ne 0) { throw 'Could not compile the Windows service host.' }
