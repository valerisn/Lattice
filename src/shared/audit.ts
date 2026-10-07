export interface AuditEvent {
  id: string;
  actor_name: string;
  action: string;
  target: string;
  created_at: string;
}
export interface AuditPage {
  events: AuditEvent[];
  nextCursor: string | null;
}
export const auditActions: Record<string, string> = {
  "templates.POST": "Created a page template",
  "templates.PATCH": "Updated a page template",
  "templates.DELETE": "Deleted a page template",
  "admin.PATCH": "Updated workspace settings",
  "documentation.PATCH": "Updated documentation settings",
  "invites.POST": "Created an invitation",
  "invites.DELETE": "Revoked an invitation",
  "members.PATCH": "Changed a member role",
  "members.DELETE": "Removed a member",
  "groups.POST": "Created a group",
  "groups.PATCH": "Changed group membership",
  "groups.DELETE": "Deleted a group",
  "permissions.POST": "Added an access grant",
  "permissions.DELETE": "Removed an access grant",
};
