<?php
declare(strict_types=1);
use Lattice\Daemon\{ProcessRunner, Config};

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

