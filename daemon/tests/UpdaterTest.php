<?php
declare(strict_types=1);
use Lattice\Daemon\{Backup, Config, Store, Runner, CommandResult, Compose, Monitor, Release, Updater};

final class UpdateRunner implements Runner
{
    public array $calls = [];
    public string $failure = '';
    public string $remote = 'https://github.com/valerisn/Lattice.git';
    public string $dirty = '';
    public string $active = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    public array $definition = ['services' => ['app' => ['volumes' => [['source' => 'uploads', 'target' => '/app/uploads']]], 'db' => ['image' => 'postgres:17']]];
    public function run(array $arguments, string $directory, int $timeout = 30, ?string $outputFile = null): CommandResult
    {
        $this->calls[] = $arguments;
        if ($arguments[0] === 'git') {
            return match ($arguments[1]) {
                'remote' => new CommandResult(0, $this->remote),
                'status' => new CommandResult(0, $this->dirty),
                'rev-parse' => new CommandResult(0, $arguments[2] === 'HEAD' ? $this->active : str_repeat('b', 40)),
                'show' => new CommandResult(0, '{"version":"1.1.0"}'),
                'checkout' => $this->checkout($arguments[3]),
                default => new CommandResult(0),
            };
        }
        if ($arguments[1] === 'inspect') { return new CommandResult(0, 'sha256:' . str_repeat('c', 64)); }
        if ($arguments[1] === 'run') {
            if ($this->failure === 'archive') { return new CommandResult(1); }
            file_put_contents($outputFile, "\x1f\x8btest-archive");
            return new CommandResult(0);
        }
        $args = array_slice($arguments, 8);
        if ($args[0] === 'config') { return new CommandResult(0, json_encode($this->definition, JSON_THROW_ON_ERROR)); }
        if ($args[0] === 'ps') {
            return new CommandResult(0, in_array('--quiet', $args, true) ? str_repeat('d', 64) :
                '[{"Service":"app","State":"running","Health":"healthy"},{"Service":"db","State":"running","Health":"healthy"}]');
        }
        if ($args[0] === $this->failure) { return new CommandResult(1); }
        if ($args[0] === 'exec' && $outputFile) { file_put_contents($outputFile, 'PGDMPtest-database'); }
        return new CommandResult(0);
    }
    private function checkout(string $revision): CommandResult { $this->active = $revision; return new CommandResult(0); }
}
function updateFixture(bool $enabled = false): array {
    $dir = tempDirectory();
    mkdir($dir . '/app');
    file_put_contents($dir . '/app/package.json', '{"version":"1.0.0"}');
    file_put_contents($dir . '/app/.env', 'DO_NOT_LOG=secret');
    $config = new Config(['directory' => $dir . '/app', 'state_dir' => $dir . '/state', 'minimum_free_mb' => 100,
        'auto_update' => $enabled, 'update_window_utc' => '00-00']);
    $store = new Store($config->get('state_dir'));
    $runner = new UpdateRunner();
    $compose = new Compose($config, $runner);
    $health = new FakeHttp();
    $releaseHttp = new FakeHttp();
    $releaseHttp->response['body'] = '{"tag_name":"v1.1.0","draft":false,"prerelease":false}';
    $updater = new Updater($compose, $store, new Release($releaseHttp), new Monitor($compose, $health, $store));
    return [$updater, $runner, $store, $releaseHttp];
}
test('updater completes backups before activating a validated release', function (): void {
    [$updater, $runner, $store] = updateFixture();
    $result = $updater->apply();
    check($result['status'] === 'updated');
    $manifest = json_decode(file_get_contents($result['backup'] . '/manifest.json'), true, 32, JSON_THROW_ON_ERROR);
    check($manifest['complete']);
    check($manifest['sha256']['database.dump'] === hash_file('sha256', $result['backup'] . '/database.dump'));
    $archive = $activation = null;
    foreach ($runner->calls as $index => $call) {
        if (($call[1] ?? '') === 'run') { $archive = $index; }
        if (in_array('--force-recreate', $call, true)) { $activation = $index; }
    }
    check($archive !== null && $activation > $archive);
    check($store->read('update')['blocked'] === false);
    check($runner->active === str_repeat('b', 40));
});
test('build and backup failures restore the old source without activating new code', function (): void {
    foreach (['build', 'archive'] as $failure) {
        [$updater, $runner, $store] = updateFixture();
        $runner->failure = $failure;
        rejects(fn () => $updater->apply(), 'Previous application resumed');
        check($runner->active === str_repeat('a', 40));
        check(!$store->read('update')['blocked']);
        check(!array_filter($runner->calls, fn ($call) => in_array('--force-recreate', $call, true)));
        check($store->read('update')['failed_tag'] === 'v1.1.0');
    }
});
test('activation failure blocks supervision and never downgrades a potentially migrated database', function (): void {
    [$updater, $runner, $store] = updateFixture();
    $runner->failure = 'up';
    rejects(fn () => $updater->apply(), 'Automatic recovery is blocked');
    check($store->read('update')['blocked']);
    check($runner->active === str_repeat('b', 40));
    rejects(fn () => $updater->apply(), 'operator recovery');
});
test('updates reject dirty and unofficial installations before fetching or stopping anything', function (): void {
    [$updater, $runner] = updateFixture();
    $runner->dirty = ' M compose.yaml';
    rejects(fn () => $updater->apply(), 'local changes');
    check(!array_filter($runner->calls, fn ($call) => in_array('fetch', $call, true)));
    $runner->dirty = ''; $runner->remote = 'https://example.test/fork.git';
    rejects(fn () => $updater->apply(), 'official HTTPS');
});
test('automatic updates are opt-in, rate-limited, and do not retry a failed release', function (): void {
    [$updater, $runner, $store] = updateFixture();
    check($updater->automatic(time()) === null);
    check($runner->calls === []);
    [$updater, $runner, $store] = updateFixture(true);
    $store->write('monitor', ['paused' => true]);
    check($updater->automatic(time()) === null);
    check($runner->calls === []);
    check($store->read('update') === []);
    $store->write('monitor', ['paused' => false]);
    $store->write('update', ['last_check' => time()]);
    check($updater->automatic(time()) === null);
    $store->write('update', ['last_check' => 0, 'failed_tag' => 'v1.1.0']);
    check($updater->automatic(time())['status'] === 'skipped');
    check(!array_filter($runner->calls, fn ($call) => in_array('fetch', $call, true)));
});
test('database and upload wiring changes require a manual upgrade', function (): void {
    $before = ['services' => ['app' => ['volumes' => ['uploads:/app/uploads']], 'db' => ['image' => 'postgres:17']]];
    check(Backup::compatible($before, $before));
    $after = $before; $after['services']['db']['image'] = 'postgres:18';
    check(!Backup::compatible($before, $after));
    $after = $before; $after['services']['app']['volumes'] = ['other:/app/uploads'];
    check(!Backup::compatible($before, $after));
});

