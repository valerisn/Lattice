export type Role = "owner" | "admin" | "editor" | "viewer";
export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  avatar: string | null;
  created_at: string;
}
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo: string | null;
  accent: string;
  homepage_id: string | null;
  upload_limit: number;
  role: Role;
}
export interface WikiPage {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  collection_id: string | null;
  title: string;
  slug: string;
  description: string;
  content: string;
  position: number;
  state: "draft" | "published";
  version: number;
  created_at: string;
  updated_at: string;
  author: string;
  favorite: boolean;
}
export interface Collection {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  icon: string;
  visibility: "workspace" | "restricted";
}
export interface Revision {
  id: string;
  version: number;
  title: string;
  description: string;
  content: string;
  editor: string;
  summary: string;
  created_at: string;
}
export const canEdit = (role: Role) => role !== "viewer";
export const canManage = (role: Role) => role === "owner" || role === "admin";
