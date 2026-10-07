<?php
declare(strict_types=1);
namespace Lattice\Daemon;
use RuntimeException;

final class Http implements Transport
{
    public function get(string $url): array
    {
        if (!extension_loaded('curl')) { throw new RuntimeException('PHP cURL is required.'); }
        $handle = curl_init($url);
        $body = '';
        curl_setopt_array($handle, [
            CURLOPT_FOLLOWLOCATION => false, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 10,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS, CURLOPT_USERAGENT => 'Lattice-daemon/0.1.0',
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            CURLOPT_WRITEFUNCTION => static function ($curl, string $chunk) use (&$body): int {
                if (strlen($body) + strlen($chunk) > 1048576) { return 0; }
                $body .= $chunk;
                return strlen($chunk);
            },
        ]);
        $ok = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        if ($ok === false) { throw new RuntimeException('HTTP check failed or exceeded its response limit.'); }
        return ['status' => $status, 'body' => $body];
    }
}

