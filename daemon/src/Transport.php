<?php
declare(strict_types=1);
namespace Lattice\Daemon;
interface Transport
{
    /** @return array{status:int, body:string} */
    public function get(string $url): array;
}

