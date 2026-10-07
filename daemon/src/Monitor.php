<?php
declare(strict_types=1);
namespace Lattice\Daemon;
use Throwable;

final class Monitor
{
    public function __construct(private readonly Compose $compose, private readonly Transport $http, private readonly Store $store) {}

    public function snapshot(): array
    {
        $config = $this->compose->config;
        $services = [];
        $problems = [];
        try {
            foreach ($this->compose->containers() as $row) {
                $name = $row['Service'] ?? '';
                if (in_array($name, ['app', 'db'], true)) {
                    $services[$name][] = ['state' => $row['State'] ?? 'unknown', 'health' => $row['Health'] ?? ''];
                }
            }
        } catch (Throwable $error) { $problems[] = $error->getMessage(); }
        $serviceHealthy = [];
        foreach (['app', 'db'] as $name) {
            $rows = $services[$name] ?? [];
            $serviceHealthy[$name] = count($rows) === 1 && $rows[0]['state'] === 'running' && in_array($rows[0]['health'], ['', 'healthy'], true);
            if (!$serviceHealthy[$name]) { $problems[] = "$name is missing, stopped, starting, unhealthy, or scaled beyond one container."; }
        }
        $endpoint = false;
        try {
            $response = $this->http->get($config->get('health_url'));
            $body = json_decode($response['body'], true);
            $endpoint = $response['status'] === 200 && is_array($body) && ($body['status'] ?? null) === 'ok';
            if (!$endpoint) { $problems[] = 'Application health endpoint is not ready.'; }
        } catch (Throwable) { $problems[] = 'Application health endpoint is unreachable.'; }
        $free = @disk_free_space($config->get('directory'));
        $freeMb = $free === false ? null : (int) floor($free / 1048576);
        $stateFree = @disk_free_space($config->get('state_dir'));
        $stateFreeMb = $stateFree === false ? null : (int) floor($stateFree / 1048576);
        $diskOk = $freeMb !== null && $stateFreeMb !== null && min($freeMb, $stateFreeMb) >= $config->get('minimum_free_mb');
        if (!$diskOk) { $problems[] = 'Low or unreadable disk space on the deployment or daemon state filesystem.'; }
        $state = $this->store->read('monitor');
        $update = $this->store->read('update');
        return [
            'checked_at' => gmdate('c'), 'healthy' => $serviceHealthy['app'] && $serviceHealthy['db'] && $endpoint && $diskOk,
            'services' => $services, 'database_ready' => $serviceHealthy['db'], 'http_ready' => $endpoint,
            'disk_ready' => $diskOk, 'deployment_free_mb' => $freeMb, 'state_free_mb' => $stateFreeMb,
            'paused' => (bool) ($state['paused'] ?? false), 'update_blocked' => (bool) ($update['blocked'] ?? false),
            'auto_update' => $config->get('auto_update'), 'auto_recover' => $config->get('auto_recover'),
            'problems' => $problems,
        ];
    }

    // The caller holds the action lock while inspecting and recovering.
    public function tick(int $now): array
    {
        $status = $this->snapshot();
        $state = $this->store->read('monitor');
        $state['failures'] = $status['healthy'] ? 0 : ($state['failures'] ?? 0) + 1;
        $state['checked_at'] = $status['checked_at'];
        $state['recoveries'] = array_values(array_filter($state['recoveries'] ?? [], static fn ($time) => $time > $now - 3600));
        $config = $this->compose->config;
        $status['recovery'] = 'none';
        if (!$status['healthy'] && !$status['paused'] && !$status['update_blocked'] && $config->get('auto_recover')
            && $status['database_ready'] && $status['disk_ready']
            && $state['failures'] >= $config->get('failure_threshold')
            && $now - ($state['last_recovery'] ?? 0) >= $config->get('recovery_cooldown_seconds')
            && count($state['recoveries']) < 3) {
            $state['last_recovery'] = $now;
            $state['recoveries'][] = $now;
            $this->store->write('monitor', $state);
            try {
                $this->compose->must(['restart', '--timeout', '30', 'app'], 'Application recovery', 90);
                $status['recovery'] = 'app restart requested';
            } catch (Throwable $error) { $status['recovery'] = $error->getMessage(); }
        }
        $this->store->write('monitor', $state);
        $this->store->write('status', $status);
        return $status;
    }
}

