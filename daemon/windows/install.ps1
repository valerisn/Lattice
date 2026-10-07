#Requires -Version 5.1
#Requires -PSEdition Desktop
#Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Directory,
    [string]$Php = (Get-Command php.exe -ErrorAction Stop).Source,
    [string]$Docker = (Get-Command docker.exe -ErrorAction Stop).Source,
    [string]$Git = (Get-Command git.exe -ErrorAction Stop).Source,
    [string]$DockerHost = 'npipe:////./pipe/dockerDesktopLinuxEngine',
    [string]$ProjectName = 'lattice',
    [string]$HealthUrl = 'http://127.0.0.1:3000/api/health',
    [switch]$NoStart
)
$ErrorActionPreference = 'Stop'
$root = Join-Path $env:ProgramData 'LatticeDaemon'
$runtime = Join-Path $root 'runtime'
$hostPath = Join-Path $runtime 'windows\daemon-host.exe'
$source = Split-Path $PSScriptRoot -Parent
$Directory = (Resolve-Path -LiteralPath $Directory).Path
$Php = (Resolve-Path -LiteralPath $Php).Path
$Docker = (Resolve-Path -LiteralPath $Docker).Path
$Git = (Resolve-Path -LiteralPath $Git).Path
if (!$DockerHost.StartsWith('npipe:////./pipe/') -or $DockerHost -match '[\r\n\x00]') { throw 'Use a local Docker Linux engine named pipe.' }
if (!(Test-Path -LiteralPath "$Directory\compose.yaml") -or !(Test-Path -LiteralPath "$Directory\.env")) { throw 'Configure the Lattice Docker checkout first (compose.yaml and .env required).' }
& $Php -r "exit(PHP_VERSION_ID >= 80200 && extension_loaded('curl') ? 0 : 1);"
if ($LASTEXITCODE -ne 0) { throw 'PHP 8.2+ with curl is required.' }
& "$PSScriptRoot\build.ps1"
$checker = Join-Path $PSScriptRoot 'daemon-host.exe'
foreach ($path in @($Directory, (Split-Path $Php), (Split-Path $Docker), (Split-Path $Git))) {
    & $checker --check-code $path
    if ($LASTEXITCODE -ne 0) { throw "Secure the checkout and tools for SYSTEM/Administrators before installation: $path. See daemon/windows/README.md." }
}
if (Test-Path -LiteralPath $root) {
    & $checker --check-code $root
    if ($LASTEXITCODE -ne 0) { throw 'Existing daemon installation has unsafe permissions. No changes made.' }
} else {
    # Apply a private, inheritable ACL before placing any code or secrets here.
    $acl = New-Object System.Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    $admins = New-Object System.Security.Principal.SecurityIdentifier 'S-1-5-32-544'
    $acl.SetOwner($admins)
    foreach ($sid in @('S-1-5-18', 'S-1-5-32-544')) {
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule ([System.Security.Principal.SecurityIdentifier]::new($sid)), 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'
        $acl.AddAccessRule($rule)
    }
    [System.IO.Directory]::CreateDirectory($root, $acl) | Out-Null
}
$existing = Get-CimInstance Win32_Service -Filter "Name='lattice-daemon'"
$binaryPath = '"' + $hostPath + '"'
if ($existing -and $existing.PathName -ne $binaryPath) { throw 'Refusing to replace an unrelated lattice-daemon service.' }
if ($existing) {
    $service = Get-Service lattice-daemon
    if ($service.Status -ne 'Stopped') {
        $service.Stop()
        $service.WaitForStatus('Stopped', [TimeSpan]::FromHours(1))
    }
}
New-Item -ItemType Directory -Path "$runtime\windows", "$runtime\bin", "$runtime\src", "$root\state" -Force | Out-Null
Copy-Item -LiteralPath "$source\autoload.php" -Destination $runtime
Copy-Item -LiteralPath "$source\bin\daemon" -Destination "$runtime\bin\daemon"
Get-ChildItem -LiteralPath "$source\src" -Filter '*.php' | Copy-Item -Destination "$runtime\src"
Copy-Item -LiteralPath $checker -Destination $hostPath
$config = Join-Path $root 'daemon.json'
if (!(Test-Path -LiteralPath $config)) {
    & $Php "$runtime\bin\daemon" init --config $config --directory $Directory --state-dir "$root\state" --project-name $ProjectName --health-url $HealthUrl
    if ($LASTEXITCODE -ne 0) { throw 'Configuration initialization failed.' }
}
$settings = @{ php = $Php; config = $config; docker_directory = (Split-Path $Docker); git_directory = (Split-Path $Git); docker_host = $DockerHost }
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText("$runtime\windows\service.json", ($settings | ConvertTo-Json), $utf8)
# The launcher calls native PHP with an argument array, so shell metacharacters stay literal.
$launcher = @'
$ErrorActionPreference = 'Stop'
$settings = Get-Content -LiteralPath "$PSScriptRoot\runtime\windows\service.json" -Raw | ConvertFrom-Json
$config = Get-Content -LiteralPath $settings.config -Raw | ConvertFrom-Json
$env:PATH = $settings.docker_directory + ';' + $settings.git_directory + ';' + (Split-Path $settings.php) + ';' + "$env:WINDIR\System32"
$env:DOCKER_HOST = $settings.docker_host
$env:DOCKER_CONTEXT = $null
$env:DOCKER_TLS_VERIFY = $null
$env:DOCKER_CERT_PATH = $null
$env:DOCKER_CONFIG = Join-Path $config.state_dir 'docker'
$env:GIT_TERMINAL_PROMPT = '0'
$env:GIT_CONFIG_COUNT = '1'
$env:GIT_CONFIG_KEY_0 = 'safe.directory'
$env:GIT_CONFIG_VALUE_0 = $config.directory
$env:TEMP = Join-Path $config.state_dir 'tmp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Path $env:TEMP, $env:DOCKER_CONFIG -Force | Out-Null
& $settings.php "$PSScriptRoot\runtime\bin\daemon" @args --config $settings.config
exit $LASTEXITCODE
'@
[System.IO.File]::WriteAllText("$root\daemon.ps1", $launcher, $utf8)
if (!$existing) { New-Service -Name lattice-daemon -DisplayName 'daemon - Lattice supervisor' -BinaryPathName $binaryPath -StartupType Automatic -Description 'PHP supervision, bounded recovery, and opt-in updates for Lattice.' | Out-Null }
& "$env:WINDIR\System32\sc.exe" config lattice-daemon start= delayed-auto
if ($LASTEXITCODE -ne 0) { throw 'Could not configure delayed startup.' }
& "$env:WINDIR\System32\sc.exe" failure lattice-daemon reset= 86400 actions= restart/10000/restart/30000/restart/60000/none/0
if ($LASTEXITCODE -ne 0) { throw 'Could not configure service recovery.' }
& "$env:WINDIR\System32\sc.exe" failureflag lattice-daemon 1
if ($LASTEXITCODE -ne 0) { throw 'Could not configure failure handling.' }
if (!$NoStart) { Start-Service lattice-daemon }
Write-Host "Installed daemon. CLI: & '$root\daemon.ps1' status"
Write-Host "Configuration: $config (existing settings preserved). Logs: $root\state\daemon.log"
