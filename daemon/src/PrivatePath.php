<?php
declare(strict_types=1);
namespace Lattice\Daemon;
use RuntimeException;

final class PrivatePath
{
    public static function check(string $path, bool $directory = false): string
    {
        if (PHP_OS_FAMILY !== 'Linux') { return $path; }
        if (!function_exists('posix_geteuid')) { throw new RuntimeException('PHP posix is required for daemon ownership checks.'); }
        clearstatcache(true, $path);
        $stat = @lstat($path);
        $expectedType = $directory ? 0040000 : 0100000;
        if (!$stat || ($stat['mode'] & 0170000) !== $expectedType) {
            throw new RuntimeException('Daemon private paths must be regular files or directories, not symlinks.');
        }
        $uid = posix_geteuid();
        if ($stat['uid'] !== $uid || ($stat['mode'] & 0077) !== 0) {
            throw new RuntimeException('Daemon private paths must belong to the service user and use mode 0700 for directories or 0600 for files.');
        }
        // Check the lexical parents too: an attacker must not be able to swap a
        // symlink above an otherwise-private directory between operations.
        self::parents(dirname($path), $uid);
        $resolved = realpath($path);
        if ($resolved === false) { throw new RuntimeException('Cannot resolve daemon private path.'); }
        self::parents(dirname($resolved), $uid);
        return $resolved;
    }

    private static function parents(string $path, int $uid): void
    {
        while (true) {
            clearstatcache(true, $path);
            $stat = @lstat($path);
            if (!$stat || !in_array($stat['uid'], [0, $uid], true)) {
                throw new RuntimeException('Daemon private paths require trusted parent directories.');
            }
            $symlink = ($stat['mode'] & 0170000) === 0120000;
            // Root-owned sticky /tmp is safe for an exclusively-owned child.
            if (!$symlink && ($stat['mode'] & 0022) !== 0 && ($stat['mode'] & 01000) === 0) {
                throw new RuntimeException('Daemon private paths cannot have writable shared parents without the sticky bit.');
            }
            $parent = dirname($path);
            if ($parent === $path) { break; }
            $path = $parent;
        }
    }
}
