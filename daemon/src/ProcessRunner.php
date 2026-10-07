<?php
declare(strict_types=1);
namespace Lattice\Daemon;
use RuntimeException;

final class ProcessRunner implements Runner
{
    public function run(array $arguments, string $directory, int $timeout = 30, ?string $outputFile = null): CommandResult
    {
        $out = $outputFile ? fopen($outputFile, 'x+b') : tmpfile();
        $err = tmpfile();
        $input = fopen(PHP_OS_FAMILY === 'Windows' ? 'NUL' : '/dev/null', 'r');
        if (!$out || !$err || !$input) { throw new RuntimeException('Cannot open command streams.'); }
        if ($outputFile) { chmod($outputFile, 0600); }
        // File descriptors avoid pipe deadlocks during Docker builds and large backups.
        $process = proc_open($arguments, [0 => $input, 1 => $out, 2 => $err], $pipes, $directory, null, ['bypass_shell' => true]);
        if (!is_resource($process)) {
            fclose($out); fclose($err); fclose($input);
            throw new RuntimeException('Cannot start ' . basename((string) $arguments[0]) . '.');
        }
        $deadline = microtime(true) + $timeout;
        $code = -1;
        try {
            do {
                $status = proc_get_status($process);
                if (!$status['running']) { $code = $status['exitcode']; break; }
                if (microtime(true) > $deadline || (!$outputFile && fstat($out)['size'] > 16777216) || fstat($err)['size'] > 16777216) {
                    proc_terminate($process);
                    usleep(200000);
                    if (proc_get_status($process)['running']) { proc_terminate($process, 9); }
                    $code = 124;
                    break;
                }
                usleep(20000);
            } while (true);
            $closed = proc_close($process);
            $process = null;
            if ($code < 0) { $code = $closed; }
            rewind($out); rewind($err);
            return new CommandResult($code, $outputFile ? '' : (string) stream_get_contents($out, 2097152), (string) stream_get_contents($err, 2097152));
        } finally {
            if (is_resource($process)) { proc_terminate($process, 9); proc_close($process); }
            fclose($out); fclose($err); fclose($input);
        }
    }
}

