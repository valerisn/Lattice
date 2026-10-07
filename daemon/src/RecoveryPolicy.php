<?php
declare(strict_types=1);
namespace Lattice\Daemon;

final class RecoveryPolicy
{
    public static function inspect(array $status, array $state, Config $config, int $now): array
    {
        $attempts = count(array_filter($state['recoveries'] ?? [], static fn ($time) => $time > $now - 3600));
        $failures = $state['failures'] ?? 0;
        $cooldown = max(0, ($state['last_recovery'] ?? 0) + $config->get('recovery_cooldown_seconds') - $now);
        $reason = match (true) {
            $status['healthy'] => 'Stack is healthy.',
            $status['paused'] => 'Supervision is paused by the operator.',
            $status['update_blocked'] => 'Recovery is blocked after an update. Repair the stack before using resume.',
            !$config->get('auto_recover') => 'Automatic recovery is disabled.',
            !$status['database_ready'] => 'Waiting for a healthy database container.',
            !$status['disk_ready'] => 'Waiting for sufficient free disk space.',
            $failures < $config->get('failure_threshold') => 'Waiting for more failed health checks.',
            $attempts >= 3 => 'The limit of three recovery attempts per hour has been reached.',
            $cooldown > 0 => 'Waiting for the recovery cooldown.',
            default => 'An app restart is eligible on the next supervision cycle.',
        };
        return [
            'eligible' => !$status['healthy'] && !$status['paused'] && !$status['update_blocked']
                && $config->get('auto_recover') && $status['database_ready'] && $status['disk_ready']
                && $failures >= $config->get('failure_threshold') && $attempts < 3 && $cooldown === 0,
            'reason' => $reason, 'failed_checks' => $failures, 'failure_threshold' => $config->get('failure_threshold'),
            'attempts_last_hour' => $attempts, 'attempt_limit' => 3, 'cooldown_remaining_seconds' => $cooldown,
        ];
    }
}
