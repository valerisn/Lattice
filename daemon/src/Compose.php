<?php
declare(strict_types=1);
namespace Lattice\Daemon;
use RuntimeException;

final class Compose
{
    public function __construct(public readonly Config $config, public readonly Runner $runner) {}

    public function run(array $args, int $timeout = 60, ?string $output = null, ?string $file = null): CommandResult
    {
        return $this->runner->run([
            'docker', 'compose', '--project-name', $this->config->get('project_name'),
            '--project-directory', $this->config->get('directory'),
            '--file', $file ?? $this->config->get('directory') . '/compose.yaml', ...$args,
        ], $this->config->get('directory'), $timeout, $output);
    }

    public function must(array $args, string $step, int $timeout = 60, ?string $output = null, ?string $file = null): string
    {
        $result = $this->run($args, $timeout, $output, $file);
        if ($result->code !== 0) { throw new RuntimeException("$step failed (exit {$result->code}). Inspect Docker logs locally."); }
        return $result->stdout;
    }

    public function containers(): array
    {
        $text = trim($this->must(['ps', '--all', '--format', 'json'], 'Container inspection'));
        if ($text === '') { return []; }
        $rows = str_starts_with($text, '[') ? json_decode($text, true, 64, JSON_THROW_ON_ERROR) :
            array_map(static fn ($line) => json_decode($line, true, 64, JSON_THROW_ON_ERROR), preg_split('/\r?\n/', $text));
        if (!is_array($rows)) { throw new RuntimeException('Invalid Docker Compose status response.'); }
        return $rows;
    }
}

