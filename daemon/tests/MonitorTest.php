<?php
declare(strict_types=1);
use Lattice\Daemon\{Config, Store, Runner, CommandResult, Compose, Monitor, Transport, Release};

final class FakeRunner implements Runner
{
    public array $calls = [];
    public array $rows = [['Service' => 'app', 'State' => 'running', 'Health' => 'healthy'], ['Service' => 'db', 'State' => 'running', 'Health' => 'healthy']];
    public function run(array $arguments, string $directory, int $timeout = 30, ?string $outputFile = null): CommandResult
    {
        $this->calls[] = $arguments;
        return new CommandResult(0, in_array('ps', $arguments, true) ? json_encode($this->rows, JSON_THROW_ON_ERROR) : '');
    }
}
final class FakeHttp implements Transport
{
    public array $response = ['status' => 200, 'body' => '{"status":"ok"}'];
    public function get(string $url): array { return $this->response; }
}
function monitorFixture(): array {
    $dir = tempDirectory();
    mkdir($dir . '/app');
    $config = new Config(['directory' => $dir . '/app', 'state_dir' => $dir . '/state', 'minimum_free_mb' => 100, 'recovery_cooldown_seconds' => 60]);
    $store = new Store($config->get('state_dir'));
    $runner = new FakeRunner();
    $http = new FakeHttp();
    return [new Monitor(new Compose($config, $runner), $http, $store), $runner, $http, $store];
}
test('monitor requires app, database, endpoint, and disk health', function (): void {
    [$monitor, $runner, $http] = monitorFixture();
    check($monitor->snapshot()['healthy']);
    $http->response['body'] = '{"status":"unavailable"}';
    check(!$monitor->snapshot()['healthy']);
    $http->response['body'] = '{"status":"ok"}';
    $runner->rows[1]['Health'] = 'unhealthy';
    check(!$monitor->snapshot()['healthy']);
});
test('recovery waits for failures, honors cooldown, and stops after three attempts per hour', function (): void {
    [$monitor, $runner, $http, $store] = monitorFixture();
    $http->response['status'] = 503;
    check($monitor->tick(10000)['recovery'] === 'none');
    check($monitor->tick(10030)['recovery'] === 'none');
    check($monitor->tick(10060)['recovery'] === 'app restart requested');
    check($monitor->tick(10061)['recovery'] === 'none');
    check($monitor->tick(10120)['recovery'] === 'app restart requested');
    check($monitor->tick(10180)['recovery'] === 'app restart requested');
    check($monitor->tick(10240)['recovery'] === 'none');
    check(count($store->read('monitor')['recoveries']) === 3);
});
test('operator stop and incomplete updates inhibit automated recovery', function (): void {
    [$monitor, $runner, $http, $store] = monitorFixture();
    $http->response['status'] = 503;
    $store->write('monitor', ['paused' => true, 'failures' => 10]);
    check($monitor->tick(10000)['recovery'] === 'none');
    $store->write('monitor', ['paused' => false, 'failures' => 10]);
    $store->write('update', ['blocked' => true]);
    check($monitor->tick(10030)['recovery'] === 'none');
});
test('release checks validate stable tags and major-version policy', function (): void {
    $http = new FakeHttp();
    $http->response['body'] = '{"tag_name":"v1.2.0","draft":false,"prerelease":false}';
    $release = new Release($http);
    check($release->check('1.1.0', false)['status'] === 'available');
    check($release->check('0.1.0', false)['status'] === 'major-blocked');
    check($release->check('0.1.0', true)['status'] === 'available');
    check($release->check('1.2.0', false)['status'] === 'current');
    check($release->check('1.3.0', false)['status'] === 'ahead');
    rejects(fn () => Release::version('v1.2.0;echo bad'), 'stable release');
    $http->response = ['status' => 429, 'body' => '{}'];
    rejects(fn () => $release->check('1.0.0', false), 'HTTP 429');
    $http->response = ['status' => 404, 'body' => '{}'];
    check($release->check('1.0.0', false)['status'] === 'unreleased');
});

