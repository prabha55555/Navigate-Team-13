// Role helpers shared by routing, layout and pages.
// Hierarchy: owner > admin > instructor > student.
export const STAFF_ROLES = ['owner', 'admin', 'instructor'];
export const ADMIN_ROLES = ['owner', 'admin'];

/** owner / admin / instructor — people who teach or run the workspace. */
export const isStaffRole = (role) => STAFF_ROLES.includes(role);
/** owner / admin — people who manage members, plan and workspace settings. */
export const isAdminRole = (role) => ADMIN_ROLES.includes(role);
export const isOwnerRole = (role) => role === 'owner';
export const isStudentRole = (role) => role === 'student';

/** Where a signed-in user's home is. Every role lands on /app (dashboard by role). */
export const homePathFor = () => '/app';

const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', instructor: 'Instructor', student: 'Student' };
export const roleLabel = (role) => ROLE_LABELS[role] || 'Member';

export const initialsOf = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';
