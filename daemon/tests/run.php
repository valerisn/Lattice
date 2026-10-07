<?php
declare(strict_types=1);
require dirname(__DIR__) . '/autoload.php';
error_reporting(E_ALL);
set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) { return false; }
    throw new ErrorException($message, 0, $severity, $file, $line);
});
$tests = [];
function test(string $name, callable $fn): void { global $tests; $tests[$name] = $fn; }
function check(bool $condition, string $message = 'Assertion failed'): void { if (!$condition) { throw new RuntimeException($message); } }
function rejects(callable $fn, string $message): void {
    try { $fn(); } catch (Throwable $error) { check(str_contains($error->getMessage(), $message), $error->getMessage()); return; }
    throw new RuntimeException('Expected failure: ' . $message);
}
function tempDirectory(): string {
    $dir = sys_get_temp_dir() . '/lattice-daemon-test-' . bin2hex(random_bytes(8));
    mkdir($dir, 0700);
    register_shutdown_function(static function () use ($dir): void {
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $file) { $file->isDir() && !$file->isLink() ? rmdir($file->getPathname()) : unlink($file->getPathname()); }
        rmdir($dir);
    });
    return str_replace('\\', '/', $dir);
}
foreach (glob(__DIR__ . '/*Test.php') as $file) { require $file; }
$failed = 0;
foreach ($tests as $name => $fn) {
    try { $fn(); echo "PASS $name\n"; } catch (Throwable $error) { $failed++; fwrite(STDERR, "FAIL $name: {$error->getMessage()}\n"); }
}
echo count($tests) . ' tests, ' . $failed . " failures\n";
exit($failed ? 1 : 0);

