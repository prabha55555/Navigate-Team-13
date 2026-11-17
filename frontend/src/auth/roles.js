// Role helpers shared by routing, layout and auth pages.
export const isInstructorRole = (role) => role === 'instructor' || role === 'admin';

// Where a signed-in user's "home" is.
export const homePathFor = (user) =>
  isInstructorRole(user?.role) ? '/instructor/dashboard' : '/dashboard';
