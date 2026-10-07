<?php
declare(strict_types=1);
namespace Lattice\Daemon;

final class Console
{
    public function __construct(private readonly bool $json) {}

    public function output(array $data): void
    {
        if ($this->json) { echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n"; return; }
        $color = function_exists('stream_isatty') && stream_isatty(STDOUT) && getenv('NO_COLOR') === false;
        echo ($color ? "\033[1;32m" : '') . "daemon · Lattice supervisor" . ($color ? "\033[0m" : '') . "\n\n";
        if (array_key_exists('healthy', $data)) {
            echo '  Health         ' . ($data['healthy'] ? 'healthy' : 'needs attention') . "\n";
            echo '  Supervision    ' . (!empty($data['paused']) ? 'paused by operator' : (!empty($data['update_blocked']) ? 'blocked after update' : 'active')) . "\n";
            echo '  Auto-update    ' . (!empty($data['auto_update']) ? 'enabled' : 'disabled') . "\n";
            echo '  Free space     ' . ($data['deployment_free_mb'] ?? '?') . ' MiB deployment / ' . ($data['state_free_mb'] ?? '?') . " MiB state\n";
            foreach ($data['problems'] as $problem) { echo "  ! $problem\n"; }
        } else {
            foreach ($data as $key => $value) {
                if (is_scalar($value)) { echo '  ' . str_pad(ucfirst(str_replace('_', ' ', $key)), 17) . (is_bool($value) ? ($value ? 'yes' : 'no') : $value) . "\n"; }
            }
        }
        echo "\n";
    }

    public static function log(string $event, array $data = []): void
    {
        echo json_encode(['time' => gmdate('c'), 'event' => $event] + $data, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
    }
}

