<?php
declare(strict_types=1);
use Lattice\Daemon\{ProcessRunner, Config, Store};

test('CLI init preserves existing configuration and auto-update toggles explicitly', function (): void {
    $dir = tempDirectory();
    mkdir($dir . '/app');
    $runner = new ProcessRunner();
    $bin = dirname(__DIR__) . '/bin/daemon';
    $file = $dir . '/daemon.json';
    $args = [PHP_BINARY, $bin, 'init', '--config', $file, '--directory', $dir . '/app', '--state-dir', $dir . '/state', '--json'];
    check($runner->run($args, __DIR__)->code === 0);
    $first = file_get_contents($file);
    check($runner->run($args, __DIR__)->code === 1);
    check(file_get_contents($file) === $first);
    check(!Config::load($file)->get('auto_update'));
    check($runner->run([PHP_BINARY, $bin, 'auto-update', 'on', '--config', $file, '--json'], __DIR__)->code === 0);
    check(Config::load($file)->get('auto_update'));
    check($runner->run([PHP_BINARY, $bin, 'auto-update', 'off', '--config', $file], __DIR__)->code === 0);
    check(!Config::load($file)->get('auto_update'));
    check($runner->run([PHP_BINARY, $bin, 'stop', '--unknown'], __DIR__)->code === 1);
});

test('CLI pause preserves containers, recovery history, and update blocks', function (): void {
    $dir = tempDirectory();
    mkdir($dir . '/app');
    $store = new Store($dir . '/state');
    $file = $dir . '/daemon.json';
    Store::atomic($file, ['directory' => $dir . '/app', 'state_dir' => $store->directory, 'auto_update' => true]);
    $store->write('monitor', ['failures' => 7, 'recoveries' => [12345]]);
    $store->write('update', ['blocked' => true, 'phase' => 'failed']);
    $runner = new ProcessRunner();
    $args = [PHP_BINARY, dirname(__DIR__) . '/bin/daemon', 'pause', '--config', $file, '--json'];
    $blocked = $store->locked('action', fn () => $runner->run($args, __DIR__));
    check($blocked->code === 1);
    check(str_contains($blocked->stderr, 'Another daemon action operation is running'));
    check(!isset($store->read('monitor')['paused']));
    // No Compose file or running engine is needed to record maintenance intent.
    foreach ([1, 2] as $attempt) {
        $result = $runner->run($args, __DIR__);
        check($result->code === 0, $result->stderr);
        check(json_decode($result->stdout, true)['paused'] === true);
        check($store->read('monitor') === ['failures' => 7, 'recoveries' => [12345], 'paused' => true]);
        check($store->read('update') === ['blocked' => true, 'phase' => 'failed']);
        check(Config::load($file)->get('auto_update'));
    }
});

