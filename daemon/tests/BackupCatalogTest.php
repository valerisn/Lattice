<?php
declare(strict_types=1);
use Lattice\Daemon\{BackupCatalog, Store, Console};

test('backup catalog is empty before the first backup', function (): void {
    $catalog = new BackupCatalog(new Store(tempDirectory() . '/state'));
    check($catalog->read()['backups'] === []);
    check($catalog->read()['total'] === 0);
});

test('backup catalog distinguishes completion and unreadable manifests without reading secrets', function (): void {
    $store = new Store(tempDirectory() . '/state');
    foreach (['20261001-030000-a1b2c3d4', '20261002-030000-a1b2c3d4', '20261003-030000-a1b2c3d4'] as $index => $name) {
        $path = $store->directory . '/backups/' . $name;
        mkdir($path, 0700, true);
        if ($index < 2) { Store::atomic($path . '/manifest.json', ['complete' => $index === 0, 'secret' => 'never-print-me']); }
    }
    Store::atomicText($store->directory . '/backups/notes.txt', 'not a backup');
    $result = (new BackupCatalog($store))->read();
    check($result['total'] === 3);
    check(array_column($result['backups'], 'status') === ['unreadable', 'incomplete', 'complete']);
    check(!str_contains(json_encode($result), 'never-print-me'));
    ob_start(); (new Console(false))->output($result); $text = ob_get_clean();
    check(str_contains($text, '20261003-030000-a1b2c3d4'));
    check(str_contains($text, '3 of 3 backups shown.'));
    check(!str_contains($text, 'never-print-me'));
});

test('backup catalog bounds output to the newest fifty entries', function (): void {
    $store = new Store(tempDirectory() . '/state');
    for ($index = 0; $index < 51; $index++) {
        $name = '20261007-030000-' . sprintf('%08x', $index);
        $path = $store->directory . '/backups/' . $name;
        mkdir($path, 0700, true);
        Store::atomic($path . '/manifest.json', ['complete' => true]);
    }
    $result = (new BackupCatalog($store))->read();
    check($result['total'] === 51);
    check(count($result['backups']) === 50);
    check($result['backups'][0]['name'] === '20261007-030000-00000032');
});
