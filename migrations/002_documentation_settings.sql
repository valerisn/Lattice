ALTER TABLE workspaces ADD COLUMN documentation jsonb NOT NULL DEFAULT '{}'::jsonb;
