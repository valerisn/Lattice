#Requires -Version 5.1
#Requires -PSEdition Desktop
#Requires -RunAsAdministrator
[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$FixtureRoot)
$ErrorActionPreference = 'Stop'
$installation = Join-Path $env:ProgramData 'LatticeDaemon'
if ((Test-Path -LiteralPath $installation) -or (Get-Service lattice-daemon -ErrorAction SilentlyContinue)) { throw 'Service tests require an unused disposable Windows host.' }
$tools = Join-Path $FixtureRoot 'tools'
$app = Join-Path $FixtureRoot 'application'
New-Item -ItemType Directory -Path $tools, $app | Out-Null
$phpSource = Split-Path (Get-Command php.exe).Source
Copy-Item -LiteralPath $phpSource -Destination "$tools\php" -Recurse
$php = "$tools\php\php.exe"
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText("$app\compose.yaml", 'services: {}', $utf8)
[System.IO.File]::WriteAllText("$app\.env", 'TEST_ONLY=1', $utf8)
[System.IO.File]::WriteAllText("$app\health.php", '<?php header("Content-Type: application/json"); echo ''{"status":"ok"}'';', $utf8)
$fake = @'
using System;
using System.IO;
class FixtureTool {
    static int Main(string[] args) {
        string command = String.Join(" ", args);
        File.AppendAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "calls.log"), command + Environment.NewLine);
        if (command.Contains(".OSType")) Console.WriteLine("linux");
        else if (command.Contains("ps --all")) Console.WriteLine("[{\"Service\":\"app\",\"State\":\"running\",\"Health\":\"healthy\"},{\"Service\":\"db\",\"State\":\"running\",\"Health\":\"healthy\"}]");
        else if (command.Contains("version") || command.Contains(".ServerVersion")) Console.WriteLine("fixture-1.0");
        else return 1;
        return 0;
    }
}
'@
[System.IO.File]::WriteAllText("$tools\FixtureTool.cs", $fake, $utf8)
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:exe "/out:$tools\docker.exe" "$tools\FixtureTool.cs"
if ($LASTEXITCODE) { throw 'Fixture compilation failed.' }
Copy-Item -LiteralPath "$tools\docker.exe" -Destination "$tools\git.exe"
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start(); $port = $listener.LocalEndpoint.Port; $listener.Stop()
$health = "http://127.0.0.1:$port/api/health"
$server = Start-Process -FilePath $php -ArgumentList @('-S', "127.0.0.1:$port", ('"' + "$app\health.php" + '"')) -WindowStyle Hidden -PassThru -RedirectStandardOutput "$FixtureRoot\http.log" -RedirectStandardError "$FixtureRoot\http-error.log"
function Wait-Healthy {
    $deadline = [DateTime]::UtcNow.AddSeconds(60)
    do {
        $file = "$installation\state\status.json"
        if ((Test-Path -LiteralPath $file) -and (Get-Content -LiteralPath $file -Raw | ConvertFrom-Json).healthy) { return }
        Start-Sleep -Milliseconds 500
    } while ([DateTime]::UtcNow -lt $deadline)
    throw 'The service did not report healthy.'
}
function Get-Watcher {
    @(Get-CimInstance Win32_Process -Filter "Name='php.exe'" | Where-Object { $_.CommandLine -like "*$installation\runtime\bin\daemon* watch *" })
}
try {
    & "$PSScriptRoot\install.ps1" -Directory $app -Php $php -Docker "$tools\docker.exe" -Git "$tools\git.exe" -HealthUrl $health
    Wait-Healthy
    $initial = Get-Watcher
    if ($initial.Count -ne 1) { throw 'Expected exactly one PHP watcher.' }
    $controller = Get-Service lattice-daemon
    $controller.Stop(); $controller.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(45))
    if ((Get-Watcher).Count -ne 0) { throw 'PHP survived graceful service stop.' }
    if ((Get-Content "$installation\state\daemon.log" -Raw) -notmatch '"event":"stopped"') { throw 'PHP did not acknowledge graceful shutdown.' }
    if ((Invoke-WebRequest -UseBasicParsing $health).StatusCode -ne 200) { throw 'Stopping supervision stopped the application.' }
    Start-Service lattice-daemon
    Start-Sleep -Seconds 3
    $before = Get-Watcher
    if ($before.Count -ne 1) { throw 'Service did not restart.' }
    Stop-Process -Id $before[0].ProcessId -Force
    $deadline = [DateTime]::UtcNow.AddSeconds(60)
    do {
        Start-Sleep -Seconds 1
        $after = Get-Watcher
    } while (($after.Count -ne 1 -or $after[0].ProcessId -eq $before[0].ProcessId) -and [DateTime]::UtcNow -lt $deadline)
    if ($after.Count -ne 1 -or $after[0].ProcessId -eq $before[0].ProcessId) { throw 'SCM did not recover after PHP crashed.' }
    $original = Get-Content -LiteralPath "$installation\daemon.json" -Raw
    & "$PSScriptRoot\install.ps1" -Directory $app -Php $php -Docker "$tools\docker.exe" -Git "$tools\git.exe" -ProjectName ignored -HealthUrl $health
    if ((Get-Content -LiteralPath "$installation\daemon.json" -Raw) -ne $original) { throw 'Reinstall changed existing configuration.' }
    Wait-Healthy
    $calls = Get-Content -LiteralPath "$tools\calls.log" -Raw
    if ($calls -match 'restart|stop|down|up -d') { throw 'Healthy supervision mutated containers.' }
    & "$PSScriptRoot\uninstall.ps1"
    if (!(Test-Path -LiteralPath "$installation\daemon.json") -or !(Test-Path -LiteralPath "$installation\state\status.json")) { throw 'Uninstall removed persistent data.' }
    Write-Host 'PASS real SCM install, monitor, graceful stop, crash recovery, reinstall, and preserving uninstall (fixture Docker CLI).'
} finally {
    if (Test-Path -LiteralPath "$installation\state\daemon.log") { Get-Content -LiteralPath "$installation\state\daemon.log" -Tail 30 }
    if (Get-Service lattice-daemon -ErrorAction SilentlyContinue) { & "$PSScriptRoot\uninstall.ps1" }
    if (!$server.HasExited) { $server.Kill(); $server.WaitForExit() }
    $expected = [System.IO.Path]::GetFullPath((Join-Path $env:ProgramData 'LatticeDaemon'))
    if ([System.IO.Path]::GetFullPath($installation) -ne $expected) { throw 'Unsafe service fixture cleanup target.' }
    if (Test-Path -LiteralPath $installation) { Remove-Item -LiteralPath $installation -Recurse -Force }
}
