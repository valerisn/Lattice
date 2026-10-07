#Requires -Version 5.1
#Requires -PSEdition Desktop
[CmdletBinding()]
param([switch]$Service)
$ErrorActionPreference = 'Stop'
& "$PSScriptRoot\build.ps1"
$hostExe = Join-Path $PSScriptRoot 'daemon-host.exe'
& $hostExe --self-test
if ($LASTEXITCODE -ne 0) { throw 'Host self-test failed.' }
$root = Join-Path $env:ProgramData ('LatticeDaemon-test-' + [Guid]::NewGuid().ToString('N'))
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
$acl.SetOwner([System.Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
foreach ($sid in @('S-1-5-18', 'S-1-5-32-544')) {
    $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new($sid), 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
}
[System.IO.Directory]::CreateDirectory($root, $acl) | Out-Null
$env:LATTICE_DAEMON_TEST_ROOT = $root
try {
    & $hostExe --check-private $root directory
    if ($LASTEXITCODE -ne 0) { throw 'Private fixture rejected.' }
    $exposed = Join-Path $root 'exposed'
    New-Item -ItemType Directory -Path $exposed | Out-Null
    $exposedAcl = Get-Acl -LiteralPath $exposed
    $exposedAcl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new('S-1-5-32-545'), 'ReadAndExecute', 'Allow'))
    Set-Acl -LiteralPath $exposed -AclObject $exposedAcl
    $ErrorActionPreference = 'Continue'
    & $hostExe --check-private $exposed directory 2>&1 | Out-String | Write-Host
    $rejected = $LASTEXITCODE -ne 0
    $ErrorActionPreference = 'Stop'
    if (!$rejected) { throw 'Exposed state accepted.' }
    $junction = Join-Path $root 'junction'
    New-Item -ItemType Junction -Path $junction -Target $exposed | Out-Null
    $ErrorActionPreference = 'Continue'
    & $hostExe --check-private $junction directory 2>&1 | Out-String | Write-Host
    $rejected = $LASTEXITCODE -ne 0
    $ErrorActionPreference = 'Stop'
    if (!$rejected) { throw 'Junction accepted.' }
    [System.IO.Directory]::Delete($junction)
    php "$PSScriptRoot\..\tests\run.php"
    if ($LASTEXITCODE -ne 0) { throw 'PHP runtime tests failed.' }
    if ($Service) { & "$PSScriptRoot\test-service.ps1" -FixtureRoot $root }
} finally {
    $env:LATTICE_DAEMON_TEST_ROOT = $null
    # Only this randomly named fixture is disposable.
    $resolved = [System.IO.Path]::GetFullPath($root)
    $parent = [System.IO.Path]::GetFullPath($env:ProgramData).TrimEnd('\') + '\'
    if (!$resolved.StartsWith($parent, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolved -Leaf) -notmatch '^LatticeDaemon-test-[a-f0-9]{32}$') { throw 'Unsafe fixture cleanup target.' }
    if (Test-Path -LiteralPath $junction) { [System.IO.Directory]::Delete($junction) }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
