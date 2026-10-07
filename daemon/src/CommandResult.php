<?php
declare(strict_types=1);
namespace Lattice\Daemon;
final class CommandResult
{
    public function __construct(public readonly int $code, public readonly string $stdout = '', public readonly string $stderr = '') {}
}

