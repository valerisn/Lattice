# daemon for Windows

The PHP supervisor can now run as the **lattice-daemon** Windows service. A small, locally compiled .NET Framework host connects PHP to the Windows Service Control Manager. Health checks, bounded app recovery, backups, and opt-in release updates use the same PHP implementation as Linux.

**Initial Windows support:** CI tests real service registration, startup, graceful stop, crash recovery, reinstall, and uninstall against a fixture Docker executable. The PHP backup/update tests run on both platforms. Real Docker/PostgreSQL backup integration runs on Linux; Windows Docker Desktop integration still needs an end-to-end deployment test.

## Requirements

- 64-bit Windows 11 or Windows Server with .NET Framework 4.8 and Windows PowerShell 5.1. CI exercises Windows Server 2022. No additional .NET SDK or Composer packages are needed.
- PHP 8.2–8.5 CLI with cURL, Git, and Docker CLI with Compose v2.
- An existing, configured Lattice checkout and a **Linux container engine**, reachable through a local Docker named pipe.
- An elevated Windows PowerShell terminal for service installation and administration.

Docker Desktop must be running in Linux container mode. daemon does not start Docker Desktop, repair WSL, or provision a VM. Its delayed automatic startup does not guarantee that Docker Desktop's backend is available before sign-in. An unavailable engine is reported as unhealthy; daemon keeps checking. See [Docker's Windows permissions and backend behavior](https://docs.docker.com/desktop/setup/install/windows-permission-requirements/).

The service runs as LocalSystem because it controls Docker. The checkout, PHP distribution, Git, Docker tools, and installed runtime must be writable only by SYSTEM and Administrators, with trusted owners and ancestors. Junctions and other reparse points are rejected. The installer checks these permissions and never recursively changes an existing deployment's ACLs for you. User-writable developer checkouts and per-user tool installations are unsuitable for this service account.

For a new deployment, create a dedicated directory in an elevated terminal before cloning/configuring Lattice there:

```powershell
$deployment = "$env:ProgramData\LatticeDeployment"
New-Item -ItemType Directory -Path $deployment -ErrorAction Stop
icacls $deployment /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' /setowner '*S-1-5-32-544'
if ($LASTEXITCODE) { throw 'Could not secure deployment directory.' }
git clone https://github.com/valerisn/Lattice.git "$deployment\application"
```

Configure `.env` using Lattice's [Docker installation instructions](../../README.md#self-host-with-docker), then build and start its stack. Install PHP, Git, and Docker machine-wide in administrator-controlled directories. Do not weaken system-wide ACLs or grant ordinary users access to daemon's state.

## Install

From the configured checkout, in **Windows PowerShell 5.1 as Administrator**:

```powershell
.\daemon\windows\install.ps1 -Directory (Get-Location).Path
Set-Alias daemon "$env:ProgramData\LatticeDaemon\daemon.ps1"
daemon doctor
daemon status
Get-Service lattice-daemon
```

The installer uses PHP, Docker, and Git from your current PATH, verifies their locations, compiles the host from the checked-out C# source, and copies the runtime to `%ProgramData%\LatticeDaemon\runtime`. You can specify `-Php`, `-Docker`, and `-Git` with full executable paths. `-NoStart` registers the service without starting it. If your execution policy blocks local scripts, use your organization's approved signing or script policy; the installer does not change execution policy.

The default engine is `npipe:////./pipe/dockerDesktopLinuxEngine`. To use another local Linux engine pipe, pass `-DockerHost` with its exact endpoint from `docker context inspect`. Remote TCP, SSH, and user-selected Docker contexts are not supported by this installer. It does not copy your personal Docker credentials. The service and CLI use their own `%ProgramData%\LatticeDaemon\state\docker` configuration; configure registry authentication there if your deployment requires it.

Use `-ProjectName` and `-HealthUrl` on the first install when your existing stack uses a different Compose project name or HTTP port. Reinstalling preserves `daemon.json` and therefore preserves its project, health URL, state directory, recovery policy, and update preferences. The installer stops the service gracefully before replacing runtime files. Rerun it from a reviewed checkout to update daemon itself.

## Control and inspect

`daemon status` also explains why automatic recovery is waiting, including failed checks, restart attempts in the last hour, and cooldown seconds. `daemon status --json` exposes these fields under `recovery_policy` without restarting containers.

Run these in an elevated PowerShell terminal. Recreate the `daemon` alias in each terminal or invoke the full `daemon.ps1` path.

```powershell
Set-Alias daemon "$env:ProgramData\LatticeDaemon\daemon.ps1"
daemon status --json
daemon check-update
daemon backup
daemon backups
daemon auto-update on
daemon auto-update off
Stop-Service lattice-daemon
Start-Service lattice-daemon
Get-Content "$env:ProgramData\LatticeDaemon\state\daemon.log" -Tail 30 -Wait
```

`Stop-Service` stops supervision and leaves containers running. `daemon stop` stops the Lattice stack and pauses recovery. `daemon start` starts it again. The CLI exits with 0 for success, 1 for an execution/configuration error, or 2 when health needs attention.

Use `daemon pause` for maintenance while keeping containers and health checks running. It suspends automatic recovery and automatic updates across service restarts. `daemon resume` requires a healthy stack before enabling supervision again. Manual backup and container commands remain available while paused. Pause refuses to interrupt an active backup, update, or recovery operation.

For a long-running backup/update, Windows may continue to show **Stopping**. The service requests additional time while PHP finishes the current operation, up to one hour. It does not begin another automatic update after a stop request. A per-launch random stop token prevents stale requests from stopping a restarted service. Unexpected host termination kills its remaining child processes through a [Windows Job Object](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects); persisted update blocks still require operator recovery. Windows shutdown/reboot deadlines can interrupt work sooner, so schedule host restarts outside update/backup periods.

The service restarts after failures with 10, 30, and 60 second delays, then stops retrying until an administrator intervenes or the failure count resets after a day. Logs rotate at approximately 10 MiB, retaining three previous files. Backups are never deleted automatically.

`daemon verify-backup` accepts the directory name of a completed backup under `state\backups`, with optional `--json`. It checks all four file checksums without requiring Docker or interrupting supervision. See the [backup verification guide](../README.md#backups-and-interrupted-updates) for exit codes and recovery limits.

Startup errors also appear in Windows Event Viewer under **Windows Logs → Application**, source `lattice-daemon`.

## Configuration and data

| Location under `%ProgramData%\LatticeDaemon` | Purpose                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| `daemon.json`                                | PHP supervision and update settings, reloaded each cycle                   |
| `runtime\windows\service.json`               | PHP/tool locations and Docker pipe, reloaded on service restart            |
| `daemon.ps1`                                 | CLI launcher using the service's engine and configuration                  |
| `state\`                                     | Private operation locks, health/update state, temporary files, and backups |
| `state\daemon.log`                           | PHP events and service lifecycle messages                                  |

Automatic updates remain **disabled by default**. Enabling them updates the Lattice application only, inside the configured UTC maintenance window. The same coordinated backups, stable-release restrictions, and interrupted-update recovery rules apply as on Linux. Read [daemon's update and recovery guide](../README.md#automatic-updates) before enabling unattended updates.

The installation grants access only to SYSTEM and Administrators. PHP validates Windows ACLs before trusting configuration, state files, and locks. Backups include deployment secrets. State must stay outside the checkout; restarting the service is required after moving it. The runtime has no HTTP listener and never exposes control through the web application.

To unregister the service while preserving containers, configuration, runtime, state, and backups:

```powershell
.\daemon\windows\uninstall.ps1
```

## Develop and test

```powershell
.\daemon\windows\build.ps1
php daemon/bin/daemon help
.\daemon\windows\test.ps1
```

The test script needs an elevated terminal to create a private fixture directory. It tests ACL rejection, junction rejection, PHP monitoring/update behavior, and service stop tokens. `test.ps1 -Service` additionally installs a temporary real service and is intended for a **disposable Windows machine** with no existing daemon installation. It uses a fixture Docker CLI and a real local HTTP health server, not real containers. The script refuses to overwrite an existing installation and removes only its own fixtures.

For foreground use, build the host for ACL validation, create private configuration/state, and run `php daemon/bin/daemon watch --config C:/path/to/daemon.json` in a Windows console. Ctrl+C requests a graceful stop. The native host also supports `--console service.json` for debugging with the current user's permissions.
