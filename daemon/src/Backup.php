<?php
declare(strict_types=1);
namespace Lattice\Daemon;
use RuntimeException;

final class Backup
{
    public function __construct(private readonly Compose $compose, private readonly Store $store) {}

    public function capture(): array
    {
        $definition = json_decode($this->compose->must(['config', '--format', 'json'], 'Compose configuration'), true, 64, JSON_THROW_ON_ERROR);
        $id = trim($this->compose->must(['ps', '--all', '--quiet', 'app'], 'App container lookup'));
        if (!preg_match('/^[a-f0-9]{12,64}$/D', $id)) { throw new RuntimeException('Exactly one existing app container is required for backup.'); }
        $image = $this->compose->runner->run(['docker', 'inspect', '--format', '{{.Image}}', $id], $this->compose->config->get('directory'));
        $imageId = trim($image->stdout);
        if ($image->code !== 0 || !preg_match('/^sha256:[a-f0-9]{64}$/D', $imageId)) { throw new RuntimeException('Cannot identify the running app image.'); }
        return ['definition' => $definition, 'container' => $id, 'image' => $imageId];
    }

    public function create(array $context, string $revision): string
    {
        $config = $this->compose->config;
        $path = $this->store->directory . '/backups/' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(4));
        if (!mkdir($path, 0700, true)) { throw new RuntimeException('Cannot create backup directory.'); }
        Store::atomic($path . '/compose.json', $context['definition']);
        Store::atomic($path . '/manifest.json', [
            'complete' => false, 'created_at' => gmdate('c'), 'revision' => $revision,
            'image' => $context['image'], 'project' => $config->get('project_name'),
        ]);
        $state = $this->store->read('update');
        $state['phase'] = 'backing-up';
        $state['backup'] = $path;
        $state['blocked'] = true;
        $this->store->write('update', $state);
        $env = $config->get('directory') . '/.env';
        if (!is_file($env) || !copy($env, $path . '/environment.env')) { throw new RuntimeException('Cannot back up the deployment .env file.'); }
        chmod($path . '/environment.env', 0600);
        $this->compose->must(['stop', '--timeout', '30', 'app'], 'Pause app for backup', 90, null, $path . '/compose.json');
        $this->compose->must([
            'exec', '-T', 'db', 'pg_dump', '--username', $config->get('database_user'),
            '--dbname', $config->get('database_name'), '--format=custom',
        ], 'Database backup', 900, $path . '/database.dump', $path . '/compose.json');
        $archive = $this->compose->runner->run([
            'docker', 'run', '--rm', '--network', 'none', '--read-only', '--user', '0:0',
            '--volumes-from', $context['container'] . ':ro', '--entrypoint', 'tar',
            $context['image'], '-czf', '-', '-C', '/app/uploads', '.',
        ], $config->get('directory'), 900, $path . '/uploads.tar.gz');
        if ($archive->code !== 0) { throw new RuntimeException('Upload archive failed. The backup is incomplete.'); }
        if (file_get_contents($path . '/database.dump', false, null, 0, 5) !== 'PGDMP'
            || file_get_contents($path . '/uploads.tar.gz', false, null, 0, 2) !== "\x1f\x8b") {
            throw new RuntimeException('Backup files have invalid headers. The backup is incomplete.');
        }
        Store::atomic($path . '/manifest.json', [
            'complete' => true, 'created_at' => gmdate('c'), 'revision' => $revision,
            'image' => $context['image'], 'project' => $config->get('project_name'),
            'sha256' => [
                'database.dump' => hash_file('sha256', $path . '/database.dump'),
                'uploads.tar.gz' => hash_file('sha256', $path . '/uploads.tar.gz'),
                'environment.env' => hash_file('sha256', $path . '/environment.env'),
                'compose.json' => hash_file('sha256', $path . '/compose.json'),
            ],
        ]);
        return $path;
    }

    public static function compatible(array $before, array $after): bool
    {
        // Database/container wiring changes need an operator to plan the migration.
        foreach (['volumes', 'networks'] as $key) {
            if (($before[$key] ?? []) != ($after[$key] ?? [])) { return false; }
        }
        if (($before['services']['db'] ?? null) != ($after['services']['db'] ?? null)) { return false; }
        foreach (['volumes', 'networks', 'ports'] as $key) {
            if (($before['services']['app'][$key] ?? []) != ($after['services']['app'][$key] ?? [])) { return false; }
        }
        foreach (['DATABASE_URL', 'UPLOAD_DIR'] as $key) {
            if (($before['services']['app']['environment'][$key] ?? null) !== ($after['services']['app']['environment'][$key] ?? null)) { return false; }
        }
        return isset($after['services']['app'], $after['services']['db']);
    }
}

