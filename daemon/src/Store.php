<?php
declare(strict_types=1);
namespace Lattice\Daemon;

use RuntimeException;

final class Store
{
    public function __construct(public readonly string $directory)
    {
        if (!is_dir($directory) && !mkdir($directory, 0700, true)) {
            throw new RuntimeException('Cannot create daemon state directory.');
        }
    }

    public function read(string $name): array
    {
        $path = $this->path($name . '.json');
        if (!is_file($path)) { return []; }
        $data = json_decode((string) file_get_contents($path), true, 64, JSON_THROW_ON_ERROR);
        if (!is_array($data)) { throw new RuntimeException('Invalid daemon state. Inspect it before restarting.'); }
        return $data;
    }

    public function write(string $name, array $data): void
    {
        self::atomic($this->path($name . '.json'), $data);
    }

    public static function atomic(string $path, array $data): void
    {
        self::atomicText($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n");
    }

    public static function atomicText(string $path, string $encoded): void
    {
        $temp = $path . '.' . bin2hex(random_bytes(6)) . '.tmp';
        $handle = fopen($temp, 'x');
        if (!$handle) { throw new RuntimeException('Cannot write state file.'); }
        try {
            chmod($temp, 0600);
            if (fwrite($handle, $encoded) !== strlen($encoded)) { throw new RuntimeException('Incomplete state write.'); }
            fflush($handle);
            if (function_exists('fsync')) { fsync($handle); }
        } finally { fclose($handle); }
        if (!rename($temp, $path)) {
            @unlink($temp);
            throw new RuntimeException('Cannot replace state file.');
        }
    }

    public function path(string $name): string
    {
        if (!preg_match('/^[a-zA-Z0-9_.-]+$/D', $name)) { throw new RuntimeException('Invalid state filename.'); }
        return $this->directory . '/' . $name;
    }

    public function locked(string $name, callable $operation): mixed
    {
        $handle = fopen($this->path($name . '.lock'), 'c');
        if (!$handle) { throw new RuntimeException('Cannot open daemon lock.'); }
        chmod($this->path($name . '.lock'), 0600);
        try {
            if (!flock($handle, LOCK_EX | LOCK_NB)) { throw new RuntimeException("Another daemon $name operation is running."); }
            return $operation();
        } finally { flock($handle, LOCK_UN); fclose($handle); }
    }
}

