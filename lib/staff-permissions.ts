// Role-based permissions for the staff portal.
//
// Roles are stored as free-text in `staff_users.role` so adding a new role is
// a one-line config change here — no migration. Three built-in roles ship:
//
//   admin   — full power. Sam.
//   editor  — can run the tournament (manage bracket, predictions, send
//             emails, edit players) but can't manage other staff or rotate
//             roles.
//   viewer  — read-only. Mia gets this: she can see the bracket, players,
//             standings, predictions, visitors and email analytics, but
//             can't change anything.
//
// Anything not in this map gets the `viewer` permission set as a safe
// default, so JIT-provisioned staff land read-only until promoted.
//
// Permission strings are deliberately granular ("bracket:write", not just
// "bracket") so a future role like "predictor-admin" can mix and match.

export type StaffRole = "admin" | "editor" | "viewer" | (string & {});

export type Permission =
  // bracket / tournament structure
  | "bracket:read"
  | "bracket:write"
  // players (enrollments, profiles, sunset/blocks)
  | "players:read"
  | "players:write"
  // standings (read-only by nature, but gated for completeness)
  | "standings:read"
  // prediction game (settings, locks, manual overrides)
  | "predictions:read"
  | "predictions:write"
  // email — read covers analytics + miamail history; write covers sending
  | "emails:read"
  | "emails:write"
  // visit logs
  | "visitors:read"
  // attempt-level inspection (per-question grading data)
  | "attempts:read"
  // file uploads / R2 storage
  | "files:read"
  | "files:write"
  // staff administration (role assignment, deactivation)
  | "staff:read"
  | "staff:write"
  // audit log
  | "audit:read"
  // forms (custom forms feature) — read covers viewing forms + responses,
  // write covers creating/editing/publishing/deleting
  | "forms:read"
  | "forms:write"
  // articles / blog CMS — split publish + delete out of write so a junior
  // editor can draft + revise without going live or destroying rows.
  | "articles:read"
  | "articles:write"
  | "articles:publish"
  | "articles:delete";

const VIEWER: ReadonlySet<Permission> = new Set<Permission>([
  "bracket:read",
  "players:read",
  "standings:read",
  "predictions:read",
  "emails:read",
  "visitors:read",
  "attempts:read",
  "files:read",
  "forms:read",
  "articles:read",
]);

const EDITOR: ReadonlySet<Permission> = new Set<Permission>([
  ...VIEWER,
  "bracket:write",
  "players:write",
  "predictions:write",
  "emails:write",
  "files:write",
  "forms:write",
  "articles:write",
  "articles:publish",
]);

const ADMIN: ReadonlySet<Permission> = new Set<Permission>([
  ...EDITOR,
  "staff:read",
  "staff:write",
  "audit:read",
  "articles:delete",
]);

const ROLE_PERMISSIONS: Record<string, ReadonlySet<Permission>> = {
  admin: ADMIN,
  editor: EDITOR,
  viewer: VIEWER,
  // legacy bootstrap value — treat as viewer until promoted.
  staff: VIEWER,
};

export const ALL_ROLES: StaffRole[] = ["admin", "editor", "viewer"];

export function permissionsFor(role: string | null | undefined): ReadonlySet<Permission> {
  if (!role) return VIEWER;
  return ROLE_PERMISSIONS[role] ?? VIEWER;
}

export function staffCan(
  role: string | null | undefined,
  perm: Permission
): boolean {
  return permissionsFor(role).has(perm);
}

export function describeRole(role: string | null | undefined): string {
  switch (role) {
    case "admin":
      return "Admin · full power";
    case "editor":
      return "Editor · runs the tournament";
    case "viewer":
      return "Viewer · read-only";
    case "staff":
      return "Unassigned · read-only until promoted";
    default:
      return role ? `Custom: ${role}` : "Viewer";
  }
}
