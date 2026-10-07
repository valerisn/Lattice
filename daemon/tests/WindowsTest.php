<?php
declare(strict_types=1);
use Lattice\Daemon\{Config, ProcessRunner};

if (PHP_OS_FAMILY === 'Windows') {
    test('Windows service commands use pinned executable paths', function (): void {
        $previous = getenv('LATTICE_DAEMON_GIT');
        try {
            putenv('LATTICE_DAEMON_GIT=' . PHP_BINARY);
            $result = (new ProcessRunner())->run(['git', '-r', 'echo "pinned";'], __DIR__);
            check($result->code === 0 && $result->stdout === 'pinned');
            putenv('LATTICE_DAEMON_GIT=relative.exe');
            rejects(fn () => (new ProcessRunner())->run(['git', '--version'], __DIR__), 'executable is unavailable');
        } finally { putenv($previous === false ? 'LATTICE_DAEMON_GIT' : 'LATTICE_DAEMON_GIT=' . $previous); }
    });
    test('Windows paths compare case-insensitively and reject traversal', function (): void {
        rejects(fn () => new Config(['directory' => 'C:/Lattice', 'state_dir' => 'c:/lattice/state']), 'outside');
        rejects(fn () => new Config(['directory' => 'C:/Lattice', 'state_dir' => 'C:/private/../Lattice/state']), 'dot path');
        rejects(fn () => new Config(['directory' => 'C:/Lattice.', 'state_dir' => 'C:/Lattice/state']), 'local drive path');
        rejects(fn () => new Config(['directory' => 'C:/Lattice//app']), 'local drive path');
        rejects(fn () => new Config(['state_dir' => '/state']), 'local drive path');
        check(str_contains(Config::defaultFile(), 'LatticeDaemon/daemon.json'));
        check(!Config::defaults()['auto_update']);
    });
    test('Windows watch honors a service stop token before issuing any operations', function (): void {
        $root = tempDirectory();
        mkdir($root . '/app');
        $runner = new ProcessRunner();
        $bin = dirname(__DIR__) . '/bin/daemon';
        $config = $root . '/daemon.json';
        $initialized = $runner->run([PHP_BINARY, $bin, 'init', '--config', $config, '--directory', $root . '/app', '--state-dir', $root . '/state'], __DIR__);
        check($initialized->code === 0, $initialized->stderr);
        $token = bin2hex(random_bytes(16));
        touch($root . '/state/stop-' . $token);
        $result = $runner->run([PHP_BINARY, $bin, 'watch', '--config', $config, '--stop-token', $token], __DIR__, 10);
        check($result->code === 0, $result->stderr);
        check(str_contains($result->stdout, 'stopped'));
        check(!file_exists($root . '/state/monitor.json'));
        check($runner->run([PHP_BINARY, $bin, 'watch', '--config', $config, '--stop-token', '../escape'], __DIR__)->code === 1);
        check($runner->run([PHP_BINARY, $bin, 'status', '--config', $config, '--stop-token', $token], __DIR__)->code === 1);
    });
}
