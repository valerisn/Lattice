<?php
declare(strict_types=1);
namespace Lattice\Daemon;
use RuntimeException;
use Throwable;

final class Application
{
    public const VERSION = '0.1.0';
    private bool $stopping = false;

    public function run(array $arguments): int
    {
        $options = ['config' => '/etc/lattice/daemon.json', 'json' => false, 'once' => false];
        $positionals = [];
        for ($index = 0; $index < count($arguments); $index++) {
            $arg = $arguments[$index];
            if (in_array($arg, ['--json', '--once'], true)) { $options[substr($arg, 2)] = true; }
            elseif (in_array($arg, ['--config', '--directory', '--state-dir', '--project-name', '--health-url'], true)) {
                if (!isset($arguments[$index + 1]) || str_starts_with($arguments[$index + 1], '--')) { throw new RuntimeException("Missing value for $arg."); }
                $options[substr($arg, 2)] = $arguments[++$index];
            } elseif (in_array($arg, ['--help', '-h'], true)) { $positionals = ['help']; break; }
            elseif ($arg === '--version') { $positionals = ['version']; break; }
            elseif (str_starts_with($arg, '-')) { throw new RuntimeException("Unknown option: $arg"); }
            else { $positionals[] = $arg; }
        }
        $command = $positionals[0] ?? 'help';
        $console = new Console($options['json']);
        if ($command === 'help') { echo self::help(); return 0; }
        if ($command === 'version') { $console->output(['version' => self::VERSION, 'runtime' => 'PHP ' . PHP_VERSION]); return 0; }
        if ($command === 'init') {
            $this->init($options);
            $console->output(['message' => 'Configuration created. Automatic updates are disabled.', 'config' => $options['config']]);
            return 0;
        }
        if (!in_array($command, ['status', 'doctor', 'watch', 'start', 'stop', 'restart', 'resume', 'backup', 'check-update', 'update', 'auto-update'], true)) {
            throw new RuntimeException("Unknown command: $command. Run daemon help.");
        }
        if (count($positionals) > ($command === 'auto-update' ? 2 : 1)) { throw new RuntimeException('Unexpected command arguments.'); }
        foreach (['directory', 'state-dir', 'project-name', 'health-url'] as $key) {
            if (isset($options[$key])) { throw new RuntimeException("--$key is only valid with init. Edit the configuration to change an existing installation."); }
        }
        if ($options['once'] && $command !== 'watch') { throw new RuntimeException('--once is only valid with watch.'); }
        $config = Config::load($options['config']);
        $store = new Store($config->get('state_dir'));
        $runner = new ProcessRunner();
        $http = new Http();
        $compose = new Compose($config, $runner);
        $monitor = new Monitor($compose, $http, $store);
        $updater = new Updater($compose, $store, new Release($http), $monitor);
        if ($command === 'status') {
            $status = $monitor->snapshot();
            $status['last_update'] = $store->read('update');
            $console->output($status);
            return $status['healthy'] && !$status['update_blocked'] ? 0 : 2;
        }
        if ($command === 'doctor') {
            $checks = ['php' => PHP_VERSION_ID >= 80200, 'curl' => extension_loaded('curl'), 'signals' => extension_loaded('pcntl'),
                'compose_file' => is_file($config->get('directory') . '/compose.yaml'), 'environment_file' => is_file($config->get('directory') . '/.env')];
            foreach (['git' => ['git', '--version'], 'docker' => ['docker', 'info', '--format', '{{.ServerVersion}}'], 'compose' => ['docker', 'compose', 'version']] as $name => $args) {
                $checks[$name] = $runner->run($args, $config->get('directory'))->code === 0;
            }
            foreach ($checks as $name => $ok) { $checks[$name] = $ok ? 'ready' : 'missing or unavailable'; }
            $console->output($checks);
            return in_array('missing or unavailable', $checks, true) ? 2 : 0;
        }
        if ($command === 'watch') { return $this->watch($options['config'], $store, $options['once']); }
        return $store->locked('action', function () use ($command, $positionals, $options, $config, $store, $compose, $monitor, $updater, $console): int {
            $state = $store->read('monitor');
            switch ($command) {
                case 'auto-update':
                    $enabled = $positionals[1] ?? '';
                    if (!in_array($enabled, ['on', 'off'], true)) { throw new RuntimeException('Use daemon auto-update on or daemon auto-update off.'); }
                    $data = Config::load($options['config'])->data;
                    $data['auto_update'] = $enabled === 'on';
                    Store::atomic($options['config'], $data);
                    $console->output(['auto_update' => $data['auto_update'], 'window_utc' => $data['update_window_utc'], 'message' => 'The service reloads this setting on its next check.']);
                    return 0;
                case 'check-update': $console->output($updater->check()); return 0;
                case 'update': $result = $updater->apply(); $console->output($result); return ($result['status'] ?? '') === 'major-blocked' ? 2 : 0;
                case 'backup': $console->output($updater->backup()); return 0;
                case 'stop':
                    $state['paused'] = true;
                    $store->write('monitor', $state);
                    $compose->must(['stop', '--timeout', '30'], 'Stop stack', 120);
                    $console->output(['message' => 'Stack stopped. Supervision stays paused until start or resume. Volumes are preserved.']);
                    return 0;
                case 'start':
                    $compose->must(['up', '-d', '--build', '--wait', '--wait-timeout', '120'], 'Start stack', 1800);
                    $updater->waitHealthy();
                    $state['paused'] = false; $state['failures'] = 0;
                    $store->write('monitor', $state);
                    $console->output(['message' => 'Stack started. Use resume separately if an interrupted update remains blocked.']);
                    return 0;
                case 'restart':
                    $compose->must(['restart', '--timeout', '30', 'app'], 'Restart app', 90);
                    $updater->waitHealthy();
                    $console->output(['message' => 'Application restarted and healthy.']);
                    return 0;
                case 'resume':
                    if (!$monitor->snapshot()['healthy']) { throw new RuntimeException('Restore a healthy stack before resuming supervision.'); }
                    $state['paused'] = false; $state['failures'] = 0; $state['recoveries'] = [];
                    $store->write('monitor', $state);
                    $update = $store->read('update'); $update['blocked'] = false; $update['phase'] = 'operator-resumed';
                    unset($update['error']);
                    $store->write('update', $update);
                    $console->output(['message' => 'Supervision resumed after a successful health check.']);
                    return 0;
            }
            return 1;
        });
    }

    private function init(array $options): void
    {
        $data = Config::defaults();
        foreach (['directory', 'state-dir', 'project-name', 'health-url'] as $key) {
            if (isset($options[$key])) { $data[str_replace('-', '_', $key)] = $options[$key]; }
        }
        $config = new Config($data);
        $parent = dirname($options['config']);
        if (!is_dir($parent) && !mkdir($parent, 0700, true)) { throw new RuntimeException('Cannot create configuration directory.'); }
        $file = @fopen($options['config'], 'x');
        if (!$file) { throw new RuntimeException('Configuration already exists or cannot be created. No changes made.'); }
        try {
            chmod($options['config'], 0600);
            $text = json_encode($config->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
            if (fwrite($file, $text) !== strlen($text)) { throw new RuntimeException('Could not finish writing configuration.'); }
        } finally { fclose($file); }
        new Store($config->get('state_dir'));
    }

    private function watch(string $file, Store $store, bool $once): int
    {
        if (!$once && (PHP_OS_FAMILY !== 'Linux' || !extension_loaded('pcntl'))) {
            throw new RuntimeException('The service requires Linux and PHP pcntl for graceful shutdown.');
        }
        if (extension_loaded('pcntl')) {
            pcntl_async_signals(true);
            pcntl_signal(SIGTERM, function (): void { $this->stopping = true; });
            pcntl_signal(SIGINT, function (): void { $this->stopping = true; });
        }
        return $store->locked('watch', function () use ($file, $store, $once): int {
            Console::log('started', ['version' => self::VERSION]);
            $signature = '';
            do {
                $config = Config::load($file);
                if ($config->get('state_dir') !== $store->directory) { throw new RuntimeException('Restart daemon after changing state_dir.'); }
                $compose = new Compose($config, new ProcessRunner());
                $http = new Http();
                $monitor = new Monitor($compose, $http, $store);
                try {
                    $status = $store->locked('action', function () use ($monitor, $compose, $http, $store): array {
                        $status = $monitor->tick(time());
                        $result = (new Updater($compose, $store, new Release($http), $monitor))->automatic(time());
                        if ($result !== null) { Console::log('update-check', $result); }
                        return $status;
                    });
                    $next = json_encode([$status['healthy'], $status['problems'], $status['paused'], $status['update_blocked'], $status['auto_update'], $status['recovery']], JSON_THROW_ON_ERROR);
                    if ($signature !== $next) { Console::log('health', $status); $signature = $next; }
                } catch (Throwable $error) { Console::log('attention', ['message' => $error->getMessage()]); }
                if ($once) { return isset($status) && $status['healthy'] && !$status['update_blocked'] ? 0 : 2; }
                for ($wait = 0; $wait < $config->get('poll_seconds') && !$this->stopping; $wait++) { sleep(1); }
            } while (!$this->stopping);
            Console::log('stopped');
            return 0;
        });
    }

    private static function help(): string
    {
        return <<<'HELP'
daemon · Lattice supervisor

Usage: daemon <command> [--config /etc/lattice/daemon.json] [--json]

  init           Create configuration without overwriting an existing file
  doctor         Check PHP, Docker, Compose, Git, and installation files
  status         Inspect health, free disk space, and update state
  watch          Supervise continuously; --once performs one tick
  start          Build and start the Docker stack
  stop           Stop the stack and pause recovery, preserving data volumes
  restart        Restart the application container and verify health
  resume         Resume supervision after an operator repairs the stack
  backup         Pause app, back up PostgreSQL/uploads, then resume app
  check-update   Check the official stable GitHub release
  update         Back up and install an eligible stable release
  auto-update on|off
                 Enable or disable unattended updates (off by default)
  version        Print daemon and PHP versions

init options:
  --directory /opt/lattice
  --state-dir /var/lib/lattice-daemon
  --project-name lattice
  --health-url http://127.0.0.1:3000/api/health

Service: systemctl status lattice-daemon
Logs:    journalctl -u lattice-daemon -f
Exit codes: 0 success, 1 error, 2 unhealthy or action required.
Updates pause on interruption; no automatic database downgrade.

HELP;
    }
}

