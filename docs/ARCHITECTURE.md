# Navigate — SaaS Platform Architecture & API Contract

This document is the single source of truth for the Navigate SaaS platform. Backend and frontend
are built against it. If the implementation must deviate, update this file in the same change.

## 1. Product shape

Navigate is a multi-tenant SaaS for institutions (colleges, training institutes, corporate L&D).

- A **workspace** (`Organization`) is one paying customer. All data belongs to exactly one workspace.
- People join a workspace by **creating it** (becomes `owner`), via an **invite link** (role set by the link),
  or as a student via a **course join code** (enrolls them in that course).
- Roles: `owner` > `admin` > `instructor` > `student`. `owner`/`admin` manage the workspace, members, plan.
  `instructor` manages courses they teach (admins/owners can manage all courses). `student` takes assessments.

## 2. Conventions

- Base path `/api`. JSON in/out. IDs are Mongo ObjectIds serialized as `id` (string). Dates are ISO strings.
- Auth header: `x-auth-token: <jwt>` (also accepted: `Authorization: Bearer <jwt>`).
  Access token (15 min) payload: `{ user: { id, role, org } }`. Refresh token (7 days) via `/api/auth/refresh-token`.
- **Errors**: HTTP status + `{ "message": "Human readable", "error": { "code": "SNAKE_CASE", "message": "...", "details": {...}? } }`.
  Common codes: `VALIDATION_ERROR` 400, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409,
  `PLAN_LIMIT` 402 (`details: { limit, used, max, plan }`), `CONTACT_SALES` 402 (plan change outside demo billing),
  `ACCOUNT_DEACTIVATED` 401 (account deactivated — on login, refresh, and any authenticated call; show "your account was deactivated", not "session expired"),
  `RATE_LIMITED` 429, `PAYLOAD_TOO_LARGE` 413, `INTERNAL` 500, `SERVICE_UNAVAILABLE` 503 (database down).
  Clients should not run refresh-on-401 for `/api/auth/*` calls (a failed login is a 401).
- **Lists**: `{ items: [...], total, page, pageSize }`. Query: `?page=1&pageSize=20&q=search&sort=-createdAt`.
- **Tenant isolation**: every query is filtered by the caller's workspace. A resource in another workspace is a `404`, never a `403`.
- Every write that matters creates an `AuditLog` entry.

## 3. Data model (Mongoose)

```
Organization  { name, slug(unique), plan: 'free'|'pro'|'enterprise', branding: { primaryColor, logoUrl },
                settings: { allowStudentSelfSignup: bool },
                usage: { period: 'YYYY-MM', aiGenerations: Number }, createdBy, createdAt, updatedAt }
User          { organization, name, email(unique, lowercase), password(bcrypt), role,
                avatarColor, preferences: { theme: 'light'|'dark'|'system' },
                failedLoginAttempts, lockUntil, passwordResetTokenHash, passwordResetExpires,
                lastLoginAt, deactivated: bool, createdAt, updatedAt }
Invite        { organization, code(unique, url-safe 10+ chars), role: 'admin'|'instructor'|'student',
                createdBy, expiresAt, maxUses (null = unlimited), uses, revoked, createdAt }
Course        { organization, title, code, description, term, color, instructors:[User], createdBy,
                joinCode(unique, 6 chars A-Z0-9 without 0/O/1/I), joinCodeEnabled: bool, archived: bool,
                topics:[String],
                outcomes:[{ id, code, description, bloomLevel }],
                curriculumMap: { links: [{ outcomeId, assessmentId }] }, createdAt, updatedAt }
Enrollment    { organization, course, student, status: 'active'|'removed', enrolledAt }  unique(course, student)
Assessment    { organization, course, createdBy, title, description, instructions,
                status: 'draft'|'published'|'closed'|'archived', publishedAt,
                availableFrom, dueDate, timeLimit (minutes, 0 = none), maxAttempts (default 1),
                passingScore (percent, default 50), shuffleQuestions, shuffleOptions,
                resultsPolicy: 'immediate'|'after-due'|'manual', resultsReleased: bool, showCorrectAnswers: bool,
                proctoring: { enabled, fullscreen, webcam, blockShortcuts, maxViolations (default 5) },
                questions: [{ id, type: 'multiple-choice'|'multiple-select'|'true-false'|'short-answer'|'essay',
                              text, options:[String], correctAnswer: Mixed, points, topic, difficulty: 'Easy'|'Medium'|'Hard',
                              bloomLevel, explanation }],
                totalPoints (derived on save), source: 'manual'|'ai-syllabus'|'ai-quick'|'bank'|'practice',
                isPractice: bool, practiceFor: User (only for personal practice quizzes), createdAt, updatedAt }
Submission    { organization, assessment, course, student, attempt (1-based), isPractice (copied from the assessment),
                status: 'in-progress'|'submitted'|'terminated',
                startedAt, deadlineAt (= min(startedAt + timeLimit, dueDate); null if neither), submittedAt, timeSpent (seconds),
                answers: { [questionId]: Mixed }, questionOrder:[questionId],
                optionOrder: { [questionId]: [original option index, ...] } (only when options are shuffled),
                questionResults:[{ questionId, isCorrect, pointsEarned, maxPoints, feedback, needsReview }],
                score, maxScore, percentage (0-100, 1 decimal), isPassed, needsReview (any written answer awaiting review),
                integrity: { violationCount, terminated, events:[{ type, at, detail }] },
                plagiarism: Mixed, aiFeedback: Mixed,
                override: { score, comment, by, at } (instructor manual grade),
                createdAt, updatedAt }
QuestionBankItem { organization, course (optional), createdBy, type, text, options, correctAnswer, points,
                   topic, difficulty, bloomLevel, explanation, tags:[String], createdAt }
                   (API responses add `usageCount`, computed live; see Question bank)
Notification  { organization, user, type, title, body, link, readAt, createdAt }   TTL 90 days
AuditLog      { organization, actor, action ('course.create', 'member.role_change', ...), targetType, targetId,
                meta, ip, createdAt }   TTL 365 days
```

Indexes: every collection `{ organization: 1, ... }` for its main query paths; `Enrollment {course, student}` unique;
`Submission {assessment, student, attempt}` unique; `Course.joinCode` unique sparse; `Invite.code` unique.

Question rules (`services/questions.js`): question ids match `^[A-Za-z0-9_-]{1,64}$` and are unique per assessment
(missing/duplicate ids are reassigned `q1`, `q2`, ...); types are normalised (`'MCQ'` -> `multiple-choice`, ...); answer keys
given as a letter (`'B'`) or index are stored as option text; true/false keys are stored as `'True'`/`'False'`; a
short-answer key may be one accepted answer or a list of accepted answers.

Topics (`services/topics.js`): question topics are stored as the course's canonical topic when an assessment or a
course bank item is saved (incl. AI-generated and practice questions): exact match ignoring case/spacing, else the
course topic whose words (singular/plural-insensitive) all appear in the question topic or vice versa ("Queue
Fundamentals" → `queues`, "Dynamic Arrays and Amortized Analysis" → `arrays`; most specific match wins), else the
cleaned original. Every topic aggregation (result breakdown, feedback, learning path, mastery, analytics, practice
topic selection) groups case-insensitively under the canonical name. AI-generated questions keep only the model's own
explanation (empty when it gave none).

## 4. Plans & limits (`backend/config/plans.js`)

| Plan | Staff seats (owner+admin+instructor) | Students | AI generations / month | Price (display) |
|---|---|---|---|---|
| free | 2 | 50 | 25 | $0 |
| pro | 25 | 2,000 | 1,000 | $49 / instructor / month |
| enterprise | unlimited | unlimited | unlimited | Contact sales |

- Seat limits are checked when someone joins (invite or join code) and when roles change.
- An **AI generation** = one call to syllabus analysis, question generation, AI feedback for a
  submission, or practice-quiz generation. Counter resets when `usage.period` != current month.
- Exceeding a limit → `402 PLAN_LIMIT`.
- Payments are not processed in this version. `POST /api/workspace/plan` changes the plan directly only when
  `BILLING_MODE=demo` (default in development); otherwise it returns `402` with a "contact sales" message and
  records an upgrade request (audit log + notification to owners).

## 5. API

### Auth `/api/auth`
| Method & path | Who | Body / query | Response |
|---|---|---|---|
| POST `/register` | public | `{ name, email, password, mode: 'create-workspace', workspaceName }` or `{ name, email, password, mode: 'join', code }` (`code` = invite code **or** course join code) | `201 { token, refreshToken, user, workspace }` |
| POST `/login` | public | `{ email, password }` | `{ token, refreshToken, user, workspace }` |
| POST `/refresh-token` | public | `{ refreshToken }` | `{ token }` (401 when invalid, revoked, or issued before a password change) |
| POST `/logout` | any | `{ refreshToken }` | `{ message }` |
| GET `/me` | auth | — | `{ user, workspace }` |
| PATCH `/me` | auth | `{ name?, preferences? }` | `{ user }` |
| POST `/change-password` | auth | `{ currentPassword, newPassword }` | `{ message, token, refreshToken }` — all older sessions are signed out; the caller continues with the new tokens |
| POST `/forgot-password` | public | `{ email }` | always `{ message }` (no account enumeration). Dev: reset link logged to server console and returned as `devResetUrl` when `NODE_ENV !== 'production'` |
| POST `/reset-password` | public | `{ token, password }` | `{ message }` |
| GET `/invite/:code` | public | — | `{ workspace: { name }, role, kind: 'invite'|'course', course?: { title } }` (to preview before sign-up) |

`user` = `{ id, name, email, role, avatarColor, preferences, organization: id, createdAt }`.
`workspace` = `{ id, name, slug, plan, branding, settings, usage, limits, createdAt }`.
Password policy for new passwords: ≥ 8 chars, at least one letter and one digit. Login: wrong credentials → `401 UNAUTHENTICATED`. Login lockout: 5 failures → locked 15 min (`429 RATE_LIMITED`,
`details.retryAfterSeconds`). A deactivated account gets `401 ACCOUNT_DEACTIVATED` on login, refresh and every authenticated call.
Legacy accounts with no workspace are attached to a "Default Workspace" on first login (migration).

### Workspace `/api/workspace` (auth)
| GET `/` | any member | `{ workspace }` |
| PATCH `/` | owner/admin | `{ name?, branding?, settings? }` → `{ workspace }` |
| GET `/members` | owner/admin/instructor | `{ items: [{ id, name, email, role, avatarColor, lastLoginAt, deactivated, createdAt }], total, page, pageSize }` (`?role=student&q=&page=&pageSize=` max 200) |
| PATCH `/members/:id` | owner/admin | `{ role?, deactivated? }` → `{ member }` (cannot demote/deactivate the last owner → 409; admins cannot change owners or make owners → 403; nobody can deactivate themselves; seat limit checked when moving between staff/student or reactivating) |
| DELETE `/members/:id` | owner/admin | removes member (deactivate + remove enrollments) |
| GET `/invites` | owner/admin | `{ items: [{ id, code, role, expiresAt, maxUses, uses, revoked, createdAt, url, status: 'active'|'expired'|'revoked' }], total, page, pageSize }` |
| POST `/invites` | owner/admin | `{ role, expiresInDays? (1–365, default 14), maxUses? (null = unlimited) }` → `201 { invite, code, url }` (`url` = `${APP_URL}/join/${code}`; the frontend may instead build `${window.location.origin}/join/${code}` from `code`, also present as `invite.code`) |
| DELETE `/invites/:id` | owner/admin | revoke |
| GET `/usage` | owner/admin | `{ plan, limits, usage: { staffSeats, students, aiGenerations } }` |
| GET `/plans` | any | `{ plans: [{ id, name, price, priceDetail, limits, features }], currentPlan, billingMode: 'demo'|'contact-sales' }` |
| POST `/plan` | owner | `{ plan }` → `{ workspace }` in demo mode (a downgrade the current members don't fit into → 409); otherwise `402 CONTACT_SALES` (see §4) |
| GET `/audit-log` | owner/admin | `?page&pageSize&action` → `{ items: [{ id, action, targetType, targetId, meta, ip, createdAt, actor: { id, name, email } }], total, page, pageSize }`. `ip` is the client address (`req.ip`, which honours `TRUST_PROXY`: a hop count, `true`, or an Express trust value; IPv4-mapped and `::1` forms are normalised to plain IPv4). Member actions (`member.role_change`, `member.deactivate`, `member.reactivate`, `member.remove`) carry the target's `meta: { name, email, role }`, plus `from`/`to` for role changes; invite actions carry `meta.code` and `meta.role` |

### Notifications `/api/notifications` (auth)
`GET /` (`?unread=true`) → `{ items: [{ id, type, title, body, link, readAt, createdAt }], unreadCount }` (newest first, max 50);
`POST /:id/read` → `{ notification, unreadCount }`; `POST /read-all` → `{ updated, unreadCount }`.
Created by the backend on: assessment published (to enrolled students), results released (to the student),
submission received (to course instructors, batched per assessment per hour), member joined (to owners/admins),
plan limit reached (to owners).

### Courses `/api/courses` (auth)
| GET `/` | any | instructor/admin: courses they can manage (admin/owner: all; `?archived=true`); student: enrolled courses. Each item includes `studentCount` (current roster: active enrollments of non-deactivated students), `assessmentCount`; for staff `averageScore` (= the course analytics `summary.averageScore`); for students `progress: { completed, total, averageScore }` (their own best visible attempts) |
| POST `/` | instructor+ | `{ title, code, description?, term?, color?, topics? }` → course (creator is an instructor of it) |
| GET `/:id` | member with access | course (+ `instructors: [{id,name,email}]`, `studentCount`, `assessmentCount`, `canManage`; `joinCode`/`joinCodeEnabled` only for staff who manage it) |
| PATCH `/:id` | course staff | editable fields, `archived`, `joinCodeEnabled`, `topics`, `outcomes` (`[{ id?, code, description, bloomLevel }]`, ids kept stable), `curriculumMap` (`{ links: [{ outcomeId, assessmentId }] }`; links must reference this course's outcomes and assessments, else 400) |
| DELETE `/:id` | owner/admin | archives (soft) |
| POST `/:id/join-code/regenerate` | course staff | `{ joinCode }` |
| POST `/join` | student | `{ code }` → `{ course, alreadyEnrolled }` (code must belong to a non-archived course of the caller's workspace with the code enabled, else 404; students removed from the course get 403). The caller already holds a student seat, so no seat is consumed; new students joining by code at sign-up are seat-checked in `/api/auth/register` |
| GET `/:id/students` | course staff | roster (deactivated accounts excluded) `{ id, name, email, enrolledAt, averageScore (mean of the student's best graded attempts), submissions (finished attempts), lastActivityAt }` |
| POST `/:id/students` | course staff | `{ emails: [..] }` (max 500) enroll existing workspace students → `{ added, alreadyEnrolled, notFound }` (re-activates removed enrollments) |
| DELETE `/:id/students/:studentId` | course staff | remove enrollment |
| POST `/:id/instructors` | owner/admin | `{ userId }` add co-instructor (must be staff in the workspace) → course |
| DELETE `/:id/instructors/:userId` | owner/admin | remove co-instructor (a course keeps at least one) → course |
| GET `/:id/gradebook` | course staff | `{ assessments: [{id,title,totalPoints,dueDate,status}], rows: [{ student:{id,name,email}, scores: { [assessmentId]: { percentage, score, status, submissionId } }, average }] }`: published/closed non-practice assessments; a cell is the student's **best** finished attempt; `status` is one of `submitted`, `terminated`, `in-progress`, `missing` (past due or closed, nothing submitted), `not-started` |
| GET `/:id/gradebook.csv` | course staff | CSV download (UTF-8 BOM, CRLF, `Student,Email,<title> (%)...,Average (%)`; `missing` for missed work; formula-like cells prefixed with `'`) |

Audited learning actions: `course.create|update|archive|join|join_code_regenerate|student_add|student_remove|instructor_add|instructor_remove|gradebook_export`,
`assessment.create|update|publish|close|unpublish|archive|restore|duplicate|release_results`, `submission.grade`,
`question_bank.create|update|delete|import`.

### Assessments `/api/assessments` (auth)
| GET `/` | any | `?courseId=&status=&q=` (paginated). Staff: non-practice assessments in their courses, archived ones only with `?status=archived` or `?includeArchived=true` (`status` must be draft/published/closed/archived, else 400) in their courses (no questions; with `questionCount`, `submissionCount`, `averageScore`, `courseTitle`). Students: published (and closed) ones in enrolled courses plus their own practice quizzes (`?practice=true\|false`), **questions stripped**, with `courseTitle` and `myStatus: { attempts, attemptsRemaining, inProgress, inProgressSubmissionId, bestPercentage (null until results are visible), lastSubmissionId, canStart, reason? }`. `attempts` = finished (submitted/terminated) attempts only; `inProgress` = an open attempt the student can resume (`inProgressSubmissionId`); `attemptsRemaining` = new attempts still allowed (`maxAttempts` minus all attempts started, including an open one); `canStart` = true when the student may start or resume now; `reason` is `in-progress` (resume), `closed`, `not-yet-available`, `past-due` or `no-attempts-left` |
| POST `/` | course staff | full assessment body (status defaults `draft`) |
| GET `/:id` | any | staff: full (+ `courseTitle`, `questionCount`, `submissionCount`); student: metadata only + `myStatus` (no questions, no answers); drafts and other students' practice quizzes are 404 for students |
| PATCH `/:id` | course staff | any editable field (questions editable only while no submissions exist, else `409` unless `force=true` which only allows text/explanation edits) |
| DELETE `/:id` | course staff | archive (status `archived`; hidden from lists unless `?status=archived` or `?includeArchived=true`) |
| POST `/:id/restore` | course staff | archived → draft (`409` if not archived) |
| POST `/:id/unpublish` | course staff | published → draft, only while nobody has started it; otherwise `409` (`details.reason: 'has-submissions'`, "close it instead") |
| POST `/:id/publish` | course staff | validates (≥1 question, every objective question has an answer key that matches its options; else `400` with `details.problems: [..]`) → notifies the current roster (`assessment.published`) on the **first** publication only (`publishedAt` = first publication; re-publishing after unpublish/close does not notify again). `POST /` with `status: 'published'` publishes in the same call |
| POST `/:id/close` | course staff | stops new attempts |
| POST `/:id/duplicate` | course staff | copy as draft |
| POST `/:id/release-results` | course staff | sets `resultsReleased`, notifies students who submitted (`results.released`) |
| GET `/:id/submissions` | course staff | `{ items: [{ id, student:{id,name,email}, attempt, status, score, maxScore, percentage, isPassed, startedAt, submittedAt, timeSpent, violationCount, plagiarismFlag, needsReview, overridden }], total }` (`?status=`) |
| POST `/:id/attempts` | student | `201`: starts (or returns the existing in-progress) attempt → `{ submission: { id, attempt, status, startedAt, deadlineAt, serverNow, answers, violationCount }, assessment: { ...student-safe incl. questions `[{ id, type, text, options, points, topic }]` (never keys/explanations), in questionOrder, options in the stored shuffle } }`. Enforces enrollment, status published, availability window, due date and maxAttempts; refusals are `409 CONFLICT` with `details.reason` as in `myStatus`. Resuming on another device returns the same submission, order and shuffle |

### Submissions `/api/submissions` (auth)
| GET `/mine` | student | finished submissions across courses (paginated, `?courseId=`; `?practice=true` only practice quizzes, `?practice=false` no practice quizzes, absent = both) → `{ items: [{ id, assessment:{id,title}, course:{id,title,color}, attempt, status, isPractice, submittedAt, timeSpent, released, score, maxScore, percentage, isPassed }] }` (scores `null` until released) |
| GET `/:id` | owner student or course staff | result view `{ id, assessment:{id,title,totalPoints,passingScore,resultsPolicy,showCorrectAnswers,isPractice}, course:{id,title}, student? (staff), attempt, status, startedAt, deadlineAt, submittedAt, timeSpent, released, integrity:{violationCount, terminated, events (staff)} }` plus, once released (always for staff, while `released` still reports the real state): `score, maxScore, percentage, isPassed, needsReview, override:{score\|null, comment, at}\|null, aiFeedback, topicBreakdown:[{ topic, pointsEarned, maxPoints, percentage }] (canonical topics, weakest first), questions:[{ id, type, text, options, points, topic, difficulty, answer, result:{isCorrect, pointsEarned, maxPoints, feedback, needsReview}, correctAnswer?, explanation? }]` and `plagiarism` (staff). Keys/explanations only for staff or when `showCorrectAnswers`. Released = `resultsReleased`, or policy `immediate`, or `after-due` once the due date passed. An in-progress attempt past its deadline is auto-submitted first |
| PATCH `/:id/answers` | owner student, in-progress | `{ answers }` autosave (merge per question; unknown question ids ignored) → `{ savedAt, saved }`; after `deadlineAt + 30 s` → `409` (`details.reason: 'deadline-passed'`) and the attempt is auto-submitted with what was saved |
| POST `/:id/events` | owner student, in-progress | `{ type: 'fullscreen_exit'\|'blocked_shortcut'\|'camera_lost'\|'tab_hidden'\|'paste'\|..., detail? }` → `{ violationCount, terminated }`; events are always counted (list keeps the latest 200); when `proctoring.enabled`, reaching `maxViolations` auto-submits what was answered with status `terminated` |
| POST `/:id/submit` | owner student | `{ answers? }` merged then graded → result view + `lateAnswersRejected`. Server time is authoritative: after `deadlineAt + 30 s` the sent answers are ignored and only autosaved answers are graded (`lateAnswersRejected: true`); `submittedAt`/`timeSpent` stop at the deadline. `409` if already submitted. Afterwards, in the background: plagiarism check of written answers (max 30 s, stored on the submission) and a `submission.received` notification to course instructors (at most 1 per assessment per instructor per hour; not for practice) |
| PATCH `/:id/grade` | course staff | `{ questionScores?: { [questionId]: points (0..max) }, overrideScore? (number, or null to clear), comment? }` manual (re)grade → recomputes totals (an override wins over the per-question sum), clears `needsReview`, audits `submission.grade`, notifies the student (`submission.graded`) → staff result view |

`aiFeedback.overallFeedback` is derived from the final points ("You scored 30% (3/10 points)"), counts partial credit,
follows manual grades and overrides, and says the score is provisional while any written answer needs review.

Grading (`services/gradingService.js`): multiple-choice compares option text (case-insensitive; letters/indexes accepted);
multiple-select needs the exact set; true/false accepts `true`/`"True"`/`"T"` (any case); short-answer is correct on an
exact match with an accepted answer, otherwise it gets a provisional length-based score; essays always get the
length-based score. Provisional scores are marked `needsReview: true`. Pass = percentage >= the assessment's `passingScore`.

### Question bank `/api/question-bank` (auth, staff)
`GET /` (`?courseId&topic&type&difficulty&tag&q`, paginated, plus `topics` for filters), `POST /` (one question, or
`{ courseId?, items:[...] }` up to 200), `PATCH /:id` (incl. `courseId` / `tags`), `DELETE /:id`,
`POST /import-to/:assessmentId` `{ ids:[...] }` → `{ added, questionCount, totalPoints }` (appends in the given order;
`409` once the assessment has submissions). Instructors see workspace-wide items (`course: null`) and items of courses
they teach; owners/admins see all. Every item in a response has `usageCount` = number of non-practice, non-archived
assessments in the workspace containing a question with the same text (counts imports and questions saved to the
bank from an assessment). Course items get the course's canonical topic.

### Analytics `/api/analytics` (auth)
| GET `/overview` | staff | `{ totals: { courses, students, assessments, submissions30d }, averageScore, passRate, trend: [{ week (Monday, UTC, 'YYYY-MM-DD'), submissions, averageScore }] (last 8 weeks), atRiskStudents: [{ id, name, email, courseId, courseTitle, averageScore, gradedAssessments, reasons: ['low-average'\|'terminated-attempt'] }] (max 20), upcomingDeadlines: [{ id, title, courseId, courseTitle, dueDate, submitted, enrolled }] (next 14 days), recentSubmissions: [{ id, student:{id,name}, assessment:{id,title}, courseId, courseTitle, percentage, isPassed, status, needsReview, submittedAt }] (last 10) }` |
| GET `/courses/:id` | course staff | `{ summary: { students, gradedStudents, averageScore, passRate }, topicMastery: { topics:[..], students:[{ id, name, mastery: { [topic]: percent\|null } }] }, assessmentSummaries:[{ id, title, status, dueDate, submissions, enrolled, averageScore, median, highest, lowest, passRate }], scoreDistribution:[{ bucket:'0-9', count }], atRiskStudents:[...] }` |
| GET `/assessments/:id` | course staff | `{ summary: { submissions, attempts, averageScore, median, highest, lowest, passRate, averageTime (s) }, distribution:[...], items:[{ questionId, text, topic, type, points, difficultyIndex (p-value 0-1), discriminationIndex (-1..1), averagePoints, flag: 'too-easy'\|'too-hard'\|'poor-discrimination'\|null }], integrity: { flagged, terminated, averageViolations } }` |
| GET `/me` | student | `{ courses:[{ id, title, color, completed, total, averageScore }], topicMastery:{ [topic]: percent }, recent:[{ id, assessment, course, isPractice, status, released, percentage, submittedAt }], upcoming:[{ id, title, courseId, courseTitle, dueDate, attempts, attemptsRemaining, inProgress }], streakDays }`; `upcoming` = published, non-practice assessments in enrolled courses that the student can still start or resume right now (open, not past due, attempts left or an attempt in progress), sorted by due date (no due date last), max 20 |

**Scoring basis (everywhere a score average or pass rate is shown)** (`services/scoring.js`): one data point per
student per assessment = that student's **best graded attempt** (the official grade, override included): finished
(`submitted`/`terminated`) attempts at published/closed, non-practice assessments, current roster only (active
enrollment, account not deactivated). Averages use unrounded percentages and are rounded once, half up, to 1 decimal.
- Assessment level (assessment analytics `summary`, course `assessmentSummaries`, staff assessment list `averageScore`):
  mean of the students' best attempts; pass rate = share of those best attempts that passed.
- Student level (gradebook row `average`, roster `averageScore`, at-risk `averageScore`, student `/me` and course
  `progress`): mean of the student's best attempts.
- Class level (course analytics `summary`, staff course list `averageScore`, overview `averageScore`/`passRate`): mean
  of the student-level averages (per student per course); pass rate = share of students whose average reaches the
  average pass mark of the assessments they were graded on. `gradedStudents` = students with at least one graded attempt.
- Item analysis, distributions, topic mastery and the trend's weekly average use the same best attempts (the trend
  counts every finished attempt for `submissions`).

Topic mastery = points earned / points possible on that (canonical) topic's questions. Item analysis needs at least 5
submissions (else `null`): difficulty = mean fraction of the item's points earned; discrimination = mean item fraction
of the top 27 % (by total score) minus the bottom 27 %; flags: difficulty > 0.9 `too-easy`, < 0.3 `too-hard`, otherwise
discrimination < 0.2 `poor-discrimination`; both indexes are rounded to 2 decimals before the flags are decided, so a
reported value always agrees with its flag. Integrity figures count every finished attempt. At risk = average < 50 %
over at least 2 graded assessments, or a terminated attempt in the last 30 days (current roster only).
Student-facing numbers (`/me`, learning path) only include results the student is allowed to see.

### Adaptive learning `/api/learning-path` (auth, student)
`GET /:courseId` → `{ courseId, overallMastery|null, level: 'beginner'(<50 or no data)|'intermediate'(50–79)|'advanced'(≥80), topics: [{ topic, mastery|null, status: 'mastered'(≥80)|'developing'(50–79)|'needs-work'(<50)|'not-assessed', attempts (graded questions on the topic) }], recommendations: [{ topic, tips:[String], resources:[{ title, type: 'video'|'reading'|'exercise'|'quiz' }], source: 'ai'|'template' }], recommendationsStatus: 'ai'|'pending'|'fallback', nextAssessment: { id, title, dueDate }|null }`
Topics = canonical course topics + any other topic used by its questions. Mastery uses the best graded attempt of each
(non-practice) assessment whose results the student can see. Recommendations cover up to 3 weakest topics (or
not-assessed topics when nothing is weak). The endpoint never waits for AI (responds in well under 1.5 s): on a cache
miss it returns template recommendations with `recommendationsStatus: 'pending'` and starts one Gemini call in the
background (20 s bound; concurrent requests share it). The result is cached in memory per student + course +
weak-topic set: `'ai'` for 6 h, or `'fallback'` (templates) for 10 min when AI failed or is not configured. Clients
re-fetch while `pending`. Not metered.
`POST /:courseId/practice` `{ topics?:[..], questionCount? (5–15, default 8) }` → `201 { assessmentId, questionCount, topics, generatedBy: 'ai'|'fallback' }`.
Default topics: the student's weakest non-mastered topics (max 3). Consumes 1 AI generation first (`402` when the quota
is used up) and refunds it when AI was unavailable. The quiz always has `questionCount` questions: AI questions (if at
least half could be generated), topped up in this order with auto-gradable questions (objective, or short answer with a
key) from question-bank items tagged `practice` (case-insensitive; course and workspace-wide items; chosen topics first,
then any topic; untagged bank items are never shown to students), then from
the course's closed or past-due assessments (chosen topics first, then any; never live assessments), then distinct
open-ended prompts per topic (short answer / essay, no key). Saved as an
`Assessment` with `isPractice: true, practiceFor: <student>, source: 'practice', status: 'published', maxAttempts: 10,
resultsPolicy: 'immediate', showCorrectAnswers: true, proctoring.enabled: false`; visible only to that student and
excluded from staff lists, gradebook, analytics and at-risk.

### AI tools `/api/assessment/*` (staff)
| POST `/upload-syllabus` | multipart `file` (PDF/DOC/DOCX/TXT, 10 MB) → `{ success, syllabusContent, fileName }`; rate limited, not metered |
| POST `/analyze-syllabus` | `{ syllabusContent }` (≥ 50 chars) → `{ success, syllabusAnalysis, analysisId, syllabusTopics: [String] }`; metered. Topics come from the AI, else the analysis' key topics, else a text extractor (headed / numbered / bulleted / line-separated lists); always split into single topics, numbering stripped, de-duplicated, junk and lines over 80 chars dropped, max 15 |
| GET `/syllabus/list`, GET `/syllabus/:id` | cached analyses (in memory) |
| POST `/generate-questions` | `{ syllabusAnalysis, pattern }` (`pattern.isQuickQuiz` for a quick quiz) → `{ success, assessment: { title, questions: [...] } }`; metered. Every question has `text`/`type` (canonical types) as well as the older `question`/`questionType` |
| GET `/templates/:courseId` | static assessment templates; not metered |

All are staff-only and rate limited per user (20/min); metered calls consume 1 AI generation (402 on quota). The
earlier `iterate-quiz` stub and all legacy persistence endpoints (`/api/assessment/save|submit|student/*|results/*|course/*`,
`/api/instructor/*`, `/api/student/assessment/*`, `/api/adaptive-learning/*`, `/api/curriculum/*`) have been removed.

## 6. Security & operations

- `helmet`, `compression`, JSON body limit 2 MB (uploads via multer, 10 MB, PDF/DOCX/TXT only).
- CORS allowlist from `CORS_ORIGINS` (comma separated; default `http://localhost:3000`).
- Rate limits: auth endpoints 20 / 15 min / IP; AI endpoints 20 / min / user; everything else 600 / 15 min / IP.
- Production refuses to boot without `JWT_SECRET` (≥ 32 chars) and `MONGO_URI`.
- Server-side shared helpers (all routes use these):
  - `middlewares/auth`: `requireAuth`, `optionalAuth`, `requireRole(...roles)`, `invalidateUserCache(userId)`, `STAFF_ROLES`, `ADMIN_ROLES`.
    `req.user = { id, role, organization, name, email }` (strings; role/workspace read from the DB, cached 30 s).
    `requireRole` follows the hierarchy: allowing `instructor` also allows admin/owner; allowing `admin` also allows owner; `student` is exact.
    The module itself is callable as `requireAuth` for legacy routes.
  - `middlewares/rateLimits`: `authLimiter`, `generalLimiter`, `aiLimiter` (use after `requireAuth`).
  - `utils/errors`: `AppError(status, code, message, details)`, `badRequest`, `unauthenticated`, `forbidden`, `notFound`, `conflict`,
    `tooManyRequests`, `serviceUnavailable`, `planLimit(details)`, `asyncHandler(fn)`.
  - `utils/validate`: `requireFields`, `isEmail`, `normalizeEmail`, `oneOf`, `clampInt`, `str`, `assertPassword`, `assertObjectId`, `pagination`, `escapeRegex`.
  - `utils/serialize`: `toJSONPlugin` (schema plugin) and `serialize(doc|lean, { hide })` — `_id` → `id`, no `__v`.
  - `services/plans`: `getLimits`, `currentPeriod`, `getUsage`, `assertSeatAvailable`, `consumeAi`, `releaseAi`, `meterAi`.
  - `services/notify`: `notify(userIds, payload, orgId)`, `notifyRoles(orgId, roles, payload)`; `services/audit`: `audit(req, action, opts)`.
- API responses carry `Cache-Control: no-store` and no `ETag` (no conditional 304s on per-user JSON).
- No auth bypasses of any kind. Request id (`x-request-id`) on every response; JSON structured logs.
- `GET /api/health` (liveness) and `GET /api/ready` (DB connected) for load balancers.
- Seed: `npm run seed` (backend) creates a demo workspace ("Northwind Institute of Technology") with an owner,
  2 instructors, 25 students, 3 courses, published assessments and realistic graded submissions.
  Demo logins are printed at the end and documented in README.
- Tests: `npm test` (backend) — Jest + Supertest against `MONGO_URI_TEST` (default `mongodb://127.0.0.1:27017/navigate_test`).

## 7. Frontend structure

- `src/api/client.js` — one axios instance (`/api` base, auth header, refresh-on-401, error normalisation to
  `{ code, message, details }`), plus resource modules `src/api/{auth,workspace,courses,assessments,submissions,analytics,learningPath,questionBank,notifications}.js`.
- Theme supports light and dark (`ColorModeContext`), persisted to `user.preferences.theme`.
- Shell: sidebar (role-aware), top bar with command palette (Ctrl/⌘+K), notification bell, user menu.
- Routes (all lazy):
  - Public: `/`, `/pricing`, `/login`, `/register`, `/join/:code`, `/forgot-password`, `/reset-password/:token`
  - Staff: `/app` (dashboard), `/app/courses`, `/app/courses/:id/(overview|assessments|students|gradebook|analytics|curriculum)`,
    `/app/assessments/new?courseId=`, `/app/assessments/:id/edit`, `/app/assessments/:id` (results & analytics),
    `/app/submissions/:id` (review & grade), `/app/question-bank`
  - Student: `/app` (dashboard), `/app/courses/:id`, `/app/courses/:id/learning-path`, `/app/take/:assessmentId`,
    `/app/results/:submissionId`, `/app/results` (history), `/app/join` (join a course)
  - Everyone: `/app/settings/(profile|workspace|members|billing|audit-log)` (tabs gated by role), `/app/notifications`
  - Old URLs (`/dashboard`, `/instructor/*`, `/course/:id`, `/assessment/:id`, `/results/:id`, `/learning-path/:id`) redirect to the new ones.

## 8. Feature guide

Every user-facing feature is documented in `docs/FEATURES.md` with three short sections:
**What is it?**, **Why is it needed?**, **How does it work?** (plain English, for customers and sales).
