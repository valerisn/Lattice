CREATE TABLE installation (id integer PRIMARY KEY CHECK (id = 1), initialized boolean NOT NULL DEFAULT false);
INSERT INTO installation (id) VALUES (1);
CREATE TABLE users (
  id uuid PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL, username text NOT NULL UNIQUE,
  password_hash text NOT NULL, avatar text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workspaces (
  id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE, description text NOT NULL DEFAULT '',
  logo text, accent text NOT NULL DEFAULT '#39764d', homepage_id uuid,
  upload_limit integer NOT NULL DEFAULT 10485760 CHECK (upload_limit BETWEEN 1024 AND 52428800),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workspace_members (
  workspace_id uuid REFERENCES workspaces ON DELETE CASCADE, user_id uuid REFERENCES users ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','editor','viewer')), joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,user_id)
);
CREATE INDEX members_user_idx ON workspace_members(user_id);
CREATE TABLE groups (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE, name text NOT NULL,
  UNIQUE(workspace_id,name), UNIQUE(workspace_id,id)
);
CREATE TABLE group_members (
  workspace_id uuid NOT NULL, group_id uuid NOT NULL, user_id uuid NOT NULL,
  PRIMARY KEY(group_id,user_id),
  FOREIGN KEY(workspace_id,group_id) REFERENCES groups(workspace_id,id) ON DELETE CASCADE,
  FOREIGN KEY(workspace_id,user_id) REFERENCES workspace_members(workspace_id,user_id) ON DELETE CASCADE
);
CREATE TABLE collections (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
  name text NOT NULL, description text NOT NULL DEFAULT '', icon text NOT NULL DEFAULT 'folder',
  visibility text NOT NULL DEFAULT 'workspace' CHECK (visibility IN ('workspace','restricted')),
  UNIQUE(workspace_id,id)
);
CREATE TABLE pages (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
  parent_id uuid, collection_id uuid, slug text NOT NULL, title text NOT NULL,
  description text NOT NULL DEFAULT '', content text NOT NULL DEFAULT '', position integer NOT NULL DEFAULT 0,
  state text NOT NULL DEFAULT 'published' CHECK (state IN ('draft','published')),
  created_by uuid NOT NULL REFERENCES users, updated_by uuid NOT NULL REFERENCES users,
  version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id), UNIQUE(workspace_id,slug), CHECK (parent_id IS DISTINCT FROM id),
  FOREIGN KEY(workspace_id,parent_id) REFERENCES pages(workspace_id,id),
  FOREIGN KEY(workspace_id,collection_id) REFERENCES collections(workspace_id,id)
);
ALTER TABLE workspaces ADD CONSTRAINT homepage_workspace_fk FOREIGN KEY(id,homepage_id) REFERENCES pages(workspace_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX pages_tree_idx ON pages(workspace_id,parent_id,position);
CREATE INDEX pages_search_idx ON pages USING gin(to_tsvector('english',title || ' ' || content));
CREATE TABLE page_revisions (
  id uuid PRIMARY KEY, page_id uuid NOT NULL REFERENCES pages ON DELETE CASCADE,
  version integer NOT NULL, title text NOT NULL, description text NOT NULL, content text NOT NULL,
  editor_id uuid NOT NULL REFERENCES users, summary text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(page_id,version)
);
CREATE TABLE permissions (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
  page_id uuid, collection_id uuid, group_id uuid, user_id uuid,
  capability text NOT NULL CHECK (capability IN ('read','edit')),
  CHECK (num_nonnulls(page_id,collection_id) = 1), CHECK (num_nonnulls(group_id,user_id) = 1),
  FOREIGN KEY(workspace_id,page_id) REFERENCES pages(workspace_id,id) ON DELETE CASCADE,
  FOREIGN KEY(workspace_id,collection_id) REFERENCES collections(workspace_id,id) ON DELETE CASCADE,
  FOREIGN KEY(workspace_id,group_id) REFERENCES groups(workspace_id,id) ON DELETE CASCADE,
  FOREIGN KEY(workspace_id,user_id) REFERENCES workspace_members(workspace_id,user_id) ON DELETE CASCADE
);
CREATE INDEX permissions_workspace_idx ON permissions(workspace_id);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE TABLE invites (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
  email text NOT NULL, role text NOT NULL CHECK(role IN ('admin','editor','viewer')),
  token_hash text NOT NULL UNIQUE, created_by uuid NOT NULL REFERENCES users,
  expires_at timestamptz NOT NULL, accepted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE attachments (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL, page_id uuid NOT NULL,
  name text NOT NULL, storage_key text NOT NULL UNIQUE, mime text NOT NULL, size integer NOT NULL CHECK(size > 0),
  uploaded_by uuid NOT NULL REFERENCES users, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,page_id) REFERENCES pages(workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE favorites (
  user_id uuid REFERENCES users ON DELETE CASCADE, page_id uuid REFERENCES pages ON DELETE CASCADE,
  PRIMARY KEY(user_id,page_id)
);
CREATE TABLE rate_limits (key text PRIMARY KEY, hits integer NOT NULL, resets_at timestamptz NOT NULL);
