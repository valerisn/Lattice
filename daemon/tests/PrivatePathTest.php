<?php
declare(strict_types=1);
use Lattice\Daemon\Store;
use Lattice\Daemon\Config;

if (PHP_OS_FAMILY === 'Linux') {
    test('private state refuses shared directories and symbolic links', function (): void {
        $root = tempDirectory();
        mkdir($root . '/shared', 0777);
        chmod($root . '/shared', 0777);
        rejects(fn () => new Store($root . '/shared'), 'mode 0700');
        mkdir($root . '/private', 0700);
        symlink($root . '/private', $root . '/link');
        rejects(fn () => new Store($root . '/link'), 'not symlinks');
        mkdir($root . '/shared/child', 0700);
        rejects(fn () => new Store($root . '/shared/child'), 'writable shared parents');
    });
    test('configuration, state and locks reject exposed files and symlinks', function (): void {
        $root = tempDirectory();
        $store = new Store($root);
        Store::atomic($root . '/config.json', Config::defaults());
        chmod($root . '/config.json', 0666);
        rejects(fn () => Config::load($root . '/config.json'), 'mode 0700');
        $store->write('update', ['blocked' => true]);
        symlink($root . '/update.json', $root . '/monitor.json');
        rejects(fn () => $store->read('monitor'), 'not symlinks');
        symlink($root . '/missing', $root . '/status.json');
        rejects(fn () => $store->read('status'), 'not symlinks');
        symlink($root . '/update.json', $root . '/action.lock');
        rejects(fn () => $store->locked('action', fn () => null), 'not symlinks');
        check($store->read('update')['blocked'] === true);
    });
}
