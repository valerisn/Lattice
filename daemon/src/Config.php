<?php
declare(strict_types=1);
namespace Lattice\Daemon;

use InvalidArgumentException;
use RuntimeException;

final class Config
{
    public readonly array $data;

    public function __construct(array $data)
    {
        $defaults = self::defaults();
        $unknown = array_diff(array_keys($data), array_keys($defaults));
        if ($unknown) {
            throw new InvalidArgumentException('Unknown configuration fields: ' . implode(', ', $unknown));
        }
        $data += $defaults;
        foreach (['directory', 'state_dir'] as $field) {
            if (!is_string($data[$field]) || !preg_match('~^(?:/|[A-Za-z]:[/\\\\])~', $data[$field]) || str_contains($data[$field], "\0")) {
                throw new InvalidArgumentException("$field must be an absolute path.");
            }
            $data[$field] = rtrim(str_replace('\\', '/', $data[$field]), '/');
            if (preg_match('~(?:^|/)\.{1,2}(?:/|$)~', $data[$field])) {
                throw new InvalidArgumentException("$field cannot contain dot path segments.");
            }
            if ($data[$field] === '' || preg_match('/^[A-Za-z]:$/', $data[$field])) {
                throw new InvalidArgumentException("$field cannot be a filesystem root.");
            }
        }
        $state = PHP_OS_FAMILY === 'Windows' ? strtolower($data['state_dir']) : $data['state_dir'];
        $checkout = PHP_OS_FAMILY === 'Windows' ? strtolower($data['directory']) : $data['directory'];
        if ($state === $checkout || str_starts_with($state, $checkout . '/')) {
            throw new InvalidArgumentException('state_dir must be outside the application checkout.');
        }
        foreach (['project_name', 'database_name', 'database_user'] as $field) {
            if (!is_string($data[$field]) || !preg_match('/^[a-z0-9][a-z0-9_-]{0,62}$/D', $data[$field])) {
                throw new InvalidArgumentException("$field has an invalid value.");
            }
        }
        foreach (['auto_update', 'allow_major_updates', 'auto_recover'] as $field) {
            if (!is_bool($data[$field])) {
                throw new InvalidArgumentException("$field must be true or false.");
            }
        }
        foreach (['poll_seconds' => [5, 3600], 'failure_threshold' => [1, 20], 'recovery_cooldown_seconds' => [60, 86400],
                  'update_interval_seconds' => [3600, 604800], 'minimum_free_mb' => [100, 1048576]] as $field => [$min, $max]) {
            if (!is_int($data[$field]) || $data[$field] < $min || $data[$field] > $max) {
                throw new InvalidArgumentException("$field must be an integer from $min to $max.");
            }
        }
        if (!is_string($data['health_url'])) {
            throw new InvalidArgumentException('health_url must be a URL.');
        }
        $url = parse_url($data['health_url']);
        if (!$url || !in_array($url['scheme'] ?? '', ['http', 'https'], true) || !isset($url['host'])
            || isset($url['user']) || isset($url['pass']) || isset($url['fragment'])) {
            throw new InvalidArgumentException('health_url must be an HTTP(S) URL without credentials or a fragment.');
        }
        if (!is_string($data['update_window_utc']) || !preg_match('/^(?:[01]\d|2[0-3])-(?:[01]\d|2[0-3])$/D', $data['update_window_utc'])) {
            throw new InvalidArgumentException('update_window_utc must be an hour range such as 03-05.');
        }
        $this->data = $data;
    }

    public static function defaults(): array
    {
        return [
            'directory' => PHP_OS_FAMILY === 'Windows' ? self::windowsRoot() . '/application' : '/opt/lattice',
            'state_dir' => PHP_OS_FAMILY === 'Windows' ? self::windowsRoot() . '/state' : '/var/lib/lattice-daemon', 'project_name' => 'lattice',
            'health_url' => 'http://127.0.0.1:3000/api/health',
            'poll_seconds' => 30, 'failure_threshold' => 3, 'auto_recover' => true, 'recovery_cooldown_seconds' => 900,
            'auto_update' => false, 'allow_major_updates' => false, 'update_interval_seconds' => 21600,
            'update_window_utc' => '03-05', 'minimum_free_mb' => 2048,
            'database_name' => 'lattice', 'database_user' => 'lattice',
        ];
    }

    public static function windowsRoot(): string
    {
        return rtrim(str_replace('\\', '/', getenv('ProgramData') ?: 'C:/ProgramData'), '/') . '/LatticeDaemon';
    }

    public static function defaultFile(): string
    {
        return PHP_OS_FAMILY === 'Windows' ? self::windowsRoot() . '/daemon.json' : '/etc/lattice/daemon.json';
    }

    public static function load(string $file): self
    {
        $file = PrivatePath::check($file);
        if (!is_file($file) || filesize($file) > 65536) {
            throw new RuntimeException('Configuration missing or too large. Run daemon init first.');
        }
        $data = json_decode((string) file_get_contents($file), true, 32, JSON_THROW_ON_ERROR);
        if (!is_array($data) || array_is_list($data)) {
            throw new InvalidArgumentException('Configuration must be a JSON object.');
        }
        return new self($data);
    }

    public function get(string $key): mixed { return $this->data[$key]; }

    public function inUpdateWindow(int $timestamp): bool
    {
        [$start, $end] = array_map('intval', explode('-', $this->get('update_window_utc')));
        $hour = (int) gmdate('G', $timestamp);
        return $start === $end || ($start < $end ? $hour >= $start && $hour < $end : $hour >= $start || $hour < $end);
    }
}

