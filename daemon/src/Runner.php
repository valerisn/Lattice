<?php
declare(strict_types=1);
namespace Lattice\Daemon;
interface Runner
{
    public function run(array $arguments, string $directory, int $timeout = 30, ?string $outputFile = null): CommandResult;
}

