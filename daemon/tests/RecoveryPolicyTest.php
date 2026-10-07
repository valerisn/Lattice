<?php
declare(strict_types=1);
use Lattice\Daemon\{Config, Console, RecoveryPolicy};

function recoveryStatus(array $overrides = []): array {
    return $overrides + ['healthy' => false, 'paused' => false, 'update_blocked' => false, 'database_ready' => true, 'disk_ready' => true, 'problems' => []];
}

test('recovery policy describes each safety gate without allowing a restart', function (): void {
    $config = new Config([]);
    foreach ([
        ['healthy', true, 'healthy'], ['paused', true, 'paused'], ['update_blocked', true, 'blocked'],
        ['database_ready', false, 'database'], ['disk_ready', false, 'disk space'],
    ] as [$key, $value, $reason]) {
        $result = RecoveryPolicy::inspect(recoveryStatus([$key => $value]), ['failures' => 10], $config, 10000);
        check(!$result['eligible']);
        check(str_contains($result['reason'], $reason));
    }
    $disabled = RecoveryPolicy::inspect(recoveryStatus(), ['failures' => 10], new Config(['auto_recover' => false]), 10000);
    check(!$disabled['eligible'] && str_contains($disabled['reason'], 'disabled'));
});

test('recovery policy preserves threshold, cooldown, and rolling-hour boundaries', function (): void {
    $config = new Config(['recovery_cooldown_seconds' => 60]);
    $inspect = static fn (array $state, int $now = 10000): array => RecoveryPolicy::inspect(recoveryStatus(), $state, $config, $now);
    check(!$inspect(['failures' => 2])['eligible']);
    check($inspect(['failures' => 3])['eligible']);
    $state = ['failures' => 3, 'last_recovery' => 10000, 'recoveries' => [10000]];
    $waiting = $inspect($state, 10059);
    check(!$waiting['eligible'] && $waiting['cooldown_remaining_seconds'] === 1);
    check($inspect($state, 10060)['eligible']);
    $limited = $inspect(['failures' => 3, 'recoveries' => [6401, 6500, 6600]]);
    check(!$limited['eligible'] && $limited['attempts_last_hour'] === 3);
    check(str_contains($limited['reason'], 'three recovery attempts'));
    $expired = $inspect(['failures' => 3, 'recoveries' => [6400, 6500, 6600]]);
    check($expired['eligible'] && $expired['attempts_last_hour'] === 2);
});

test('console presents recovery explanation and keeps structured JSON fields', function (): void {
    $status = recoveryStatus();
    $status['recovery_policy'] = RecoveryPolicy::inspect($status, ['failures' => 3, 'last_recovery' => 9990, 'recoveries' => [9990]], new Config(['recovery_cooldown_seconds' => 60]), 10000);
    ob_start();
    try { (new Console(false))->output($status); $text = ob_get_contents(); } finally { ob_end_clean(); }
    check(str_contains($text, 'Waiting for the recovery cooldown.'));
    check(str_contains($text, '50 seconds remaining'));
    check(str_contains($text, 'Restarts/hour  1/3'));
    ob_start();
    try { (new Console(true))->output($status); $json = ob_get_contents(); } finally { ob_end_clean(); }
    check(json_decode($json, true, 16, JSON_THROW_ON_ERROR)['recovery_policy'] === $status['recovery_policy']);
});
