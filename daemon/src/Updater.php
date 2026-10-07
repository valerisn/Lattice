<?php
declare(strict_types=1);
namespace Lattice\Daemon;
use RuntimeException;
use Throwable;

final class Updater
{
    public function __construct(private readonly Compose $compose, private readonly Store $store, private readonly Release $release, private readonly Monitor $monitor) {}

    private function git(array $args, string $step): string
    {
        $result = $this->compose->runner->run(['git', ...$args], $this->compose->config->get('directory'), 120);
        if ($result->code !== 0) { throw new RuntimeException("$step failed. Inspect this Git checkout locally."); }
        return trim($result->stdout);
    }

    public function check(): array
    {
        $config = $this->compose->config;
        $state = $this->store->read('update');
        $state['last_check'] = time();
        $this->store->write('update', $state);
        try {
            $result = $this->release->check(Release::installed($config->get('directory')), $config->get('allow_major_updates'));
            $state['check'] = $result;
            unset($state['check_error']);
            $this->store->write('update', $state);
            return $result;
        } catch (Throwable $error) {
            $state['check_error'] = $error->getMessage();
            $this->store->write('update', $state);
            throw $error;
        }
    }

    public function waitHealthy(int $seconds = 120): void
    {
        $deadline = time() + $seconds;
        do {
            if ($this->monitor->snapshot()['healthy']) { return; }
            if (time() >= $deadline) { break; }
            sleep(2);
        } while (true);
        throw new RuntimeException('The application did not become healthy within the startup window.');
    }

    public function backup(): array
    {
        if (!$this->monitor->snapshot()['healthy']) { throw new RuntimeException('A healthy running stack is required before backup.'); }
        if ($this->store->read('update')['blocked'] ?? false) { throw new RuntimeException('Resolve the interrupted operation and run daemon resume first.'); }
        $backup = new Backup($this->compose, $this->store);
        $context = $backup->capture();
        $revision = $this->git(['rev-parse', 'HEAD'], 'Read installed revision');
        try {
            $path = $backup->create($context, $revision);
            $this->compose->must(['start', 'app'], 'Resume app after backup');
            $this->waitHealthy();
            $state = $this->store->read('update');
            $state['phase'] = 'backup-complete'; $state['blocked'] = false;
            $this->store->write('update', $state);
            return ['message' => 'Backup completed and application resumed.', 'backup' => $path];
        } catch (Throwable $error) {
            $state = $this->store->read('update');
            try {
                $this->compose->must(['start', 'app'], 'Resume app after backup failure');
                $this->waitHealthy();
                $state['blocked'] = false;
            } catch (Throwable) { $state['blocked'] = true; }
            $state['phase'] = 'backup-failed'; $state['error'] = $error->getMessage();
            $this->store->write('update', $state);
            throw $error;
        }
    }

    public function apply(?array $release = null, bool $automatic = false): array
    {
        $config = $this->compose->config;
        $state = $this->store->read('update');
        if ($state['blocked'] ?? false) { throw new RuntimeException('An interrupted update needs operator recovery. Run daemon resume after repairs.'); }
        if ($this->store->read('monitor')['paused'] ?? false) { throw new RuntimeException('Supervision is paused. Start or resume the stack first.'); }
        $release ??= $this->check();
        if ($release['status'] !== 'available') { return $release; }
        if ($automatic && ($state['failed_tag'] ?? null) === $release['tag']) {
            return ['status' => 'skipped', 'message' => 'This release previously failed; manual intervention is required.'];
        }
        $tag = $release['tag'];
        Release::version($tag);
        if (!$this->monitor->snapshot()['healthy']) { throw new RuntimeException('Update requires a healthy stack and sufficient free disk space.'); }
        $remote = $this->git(['remote', 'get-url', 'origin'], 'Check repository origin');
        if (!in_array($remote, ['https://github.com/valerisn/Lattice.git', 'https://github.com/valerisn/Lattice'], true)) {
            throw new RuntimeException('Updates require the official HTTPS Git origin.');
        }
        if ($this->git(['status', '--porcelain', '--untracked-files=normal'], 'Check working tree') !== '') {
            throw new RuntimeException('The checkout has local changes. Commit or move them before updating.');
        }
        $previous = $this->git(['rev-parse', 'HEAD'], 'Read installed revision');
        if (!preg_match('/^[a-f0-9]{40,64}$/D', $previous)) { throw new RuntimeException('Invalid installed Git revision.'); }
        $this->git(['fetch', '--no-tags', 'origin', "refs/tags/$tag:refs/tags/$tag"], 'Fetch release tag');
        $target = $this->git(['rev-parse', "refs/tags/$tag^{commit}"], 'Resolve release commit');
        $package = json_decode($this->git(['show', "$target:package.json"], 'Verify release version'), true, 32, JSON_THROW_ON_ERROR);
        if (($package['version'] ?? null) !== $release['latest']) { throw new RuntimeException('Release tag and package version disagree.'); }
        $this->git(['merge-base', '--is-ancestor', $previous, $target], 'Check upgrade ancestry');
        $backup = new Backup($this->compose, $this->store);
        $context = $backup->capture();
        Store::atomicText($this->store->path('previous-compose.json'), $context['definition_json']);
        $state = $this->store->read('update') + ['last_check' => time()];
        $state = array_merge($state, ['phase' => 'preparing', 'blocked' => true, 'previous_revision' => $previous, 'target_revision' => $target, 'target_tag' => $tag, 'started_at' => gmdate('c')]);
        $this->store->write('update', $state);
        $activationStarted = false;
        try {
            $this->git(['checkout', '--detach', $target], 'Switch to release');
            $definition = json_decode($this->compose->must(['config', '--format', 'json'], 'Validate release Compose configuration'), true, 64, JSON_THROW_ON_ERROR);
            if (!Backup::compatible($context['definition'], $definition)) { throw new RuntimeException('Release changes database or storage wiring. Upgrade manually.'); }
            $this->compose->must(['build', 'app'], 'Build release image', 1800);
            if (!$this->monitor->snapshot()['disk_ready']) { throw new RuntimeException('Insufficient disk space after building the release.'); }
            $path = $backup->create($context, $previous);
            $state = $this->store->read('update');
            $state['phase'] = 'activating';
            $this->store->write('update', $state);
            $activationStarted = true;
            $this->compose->must(['up', '-d', '--no-deps', '--force-recreate', '--wait', '--wait-timeout', '120', 'app'], 'Activate release', 180);
            $this->waitHealthy();
            $state['phase'] = 'complete'; $state['blocked'] = false; $state['completed_at'] = gmdate('c');
            unset($state['error'], $state['failed_tag']);
            $this->store->write('update', $state);
            return ['status' => 'updated', 'message' => "Lattice {$release['latest']} is healthy.", 'backup' => $path];
        } catch (Throwable $error) {
            $state = $this->store->read('update');
            $state['phase'] = 'failed'; $state['failed_tag'] = $tag; $state['error'] = $error->getMessage(); $state['blocked'] = true;
            if (!$activationStarted) {
                try {
                    $this->git(['checkout', '--detach', $previous], 'Restore previous source');
                    $this->compose->must(['start', 'app'], 'Resume previous app', 60, null, $this->store->path('previous-compose.json'));
                    $this->waitHealthy();
                    $state['blocked'] = false;
                } catch (Throwable) { /* Leave supervision blocked until an operator checks the stack. */ }
            } else {
                // A new process may have migrated the database. Never guess that old code can run against it.
                $this->compose->run(['stop', '--timeout', '30', 'app'], 90);
            }
            $this->store->write('update', $state);
            throw new RuntimeException($error->getMessage() . ($state['blocked'] ? ' Automatic recovery is blocked; inspect daemon status and the backup manifest.' : ' Previous application resumed; this release will not be retried automatically.'));
        }
    }

    public function automatic(int $now): ?array
    {
        $config = $this->compose->config;
        $state = $this->store->read('update');
        if (!$config->get('auto_update') || !$config->inUpdateWindow($now) || ($state['blocked'] ?? false)
            || ($this->store->read('monitor')['paused'] ?? false)
            || $now - ($state['last_check'] ?? 0) < $config->get('update_interval_seconds')) { return null; }
        return $this->apply($this->check(), true);
    }
}

