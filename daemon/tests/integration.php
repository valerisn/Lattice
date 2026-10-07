<?php
declare(strict_types=1);
// Run only against a disposable Docker installation created by daemon CI.
require dirname(__DIR__) . '/autoload.php';
use Lattice\Daemon\{Config, Store, ProcessRunner, Compose, Http, Monitor, Release, Updater};

function requireTrue(bool $value, string $message): void { if (!$value) { throw new RuntimeException($message); } }
$config = Config::load($argv[1] ?? '/etc/lattice/daemon.json');
$config = new Config(array_merge($config->data, ['minimum_free_mb' => 100, 'failure_threshold' => 1, 'auto_update' => false]));
$store = new Store($config->get('state_dir'));
$runner = new ProcessRunner();
$compose = new Compose($config, $runner);
$http = new Http();
$monitor = new Monitor($compose, $http, $store);
$updater = new Updater($compose, $store, new Release($http), $monitor);
$store->locked('action', function () use ($config, $store, $runner, $compose, $monitor, $updater): void {
    requireTrue($monitor->snapshot()['healthy'], 'Initial Docker stack must be healthy.');
    $compose->must(['exec', '-T', 'app', 'node', '-e', "require('node:fs').writeFileSync('/app/uploads/daemon-ci.txt','daemon integration fixture')"], 'Create test upload');
    $result = $updater->backup();
    $path = $result['backup'];
    $manifest = json_decode(file_get_contents($path . '/manifest.json'), true, 32, JSON_THROW_ON_ERROR);
    requireTrue($manifest['complete'] === true, 'Backup manifest is incomplete.');
    $verified = (new \Lattice\Daemon\BackupVerifier($store))->verify(basename($path));
    requireTrue($verified['verified'] === true, 'Backup verification rejected a completed Docker backup.');
    foreach ($manifest['sha256'] as $name => $hash) {
        requireTrue(hash_file('sha256', $path . '/' . $name) === $hash, "Checksum failed for $name.");
    }
    $archive = $runner->run(['tar', '-tzf', $path . '/uploads.tar.gz'], $config->get('directory'));
    requireTrue($archive->code === 0 && str_contains($archive->stdout, 'daemon-ci.txt'), 'Upload archive is missing its fixture.');
    $dump = $runner->run(['docker', 'run', '--rm', '--network', 'none', '--mount', "type=bind,source=$path,target=/backup,readonly",
        'postgres:17-bookworm', 'pg_restore', '--list', '/backup/database.dump'], $config->get('directory'), 120);
    requireTrue($dump->code === 0 && str_contains($dump->stdout, 'schema_migrations'), 'PostgreSQL cannot read the backup.');
    requireTrue($monitor->snapshot()['healthy'], 'App did not resume after backup.');
    $compose->must(['stop', '--timeout', '30', 'app'], 'Simulate stopped app', 90);
    $tick = $monitor->tick(time());
    requireTrue($tick['recovery'] === 'app restart requested', 'Supervisor did not attempt recovery.');
    $updater->waitHealthy();
    $state = $store->read('monitor');
    $state['paused'] = true;
    $store->write('monitor', $state);
    $compose->must(['stop', '--timeout', '30', 'app'], 'Simulate operator pause', 90);
    requireTrue($monitor->tick(time() + 3600)['recovery'] === 'none', 'Paused supervision restarted the app.');
    $compose->must(['start', 'app'], 'Resume test app');
    $updater->waitHealthy();
    $state['paused'] = false;
    $state['failures'] = 0;
    $store->write('monitor', $state);
    echo "PASS Docker health, complete database/upload backups, app recovery, and operator pause\n";
});

