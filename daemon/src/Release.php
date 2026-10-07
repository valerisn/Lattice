<?php
declare(strict_types=1);
namespace Lattice\Daemon;
use RuntimeException;

final class Release
{
    public const API = 'https://api.github.com/repos/valerisn/Lattice/releases/latest';

    public function __construct(private readonly Transport $http) {}

    public static function version(string $tag): string
    {
        if (!preg_match('/^v?((?:0|[1-9]\d{0,8})\.(?:0|[1-9]\d{0,8})\.(?:0|[1-9]\d{0,8}))$/D', $tag, $match)) {
            throw new RuntimeException('Expected a stable release tag such as v1.2.3.');
        }
        return $match[1];
    }

    public static function installed(string $directory): string
    {
        $file = $directory . '/package.json';
        if (!is_file($file) || filesize($file) > 1048576) { throw new RuntimeException('Cannot read the installed Lattice version.'); }
        $package = json_decode((string) file_get_contents($file), true, 32, JSON_THROW_ON_ERROR);
        return self::version((string) ($package['version'] ?? ''));
    }

    public function check(string $installed, bool $allowMajor): array
    {
        $installed = self::version($installed);
        $response = $this->http->get(self::API);
        if ($response['status'] === 404) {
            return ['status' => 'unreleased', 'installed' => $installed, 'message' => 'No stable release has been published.', 'checked_at' => gmdate('c')];
        }
        if ($response['status'] !== 200) { throw new RuntimeException('GitHub release check failed (HTTP ' . $response['status'] . ').'); }
        $data = json_decode($response['body'], true, 32, JSON_THROW_ON_ERROR);
        if (!is_array($data) || ($data['draft'] ?? true) !== false || ($data['prerelease'] ?? true) !== false || !is_string($data['tag_name'] ?? null)) {
            throw new RuntimeException('GitHub did not return a valid stable release.');
        }
        $version = self::version($data['tag_name']);
        $newer = version_compare($version, $installed, '>');
        $majorAllowed = $allowMajor || explode('.', $version)[0] === explode('.', $installed)[0];
        $status = !$newer ? (version_compare($version, $installed, '<') ? 'ahead' : 'current') : ($majorAllowed ? 'available' : 'major-blocked');
        return [
            'status' => $status, 'installed' => $installed, 'latest' => $version, 'tag' => $data['tag_name'],
            'url' => 'https://github.com/valerisn/Lattice/releases/tag/' . rawurlencode($data['tag_name']),
            'message' => match ($status) {
                'available' => "Lattice $version is available.",
                'major-blocked' => "Lattice $version needs a major-version upgrade. Review it and explicitly allow major updates.",
                'ahead' => 'Installed version is newer than the latest stable release.',
                default => 'Installed version matches the latest stable release.',
            },
            'checked_at' => gmdate('c'),
        ];
    }
}

