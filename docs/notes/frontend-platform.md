# Frontend — platform UI (F1)

Owner: F1. Covers the API layer, app shell, theming, public/auth pages, settings, notifications and shared helpers.
Each feature: **What is it? / Why is it needed? / How does it work?**

## API layer (`src/api/*`)
- **What:** One HTTP client plus one module per backend area (auth, workspace, notifications, courses, assessments, submissions, analytics, learningPath, questionBank, ai).
- **Why:** Every screen talks to the server the same way, so sign-in, errors and retries behave consistently.
- **How:** `client.js` adds the sign-in token to each request, silently renews it when it expires (one renewal at a time, never for sign-in calls), and turns every failure into a clear message with a code (e.g. `PLAN_LIMIT`).

## Session handling
- **What:** Staying signed in, renewing access in the background, and a clear "session expired" message.
- **Why:** People shouldn't be kicked out mid-task, and when they are, they should know why and land back where they were.
- **How:** The access token is renewed a minute before it expires (and when a tab wakes up). If renewal is refused, the user is sent to Sign in with "Your session has expired", and returns to the page they were on after signing in.

## Dark mode
- **What:** Light, dark, or "match my device" themes.
- **Why:** Comfort for long sessions and late-night study; expected in modern SaaS.
- **How:** Choose it from the user menu or Settings → Profile. It's saved to your account (follows you to other devices) and to the browser for public pages, and applied before the page paints so there's no flash.

## App shell
- **What:** Sidebar, top bar, notification bell, command palette, user menu and keyboard shortcuts.
- **Why:** Fast, predictable navigation for staff and students.
- **How:** The sidebar shows the workspace name, plan badge and the right links for your role (staff: Dashboard, Courses, Question bank; students: Dashboard, My results, Join a course; admins also Members and Billing). Ctrl/⌘+K opens a palette to jump to pages, courses, recent assessments or run actions (create course, new assessment, toggle theme). "?" lists shortcuts such as G then D for the dashboard.

## Notifications
- **What:** A bell with an unread count and a full Notifications page.
- **Why:** People need to know when an assessment is published, results are released, work is submitted or someone joins.
- **How:** The app checks for new notifications every minute while the tab is visible. Clicking one marks it read and opens the related page; "Mark all read" clears the badge. The page groups notifications by day and can show only unread.

## Landing page & pricing
- **What:** The public homepage and a `/pricing` page.
- **Why:** Explain the product honestly to prospective institutions and show what each plan includes.
- **How:** The homepage covers audiences, the feature set (AI generation, proctoring, adaptive learning, analytics, item analysis, gradebook), how it works, security facts that are true today, a pricing teaser and FAQ. Pricing shows plan cards, a comparison table and FAQ; signed-in users see the live plan list and their current plan.

## Sign up, sign in and joining
- **What:** Create a workspace, join with a code, sign in, forgot/reset password, and `/join/<code>` links.
- **Why:** Institutions need a self-serve start; staff and students need a frictionless way in with the right role.
- **How:** "Create a workspace" makes you the owner. "Join with a code" accepts an invite or course code and previews it ("You're joining Northwind as an instructor"). A signed-in student who opens a course link is enrolled straight away. Password reset sends a one-hour link (shown on screen in development).

## Settings
- **What:** Profile, Workspace, Members, Billing and Audit log tabs (the last four for owners/admins).
- **Why:** Admins must manage people, plans and branding without asking support.
- **How:**
  - *Profile:* change name, theme and password (other sessions are signed out).
  - *Workspace:* rename, pick a brand colour, and allow/disallow student sign-up with a course code.
  - *Members:* search and filter people, change roles, deactivate or remove (with confirmation); create invite links with role, expiry and max uses, copy or revoke them.
  - *Billing:* usage meters for staff seats, students and AI generations (warning at 80%), plan cards with upgrade/downgrade. In demo billing a banner says no payment is taken; otherwise the request goes to sales.
  - *Audit log:* who did what and when, in plain language, with filters and paging.

## Plan-limit prompts
- **What:** A friendly "you've reached your plan's limit" dialog.
- **Why:** Hitting a limit should explain what happened and how to fix it, not show an error.
- **How:** Any screen can pass a failed request to `usePlanLimitHandler`; if it's a plan-limit error it shows usage and, for admins, a link to Billing.

## Onboarding checklist
- **What:** A "Set up your workspace" card for staff: create a course → share its join code → create an assessment → publish it → invite a colleague (admins).
- **Why:** New customers need a clear path to their first success.
- **How:** Progress is worked out from real data (courses, enrolments, assessments, invites). It can be hidden and disappears once complete.

## Reliability
- **What:** Friendly crash screen, 404 page and an offline banner.
- **Why:** Errors happen; users should never see a blank page.
- **How:** If a page crashes, a message with Reload and a report ID appears (the rest of the app keeps working). Unknown URLs show a 404 with a way home. Losing connection shows a banner until it's back.

## Page titles in the top bar
- **What:** The top-bar breadcrumb and browser tab show the real name of what you're looking at ("Courses › Data Structures & Algorithms in Java") instead of "Course".
- **Why:** Wayfinding — people always know where they are, on desktop and on phones.
- **How (for developers):** call `useBreadcrumb(title, { label, to })` or `usePageTitle(title)` from `components/layout/breadcrumb` (also re-exported from `components/layout/Layout`). Pass `undefined` while loading; the override disappears when the page unmounts. The parent crumb is a link when `to` is given.
