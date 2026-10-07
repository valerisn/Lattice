<?php
declare(strict_types=1);
namespace Lattice\Daemon;
use RuntimeException;

final class BackupCatalog
{
    public function __construct(private readonly Store $store) {}

    public function read(): array
    {
        $directory = $this->store->directory . '/backups';
        if (!file_exists($directory) && !is_link($directory)) {
            return ['backups' => [], 'total' => 0, 'message' => 'No backups recorded.'];
        }
        $directory = PrivatePath::check($directory, true);
        $entries = @scandir($directory);
        if ($entries === false) { throw new RuntimeException('Cannot read the backup directory.'); }
        $names = array_values(array_filter($entries, static fn(string $name): bool => preg_match('/^[0-9]{8}-[0-9]{6}-[a-f0-9]{8}$/D', $name) === 1));
        rsort($names, SORT_STRING);
        $backups = [];
        foreach (array_slice($names, 0, 50) as $name) {
            try {
                $path = PrivatePath::check($directory . '/' . $name, true);
                $manifest = PrivatePath::check($path . '/manifest.json');
                $text = file_get_contents($manifest, false, null, 0, 65537);
                if ($text === false || strlen($text) > 65536) { throw new RuntimeException('Invalid manifest size.'); }
                $data = json_decode($text, true, 16, JSON_THROW_ON_ERROR);
                if (!is_array($data) || !is_bool($data['complete'] ?? null)) { throw new RuntimeException('Invalid manifest.'); }
                $status = $data['complete'] ? 'complete' : 'incomplete';
            } catch (\Throwable) {
                $status = 'unreadable';
            }
            $backups[] = ['name' => $name, 'status' => $status];
        }
        return [
            'backups' => $backups, 'total' => count($names),
            'message' => 'Showing the newest 50 at most. Complete describes the manifest; use verify-backup to check file integrity.',
        ];
    }
}
