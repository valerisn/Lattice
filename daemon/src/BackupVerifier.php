<?php
declare(strict_types=1);
namespace Lattice\Daemon;
use RuntimeException;

final class BackupVerifier
{
    private const FILES = ['database.dump', 'uploads.tar.gz', 'environment.env', 'compose.json'];

    public function __construct(private readonly Store $store) {}

    public function verify(string $name): array
    {
        if (!preg_match('/^[0-9]{8}-[0-9]{6}-[a-f0-9]{8}$/D', $name)) {
            throw new RuntimeException('Use the backup directory name, for example 20261007-030000-a1b2c3d4.');
        }
        $directory = PrivatePath::check($this->store->directory . '/backups/' . $name, true);
        $manifestFile = PrivatePath::check($directory . '/manifest.json');
        $text = file_get_contents($manifestFile, false, null, 0, 65537);
        if ($text === false || strlen($text) > 65536) { throw new RuntimeException('Backup manifest is unreadable or too large.'); }
        $manifest = json_decode($text, true, 16, JSON_THROW_ON_ERROR);
        if (!is_array($manifest) || ($manifest['complete'] ?? null) !== true) {
            throw new RuntimeException('Backup is incomplete. Do not use it for recovery.');
        }
        $hashes = $manifest['sha256'] ?? null;
        if (!is_array($hashes) || count($hashes) !== count(self::FILES) || array_diff(self::FILES, array_keys($hashes))) {
            throw new RuntimeException('Manifest must describe exactly the four backup files.');
        }
        foreach (self::FILES as $file) {
            if (!is_string($hashes[$file]) || !preg_match('/^[a-f0-9]{64}$/D', $hashes[$file])) {
                throw new RuntimeException('Manifest contains an invalid SHA-256 checksum.');
            }
        }
        $files = [];
        $problems = [];
        foreach (self::FILES as $file) {
            try {
                $path = PrivatePath::check($directory . '/' . $file);
                $actual = hash_file('sha256', $path);
                $files[$file] = is_string($actual) && hash_equals($hashes[$file], $actual) ? 'verified' : 'checksum mismatch';
            } catch (\Throwable) {
                $files[$file] = 'missing, unreadable, or unsafe permissions';
            }
            if ($files[$file] !== 'verified') { $problems[] = $file . ': ' . $files[$file]; }
        }
        return [
            'backup' => $name, 'verified' => !$problems, 'files' => $files,
            'message' => $problems ? implode('; ', $problems) : 'All four file checksums match. Verify restoration separately before relying on this backup.',
        ];
    }
}
