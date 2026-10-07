<?php
declare(strict_types=1);
use Lattice\Daemon\{BackupVerifier, Store, ProcessRunner};

function backupFixture(): array {
    $root = tempDirectory();
    $store = new Store($root . '/state');
    $name = '20261007-030000-a1b2c3d4';
    $directory = $store->directory . '/backups/' . $name;
    mkdir($directory, 0700, true);
    $hashes = [];
    foreach (['database.dump' => 'PGDMPtest', 'uploads.tar.gz' => "\x1f\x8btest", 'environment.env' => 'SECRET=do-not-print', 'compose.json' => '{}'] as $file => $text) {
        Store::atomicText($directory . '/' . $file, $text);
        $hashes[$file] = hash('sha256', $text);
    }
    $manifest = ['complete' => true, 'sha256' => $hashes];
    Store::atomic($directory . '/manifest.json', $manifest);
    return [$root, $store, $name, $directory, $manifest];
}

test('backup verification checks all four files and reports corruption without secrets', function (): void {
    [$root, $store, $name, $directory] = backupFixture();
    $verifier = new BackupVerifier($store);
    check($verifier->verify($name)['verified']);
    Store::atomicText($directory . '/environment.env', 'SECRET=changed');
    $result = $verifier->verify($name);
    check(!$result['verified']);
    check($result['files']['environment.env'] === 'checksum mismatch');
    check(!str_contains(json_encode($result), 'SECRET'));
    unlink($directory . '/database.dump');
    check($verifier->verify($name)['files']['database.dump'] === 'missing, unreadable, or unsafe permissions');
});

test('backup verification rejects traversal and incomplete or invalid manifests', function (): void {
    [$root, $store, $name, $directory, $manifest] = backupFixture();
    $verifier = new BackupVerifier($store);
    foreach (['../escape', '/absolute', 'C:/absolute', $name . '/..', $name . '.'] as $bad) { rejects(fn() => $verifier->verify($bad), 'directory name'); }
    Store::atomic($directory . '/manifest.json', ['complete' => false]);
    rejects(fn() => $verifier->verify($name), 'incomplete');
    $manifest['sha256']['../escape'] = str_repeat('a', 64);
    Store::atomic($directory . '/manifest.json', $manifest);
    rejects(fn() => $verifier->verify($name), 'exactly the four');
    unset($manifest['sha256']['../escape']);
    $manifest['sha256']['database.dump'] = 'invalid';
    Store::atomic($directory . '/manifest.json', $manifest);
    rejects(fn() => $verifier->verify($name), 'invalid SHA-256');
    Store::atomicText($directory . '/manifest.json', str_repeat(' ', 65537));
    rejects(fn() => $verifier->verify($name), 'too large');
});

test('verify-backup CLI needs no running Docker engine and returns checksum failure status', function (): void {
    [$root, $store, $name, $directory] = backupFixture();
    mkdir($root . '/app', 0700);
    $file = $root . '/daemon.json';
    Store::atomic($file, ['directory' => $root . '/app', 'state_dir' => $store->directory]);
    $runner = new ProcessRunner();
    $args = [PHP_BINARY, dirname(__DIR__) . '/bin/daemon', 'verify-backup', $name, '--config', $file, '--json'];
    $result = $runner->run($args, __DIR__);
    check($result->code === 0, $result->stderr);
    check(json_decode($result->stdout, true)['verified'] === true);
    Store::atomicText($directory . '/database.dump', 'damaged');
    $result = $runner->run($args, __DIR__);
    check($result->code === 2, $result->stderr);
    check(json_decode($result->stdout, true)['verified'] === false);
});

if (PHP_OS_FAMILY === 'Linux') {
    test('backup verification rejects linked and publicly readable backup files', function (): void {
        [$root, $store, $name, $directory] = backupFixture();
        $verifier = new BackupVerifier($store);
        chmod($directory . '/environment.env', 0644);
        check(!$verifier->verify($name)['verified']);
        chmod($directory . '/environment.env', 0600);
        rename($directory . '/database.dump', $root . '/original.dump');
        symlink($root . '/original.dump', $directory . '/database.dump');
        check(!$verifier->verify($name)['verified']);
        unlink($directory . '/database.dump');
    });
}
