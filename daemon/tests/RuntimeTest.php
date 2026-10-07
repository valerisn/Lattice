<?php
declare(strict_types=1);
use Lattice\Daemon\Config;
use Lattice\Daemon\Store;
use Lattice\Daemon\ProcessRunner;

test('configuration defaults are opt-in and invalid values fail closed', function (): void {
    $config = new Config([]);
    check($config->get('auto_update') === false);
    rejects(fn () => new Config(['auto_update' => 'false']), 'true or false');
    rejects(fn () => new Config(['poll_seconds' => 0]), 'poll_seconds');
    rejects(fn () => new Config(['directory' => '/']), 'filesystem root');
    rejects(fn () => new Config(['state_dir' => '/opt/lattice/data']), 'outside');
    rejects(fn () => new Config(['project_name' => '--evil']), 'invalid');
    rejects(fn () => new Config(['health_url' => 'file:///etc/passwd']), 'HTTP(S)');
    rejects(fn () => new Config(['health_url' => 'http://user:pass@localhost']), 'credentials');
    rejects(fn () => new Config(['auto_udpate' => true]), 'Unknown');
});
test('update windows support midnight and exclude the ending hour', function (): void {
    $config = new Config(['update_window_utc' => '23-02']);
    check($config->inUpdateWindow(strtotime('2026-10-07 23:00:00 UTC')));
    check($config->inUpdateWindow(strtotime('2026-10-07 01:00:00 UTC')));
    check(!$config->inUpdateWindow(strtotime('2026-10-07 02:00:00 UTC')));
});
test('state writes are atomic, persist, and actions cannot overlap', function (): void {
    $dir = tempDirectory();
    $store = new Store($dir);
    $store->write('monitor', ['failures' => 1]);
    $store->write('monitor', ['failures' => 2]);
    check($store->read('monitor')['failures'] === 2);
    Store::atomicText($dir . '/compose.json', '{"networks":{"default":{}}}');
    check(file_get_contents($dir . '/compose.json') === '{"networks":{"default":{}}}');
    $store->locked('action', function () use ($store): void {
        rejects(fn () => $store->locked('action', fn () => null), 'Another daemon');
    });
    check($store->locked('action', fn () => 'released') === 'released');
    rejects(fn () => $store->read('../escape'), 'Invalid state filename');
    file_put_contents($dir . '/monitor.json', '{bad');
    rejects(fn () => $store->read('monitor'), 'Syntax error');
});
test('process runner preserves literal arguments without a shell', function (): void {
    $runner = new ProcessRunner();
    $literal = 'spaces ; $(echo unexpected) & "quoted"';
    $result = $runner->run([PHP_BINARY, '-r', 'echo $argv[1];', $literal], __DIR__);
    check($result->code === 0);
    check($result->stdout === $literal, $result->stdout);
    check($runner->run([PHP_BINARY, '-r', 'exit(7);'], __DIR__)->code === 7);
});
test('process runner times out and streams binary backups without truncation', function (): void {
    $runner = new ProcessRunner();
    $started = microtime(true);
    check($runner->run([PHP_BINARY, '-r', 'sleep(10);'], __DIR__, 1)->code === 124);
    check(microtime(true) - $started < 5);
    $file = tempDirectory() . '/backup.bin';
    $result = $runner->run([PHP_BINARY, '-r', 'echo str_repeat(chr(0) . chr(255), 100000);'], __DIR__, 5, $file);
    check($result->code === 0 && $result->stdout === '');
    check(filesize($file) === 200000);
});

