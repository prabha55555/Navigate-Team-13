# Backend platform layer — feature notes

Plain-English notes on what the platform layer does. The exact API contract is in
`docs/ARCHITECTURE.md`; this page explains each piece for product and sales.

## Workspaces (multi-tenancy)
- **What is it?** Every customer (a college, institute or company) gets its own private workspace that holds its people, courses and results.
- **Why is it needed?** Many customers share one Navigate installation, and none of them may ever see another's data.
- **How does it work?** Every record carries its workspace, and every request is filtered by the signed-in person's workspace. Asking for something in another workspace answers "not found", as if it doesn't exist.

## Sign-up: create a workspace or join one
- **What is it?** A new person either creates a workspace (and becomes its owner) or joins an existing one with an invite link or a course join code.
- **Why is it needed?** It lets an institution start on its own in a minute, and lets staff and students join without anyone typing in accounts by hand.
- **How does it work?** An invite link decides the person's role (admin, instructor or student). A course join code makes them a student and enrols them in that course straight away. The plan's seat limits are checked first.

## Sign-in, sessions and lockout
- **What is it?** Email-and-password sign-in with sessions that renew automatically, plus protection against password guessing.
- **Why is it needed?** People should stay signed in comfortably while accounts stay safe from attackers.
- **How does it work?** A sign-in gives a short-lived pass (15 minutes) and a renewal pass (7 days); signing out cancels the renewal pass. After 5 wrong passwords the account is locked for 15 minutes.

## Passwords: change and reset
- **What is it?** People can change their password, or reset a forgotten one with an emailed link.
- **Why is it needed?** Forgotten passwords are the most common support request, and a stolen password must be fixable fast.
- **How does it work?** The reset link is single-use, expires after 1 hour, and only a scrambled copy of it is stored. Changing or resetting a password signs out every other session. New passwords need 8+ characters with a letter and a number. Until an email provider is connected, the reset email is written to the server log; in development the link is also returned to the screen.

## Profile
- **What is it?** People can see and edit their name and theme preference (light, dark or system).
- **Why is it needed?** It's basic personalisation, and the theme follows the person across devices.
- **How does it work?** The preference is saved on the account and returned at every sign-in.

## Members and roles
- **What is it?** Owners and admins see everyone in the workspace and can change roles, deactivate people or remove them.
- **Why is it needed?** Staff come and go, and access must follow.
- **How does it work?** Changes take effect within seconds, and the person gets a notification. A deactivated person who is still signed in is told their account was deactivated, not that their session expired. Safeguards: a workspace always keeps at least one owner, admins can't touch owners, and nobody can lock themselves out. Removing someone also takes them out of their courses.

## Invite links
- **What is it?** Shareable join links with a preset role, an expiry date and an optional usage cap.
- **Why is it needed?** It's the simplest way to bring a whole department or class in at once.
- **How does it work?** Admins create a link (`/join/<code>`), share it however they like, and can revoke it at any time. Anyone opening it sees which workspace and role it's for before signing up.

## Plans, limits and usage
- **What is it?** Three plans (Free, Pro and Enterprise) with limits on staff seats, students and AI generations per month.
- **Why is it needed?** It is the commercial model: customers pay more as they grow and use more AI.
- **How does it work?** Seats are checked whenever someone joins or changes role. Each AI action uses up one generation, and the count resets every month. Hitting a limit shows a clear "upgrade" message, and owners are notified once a month when AI runs out.

## Changing plans (billing)
- **What is it?** Owners can switch plans from the billing page.
- **Why is it needed?** Customers need a self-serve way to upgrade, and sales needs to see who wants to upgrade.
- **How does it work?** In demo mode (the default outside production) the change is instant. In production, payments aren't connected yet, so the request is logged, owners are notified, and the customer is told sales will contact them. A downgrade is refused if the workspace has more people than the smaller plan allows.

## Notifications
- **What is it?** An in-app inbox (the bell icon) for events like "someone joined", "your role changed" and "AI limit reached". The learning features add assessment and results notifications.
- **Why is it needed?** People need to notice what changed without checking every page.
- **How does it work?** Notifications are stored for each person, show newest first with an unread count, and can be marked read one at a time or all at once. They are deleted automatically after 90 days.

## Audit log
- **What is it?** A history of important actions in the workspace: who did what, and when.
- **Why is it needed?** Institutions need accountability and evidence for compliance and disputes.
- **How does it work?** Workspace creation, joins, role changes, removals, invites, plan changes and password changes are recorded with the person's name and IP address. Member changes also record who was affected (name, email, role, and the old → new role), so the log stays readable after someone is removed. Owners and admins can browse the log page by page. Entries are kept for one year.

## Security and operations
- **What is it?** Standard protections and the health checks needed to run Navigate as a hosted service.
- **Why is it needed?** A commercial SaaS must resist abuse, never leak internal details, and work behind load balancers.
- **How does it work?** The API sends security headers and only accepts browser calls from approved web addresses. It rate-limits sign-in attempts (20 per 15 minutes), AI calls (20 a minute per person) and overall traffic (600 per 15 minutes). API responses are never cached by the browser, so pages always show current data. Every response carries a request ID that matches a one-line log entry, and logs never include passwords or tokens. `/api/health` and `/api/ready` tell the load balancer whether the server and database are up. In production the server refuses to start with weak secrets, and on shutdown it finishes in-flight requests before stopping.

## Existing-account migration
- **What is it?** Accounts created before workspaces existed keep working.
- **Why is it needed?** Current users shouldn't be locked out by the upgrade.
- **How does it work?** On their next sign-in they're placed in a shared "Default Workspace". The first old instructor or admin to sign in becomes its owner. Old passwords keep working.

## Shared building blocks for other features
- **What is it?** Ready-made pieces that the courses and assessments features reuse: sign-in checks, role checks, error messages, input checks, plan metering, notifications and audit logging.
- **Why is it needed?** Every feature behaves the same way, and a security rule only has to be written once.
- **How does it work?** They live in `backend/middlewares`, `backend/utils` and `backend/services`, and are listed in `docs/ARCHITECTURE.md` §6.

## Tests
`cd backend && npm test`. The platform suite (`tests/platform`, 50 tests) covers sign-up, invites, seat limits, lockout, sessions, passwords, members, tenant isolation, plans, AI quota, notifications, rate limits and compatibility with the older routes. It runs against `MONGO_URI_TEST` (default `mongodb://127.0.0.1:27017/navigate_test_platform`), which is wiped on each run.
