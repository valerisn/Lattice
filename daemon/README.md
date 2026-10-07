<p align="center"><img src="../public/lattice-logo.png" width="80" alt="Lattice logo"></p>

# daemon

**A PHP supervisor for Lattice Docker installations on Linux.**

[![Verify daemon](https://github.com/valerisn/Lattice/actions/workflows/daemon.yml/badge.svg)](https://github.com/valerisn/Lattice/actions/workflows/daemon.yml)

daemon watches the application container, PostgreSQL, the HTTP health endpoint, and free space on the deployment and state filesystems. It runs under systemd, provides a readable CLI and JSON output, restarts a failing application within configured limits, and can install stable Lattice releases when automatic updates are enabled.

The PHP runtime has no Composer dependencies. Requirements: Linux with systemd, **PHP 8.2+ with cURL and pcntl**, Git, Docker Engine, and Docker Compose v2 with `--wait` support. Ubuntu 24.04 is exercised in CI across PHP 8.2–8.5.

## Install

Use an existing Lattice source checkout with a configured `.env` and Docker stack. For the supplied service, keep the checkout under `/opt/lattice` or `/srv`; the service cannot read home directories.

On Ubuntu 24.04:

```sh
sudo apt-get update
sudo apt-get install php-cli php-curl git
cd /opt/lattice
sudo bash daemon/install.sh /opt/lattice
sudo daemon status
```

Install [Docker Engine and the Compose plugin](https://docs.docker.com/engine/install/) before running the installer. The PHP CLI package supplies pcntl on the supported Ubuntu installation.

The installer copies daemon into `/usr/local/lib/lattice-daemon`, creates the `daemon` command, creates configuration only if it is absent, and enables `lattice-daemon.service` at boot. It preserves existing configuration. Docker's own restart policy starts existing containers after a host reboot; `daemon start` can build and start an installation manually.

The service runs as root because it controls Docker. Keep the checkout, configuration, and installed PHP files writable only by trusted host administrators. Docker control is host-level authority. The web application receives no Docker socket, daemon credentials, or administrative control endpoint.

For an existing Compose project with a different name or port, initialize configuration before installing:

```sh
sudo php daemon/bin/daemon init --directory /opt/lattice
sudoedit /etc/lattice/daemon.json
sudo bash daemon/install.sh /opt/lattice
```

Set `project_name` to the existing project's name from `docker compose ls`. Match `health_url` to that stack. daemon manages one project with one `app` container, one `db` container, PostgreSQL, and uploads mounted at `/app/uploads`. It does not manage unrelated containers or operating-system package updates.

## Everyday use

```sh
sudo daemon doctor
sudo daemon status
sudo daemon status --json
sudo daemon start
sudo daemon restart
sudo daemon backup
sudo daemon check-update
sudo daemon update
sudo journalctl -u lattice-daemon -f
```

`daemon stop` pauses supervision and stops containers without deleting volumes. `daemon start` starts the stack again. `systemctl stop lattice-daemon` stops only the supervisor; it leaves Lattice running.

`daemon watch --once` runs one monitoring cycle. Continuous `watch` emits JSON log events when health changes or an operation needs attention. systemd captures these in the journal. `status.json` in the state directory records the latest cycle.

Exit codes: **0** success, **1** execution/configuration error, **2** unhealthy or operator action required. `NO_COLOR=1` disables terminal color.

## Automatic updates

Automatic updates are **off by default**. Enable or disable them explicitly:

```sh
sudo daemon auto-update on
sudo daemon auto-update off
```

The service reloads configuration on the next cycle. The default update window is **03:00–05:00 UTC**. Checks occur at most once every six hours, within the window. With automatic updates disabled, monitoring makes no GitHub release requests. The manual `check-update` and `update` commands work outside the window.

Updates follow published stable releases from the official GitHub repository. Prereleases, unreleased main-branch commits, forks, dirty checkouts, divergent Git history, and changes to database/storage wiring require manual handling. An installation ahead of the latest release is never downgraded. Major-version upgrades are blocked unless `allow_major_updates` is explicitly enabled after reviewing release notes.

An eligible update:

1. Validates the official HTTPS origin, clean checkout, release tag, package version, and forward Git ancestry.
2. Records the previous revision and Compose configuration, then builds the new app image while the old container continues serving.
3. Pauses the app, creates a PostgreSQL custom-format dump and upload archive, and records checksums in a completed backup manifest.
4. Recreates only the app container and verifies container and HTTP health. PostgreSQL is not recreated.

There is downtime during the coordinated backup and activation. A failed build or backup resumes the previous app when possible. Once activation starts, migrations may have run: daemon stops the app and blocks automated recovery on failure instead of automatically downgrading the database. Interrupted operations also remain blocked after daemon restarts.

A failed release is not retried automatically. Inspect the problem before using a manual update. The installed daemon PHP service code is updated by rerunning the installer from a reviewed checkout; unattended updates update **Lattice**, not the currently executing supervisor.

## Configuration

Configuration lives at `/etc/lattice/daemon.json`. See [the complete example](config.example.json). Unknown fields and invalid values are rejected.

| Setting                           | Default                            | Purpose                                                           |
| --------------------------------- | ---------------------------------- | ----------------------------------------------------------------- |
| `directory`                       | `/opt/lattice`                     | Git checkout and Compose project directory                        |
| `state_dir`                       | `/var/lib/lattice-daemon`          | State, operation locks, and backups; must be outside the checkout |
| `project_name`                    | `lattice`                          | Existing Docker Compose project name                              |
| `health_url`                      | `http://127.0.0.1:3000/api/health` | Endpoint requiring HTTP 200 and JSON status `ok`                  |
| `poll_seconds`                    | 30                                 | Health-check interval                                             |
| `failure_threshold`               | 3                                  | Consecutive failures before recovery                              |
| `auto_recover`                    | true                               | Allow bounded app-container restarts                              |
| `recovery_cooldown_seconds`       | 900                                | Minimum interval between recovery attempts                        |
| `minimum_free_mb`                 | 2048                               | Free-space floor on deployment and state filesystems              |
| `auto_update`                     | false                              | Allow unattended stable Lattice updates                           |
| `allow_major_updates`             | false                              | Permit a newer major release                                      |
| `update_interval_seconds`         | 21600                              | Minimum time between automatic release checks                     |
| `update_window_utc`               | `03-05`                            | UTC hours, start inclusive/end exclusive; `00-00` means all day   |
| `database_name` / `database_user` | `lattice`                          | PostgreSQL dump database and role                                 |

Recovery never restarts PostgreSQL. It requires a ready database and sufficient disk space, respects operator pauses and interrupted-update blocks, and allows at most three attempts in a rolling hour. It does not reconstruct deleted containers or volumes.

Restart the service after changing `state_dir`; other settings reload each cycle. A manually running daemon accepts `--config /absolute/path/daemon.json`.

## Backups and interrupted updates

Backups live under `state_dir/backups`. Each contains:

- `database.dump`: PostgreSQL custom-format backup.
- `uploads.tar.gz`: uploaded files, captured while the app is stopped.
- `environment.env` and `compose.json`: deployment configuration, including secrets.
- `manifest.json`: completion flag, previous Git revision, image ID, and SHA-256 checksums.

Directories use mode 0700 and files use 0600. Only backups with a completed manifest should be used for recovery. Copy completed backups off the host and manage retention; daemon never deletes old backups automatically. The free-space check covers deployment/state filesystems, not Docker's internal storage when it is on another filesystem.

After a failed activation, inspect `sudo daemon status --json`, the journal, app logs, and the recorded manifest. Keep supervision stopped while repairing. Restore the matching source revision, database dump, uploads, and configuration together into a recovery deployment, or complete the forward migration. Test login, a document, and an attachment before returning traffic. Do not run older code against a possibly migrated database based only on the image ID.

Once the repaired stack is healthy:

```sh
sudo daemon resume
sudo systemctl start lattice-daemon
```

`resume` acknowledges operator recovery; it checks health but cannot verify that a manual database restoration was semantically correct.

## Development and CI

```sh
php daemon/tests/run.php
php daemon/bin/daemon help
```

[daemon CI](../.github/workflows/daemon.yml) runs PHP lint, ShellCheck, runtime/service-policy tests, and update failure-path tests on Linux with PHP 8.2, 8.3, 8.4, and 8.5. A separate Linux job installs the actual systemd service and exercises Docker health checks, PostgreSQL/upload backups, archive readability, graceful shutdown, and app recovery against a disposable Lattice stack.

The supervisor does not expose an HTTP listener. Runtime tests can run on Windows; the installed service targets Linux. Licensed under the repository's [AGPL-3.0 license](../LICENSE).
