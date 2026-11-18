# Navigate — Feature Guide

Plain-English guide to every feature in Navigate, for customers, sales and the product team.
Each feature has three parts: **What is it?**, **Why is it needed?**, **How does it work?**

Navigate is an assessment and adaptive-learning platform for institutions (colleges, training
institutes, corporate learning teams). Instructors build and run assessments, students take them,
and Navigate turns the results into grades, insight and personal study plans.

Contents: [Platform & workspaces](#platform--workspaces) · [Security & reliability](#security--reliability) ·
[Courses & enrollment](#courses--enrollment) · [Assessments](#assessments) ·
[Exam integrity (proctoring)](#exam-integrity-proctoring) · [Grading & results](#grading--results) ·
[Analytics & insights](#analytics--insights) · [Adaptive learning](#adaptive-learning) ·
[Team, settings & billing](#team-settings--billing) · [Experience & design](#experience--design) ·
[Known limitations](#known-limitations)

---

## Platform & workspaces

### Private workspace for every institution
**What is it?** Each customer gets its own workspace that holds its people, courses, assessments and results.
**Why is it needed?** Many institutions share one Navigate service, and none of them may ever see another's data.
**How does it work?** Every record belongs to one workspace and every request is limited to the signed-in person's workspace. Asking for something that belongs to another workspace simply says "not found".

### Role-based access (owner, admin, instructor, student)
**What is it?** Four roles decide what each person can see and do. Owners and admins manage the workspace and people, instructors run their courses, and students take assessments.
**Why is it needed?** Staff and students need very different tools, and sensitive actions (billing, members) must be limited to the right people.
**How does it work?** Each person has one role, and the menus and pages shown match it. The server checks the role on every action, so hiding a button is never the only protection.

### Sign up: create a workspace or join one
**What is it?** A new person either creates a workspace (and becomes its owner) or joins an existing one with an invite link or a course join code.
**Why is it needed?** An institution can start on its own in a minute, and staff and students can join without anyone typing in accounts by hand.
**How does it work?** An invite link decides the person's role. A course join code makes them a student and enrolls them in that course straight away. Before sign-up, the page previews what they are joining ("You're joining Northwind as an instructor"), and the plan's seat limits are checked first.

### Sign in, forgot password and sessions
**What is it?** Email-and-password sign-in, a "forgot password" flow, and sessions that renew quietly in the background.
**Why is it needed?** People should stay signed in comfortably while accounts stay safe.
**How does it work?** A sign-in gives a short-lived pass (15 minutes) that is renewed automatically for up to 7 days, and signing out cancels it. If a session does expire, the person sees "Your session has expired" and returns to the page they were on after signing in. A reset link is single-use and valid for one hour.

### Profile and password
**What is it?** People can edit their name, choose a theme (light, dark or match my device) and change their password.
**Why is it needed?** Basic personalisation, and a quick fix if a password is exposed.
**How does it work?** The theme is saved to the account and follows the person to other devices. Changing or resetting a password signs out every other session. New passwords need at least 8 characters with a letter and a number.

### Notifications
**What is it?** A bell with an unread count and a Notifications page for events such as "assessment published", "results released", "new submission", "someone joined" and "AI allowance reached".
**Why is it needed?** People notice what changed without checking every page.
**How does it work?** Notifications are stored per person, newest first, and can be marked read one at a time or all at once. The app checks for new ones about once a minute, groups them by day and deletes them automatically after 90 days. Instructors get at most one "new submission" notice per assessment per hour, so a class of 200 does not create 200 alerts.

### Onboarding checklist
**What is it?** A "Set up your workspace" card for staff: create a course, share its join code, create an assessment, publish it, invite a colleague.
**Why is it needed?** New customers need a clear path to their first success.
**How does it work?** Progress is worked out from what already exists in the workspace, so steps tick themselves off. The card can be hidden and disappears once everything is done.

### Demo data
**What is it?** One command creates a ready-made demo institution ("Northwind Institute of Technology") with people, courses, assessments and graded results.
**Why is it needed?** Sales demos, screenshots and training need realistic data.
**How does it work?** It rebuilds only the demo workspace (an owner, 2 instructors, 25 students, 3 courses, 11 assessments and about 110 graded submissions, including at-risk students and an integrity incident). It never touches other workspaces and produces the same data every time.

---

## Security & reliability

### Protection against password guessing
**What is it?** Accounts lock for 15 minutes after 5 wrong passwords, and sign-in attempts are rate limited.
**Why is it needed?** It stops attackers from trying thousands of passwords.
**How does it work?** The server counts failed attempts per account and per network address and tells the person how long to wait. Passwords are stored only in scrambled form.

### Traffic limits and safe defaults
**What is it?** Limits on how fast anyone can call the service (sign-in, AI features and general traffic), security headers, and a list of approved web addresses that may use the service.
**Why is it needed?** A hosted service must resist abuse and never leak internal details.
**How does it work?** Sign-in is limited to 20 attempts per 15 minutes per address, AI actions to 20 a minute per person, and everything else to 600 per 15 minutes. Error messages never reveal internals, and logs never contain passwords or tokens. In production the service refuses to start if its secrets are missing or weak.

### Audit log
**What is it?** A history of important actions in the workspace: who did what, and when.
**Why is it needed?** Institutions need accountability and evidence for compliance and grade disputes.
**How does it work?** Workspace creation, joins, role changes, removals, invites, plan changes, password changes and grade changes are recorded with the person's name and network address. Owners and admins browse it in Settings, in plain language, with filters. Entries are kept for one year.

### Health checks and graceful shutdown
**What is it?** Status addresses that tell a hosting platform whether the service and its database are healthy.
**Why is it needed?** Load balancers and hosting platforms restart or route around unhealthy services automatically.
**How does it work?** One check says the server is running; another says the database is connected. Every response carries a request ID that matches a log line, which speeds up support. On shutdown the server finishes in-flight requests first.

### Friendly failure screens
**What is it?** A crash screen with a Reload button and report ID, a "page not found" screen, an offline banner and clear messages instead of raw errors.
**Why is it needed?** Errors happen. People should never face a blank page or technical text.
**How does it work?** If one page crashes, the rest of the app keeps working. Losing the connection shows a banner until it returns, and failed requests turn into short, plain explanations.

### Workspace isolation and existing accounts
**What is it?** Strict separation of customer data, and automatic upgrade of accounts created before workspaces existed.
**Why is it needed?** Separation is a basic requirement for institutional buyers, and existing users must not be locked out.
**How does it work?** Every query is filtered by workspace, and students only ever see their own submissions. Older accounts are placed in a shared "Default Workspace" at their next sign-in and keep their passwords.

---

## Courses & enrollment

### Courses
**What is it?** A course is a class an institution runs (for example "Database Systems") with instructors, students, topics and learning outcomes.
**Why is it needed?** Everything students do (assessments, grades, analytics) belongs to a course.
**How does it work?** Instructors create courses from a card grid (title, code, term, colour, description, topics) and become the course's first instructor. Instructors see the courses they teach, admins and owners see all of them, and students see the ones they are enrolled in. Deleting a course archives it, so no history is lost, and it can be restored.

### Course join codes
**What is it?** A short 6-character code that students type to join a course.
**Why is it needed?** It fills a class without typing in every email address.
**How does it work?** Every course gets a unique code that avoids look-alike characters (no 0/O or 1/I). Students enter it on the "Join a course" page or at sign-up, and pasted codes work even with spaces or dashes. Instructors can copy it, switch it off, or generate a new one (the old code then stops working). A student whom the instructor removed cannot rejoin by themselves.

### Class roster and adding students by email
**What is it?** The list of students in a course, with each student's average score, number of submissions and last activity.
**Why is it needed?** Instructors need to see who is active, add or remove people and spot students falling behind.
**How does it work?** Instructors can paste a list of email addresses to enroll people who already have a workspace account (anyone not found is reported back), or remove a student after confirming. The roster can be searched and sorted.

### Co-instructors
**What is it?** Several instructors can share a course.
**Why is it needed?** Courses are often taught by teams.
**How does it work?** Owners and admins add or remove co-instructors, who then have full access to the course. A course always keeps at least one instructor.

### Curriculum mapping
**What is it?** A course's learning outcomes (for example "Design normalised schemas") linked to the assessments that measure them.
**Why is it needed?** Accreditation and programme reviews ask institutions to show which assessment covers which outcome.
**How does it work?** Instructors list outcomes with a code, description and Bloom level, then tick which assessments cover each. A grid shows coverage, and changes are saved together with an "unsaved changes" reminder.

### Instructor and student course pages
**What is it?** A course workspace for instructors (Overview, Assessments, Students, Gradebook, Analytics, Curriculum) and a simpler page for students.
**Why is it needed?** Instructors run a class from one place, and students see exactly what to do next.
**How does it work?** Each tab has its own web address, so links and the Back button work. The student page groups assessments into Open now, Upcoming, Completed and Closed, shows attempts used and best score (or "Pending" until results are released), and explains why something cannot be started (opens later, past due, no attempts left, closed).

---

## Assessments

### Assessment builder
**What is it?** A four-step editor (Details, Questions, Settings, Review and publish) for quizzes and exams with five question types: multiple choice, multiple select, true/false, short answer and essay.
**Why is it needed?** Building a good assessment is the instructor's main job, and the builder makes it fast and hard to get wrong.
**How does it work?** Each question has points, topic, difficulty, a thinking-skill level and an explanation. Questions can be reordered by dragging, duplicated, deleted, edited in bulk and saved to the question bank, and problems are flagged on the question itself. Drafts save automatically a second after you stop typing, and the editor warns before you leave with unsaved work.

### Assessment settings
**What is it?** Controls for opening and due dates, time limit, number of attempts, pass mark, shuffling of questions and answers, when results are shown, whether correct answers are shown, and proctoring.
**Why is it needed?** Different assessments need different rules, from a relaxed weekly quiz to a strict final exam.
**How does it work?** The settings are chosen in the builder and enforced by the server when students take the assessment.

### Publishing checklist and lifecycle
**What is it?** A pre-publish checklist and clear states: draft, published, closed and archived.
**Why is it needed?** It prevents students from receiving a broken test and keeps old work organised.
**How does it work?** The checklist checks for a title, a course, at least one question, a valid answer key on every objective question and sensible dates, and each problem links to where it can be fixed. Publishing notifies enrolled students. Instructors can also close, duplicate, archive and restore assessments, and un-publish one that nobody has started.

### Locked questions once students start
**What is it?** After the first student starts, the questions, answer options, answer keys and points are locked. Wording and explanations can still be fixed.
**Why is it needed?** Nobody should be graded against a test that changed while they were taking it.
**How does it work?** The builder explains the lock and the server enforces it.

### Generate questions with AI
**What is it?** Upload a syllabus (PDF, Word or text) or paste its text, and Navigate finds the topics and drafts questions.
**Why is it needed?** It cuts the time to build an assessment from hours to minutes.
**How does it work?** The instructor picks a suggested pattern, a template or a custom mix, then reviews the generated questions and adds the ones they want. Long steps show progress and a Cancel button. If AI is busy or unavailable, topics are still extracted from the text and the questions come from templates, and the screen says so. Each analysis or generation uses one of the workspace's monthly AI generations.

### Question bank
**What is it?** A shared library of reusable questions.
**Why is it needed?** Good questions get reused instead of rewritten every term.
**How does it work?** Questions belong to one course or to the whole workspace, carry topic, difficulty and tags, and can be searched and filtered. Selected questions are copied into a draft assessment, one at a time or in bulk. Tagging a question "practice" also makes it available for student practice quizzes.

### Taking an assessment
**What is it?** A focused full-page exam screen for students, with a clear rules screen before starting, a question map, flagging for review and a review dialog before submitting.
**Why is it needed?** Students need a calm place to work, and institutions need a fair, tamper-resistant test.
**How does it work?** Before starting, the student sees the time limit, attempts, pass mark, results policy and any proctoring rules. During the test they can flag questions, jump between them with the question map and use the keyboard (arrow keys to move, 1 to 9 to choose an option). The review dialog shows answered, unanswered and flagged questions. A guard prevents double submissions, and the Back button cannot reopen a submitted test. Friendly screens explain why a test cannot be started yet, is past due, has no attempts left or is closed.

### Server-kept timer and attempts
**What is it?** The server, not the student's computer, keeps the official clock and the record of every attempt.
**Why is it needed?** Students cannot gain time by changing their computer's clock, and they can continue on another device if their laptop dies.
**How does it work?** The end time is fixed when the attempt starts (the time limit, but never later than the due date). The student sees a countdown with warnings at 5 and 1 minutes, and the test is submitted automatically when time is up. Restarting a test in progress returns the same attempt with the same question and answer order. Students never receive answer keys or explanations while the test is open.

### Autosave
**What is it?** Answers are saved continuously while a student works.
**Why is it needed?** A crash, closed tab or lost connection must not cost a student their work.
**How does it work?** Answers are saved about a second and a half after each change, when leaving a text box and when changing question, and a small status shows "Saving", "Saved" or "Offline — will retry". Failed saves retry automatically when the connection returns, and a backup copy is kept on the device. After the time is up (with 30 seconds of grace for slow networks) the attempt is submitted with what was saved.

---

## Exam integrity (proctoring)

### Proctoring rules
**What is it?** Optional rules for an assessment: stay in full screen, stay on the page, no copy, paste or reload shortcuts, and keep the camera on.
**Why is it needed?** Institutions need a deterrent against cheating and evidence for academic-integrity decisions.
**How does it work?** The instructor switches on the rules they want and sets how many warnings are allowed (5 by default). Students see the rules before they start and must tick "I agree" for graded tests.

### Violation tracking and automatic end
**What is it?** Each suspicious event (leaving full screen, switching tabs, blocked shortcuts, pasting, losing the camera) is counted and shown to the student as a warning count such as 2 of 5.
**Why is it needed?** Students get a fair warning, and instructors get a clear record.
**How does it work?** The browser reports each event and the server keeps the official count. When proctoring is on and the limit is reached, the attempt ends, is marked "terminated" and is still graded on what was answered. A "Return to full screen" panel covers the questions until the student goes back to full screen. Events are recorded even when proctoring is off, but then they never end the attempt.

### Camera check
**What is it?** A live camera check before the test when the instructor requires a camera.
**Why is it needed?** It confirms the student's camera works before the clock starts, and a lost camera during the test counts as a warning.
**How does it work?** The camera preview stays on the student's device. Navigate does not record or upload video; it only reports when the camera is lost.

### Plagiarism check
**What is it?** A similarity check of written answers against other students' answers to the same assessment.
**Why is it needed?** It helps instructors spot copied work.
**How does it work?** After submission, short answers and essays are checked in the background, so the student never waits. The result is stored with the submission and flagged in the instructor's list. It compares students within the same assessment and is a guide for a human decision, not proof.

### Integrity review for instructors
**What is it?** An Integrity tab per assessment and an event timeline on each submission.
**Why is it needed?** Instructors can quickly find flagged attempts and see exactly what happened.
**How does it work?** The tab lists flagged and terminated attempts with violation counts, and expanding one shows what happened and when.

---

## Grading & results

### Automatic grading
**What is it?** Instant scoring of every answer when a student submits.
**Why is it needed?** It saves instructors hours and gives students fast feedback.
**How does it work?** Multiple choice and true/false answers are marked exactly, and multiple select needs exactly the right set. A short answer that matches an accepted answer is marked correct. Other short answers and essays get a provisional score and a "needs review" flag so the instructor confirms them. The pass or fail result uses the assessment's pass mark.

### Manual grading and overrides
**What is it?** Instructors can change the points for any question, set the final score and leave a comment.
**Why is it needed?** Automatic grading of written answers is only a first pass, and instructors need the final say.
**How does it work?** On the submission page each question shows the student's answer next to the key and a points box. Changing points recalculates the total and pass or fail and clears "needs review". An overall override replaces the total until cleared. The student is notified, the change is written to the audit log, and Previous and Next buttons move through the class.

### Results release control
**What is it?** Control over when students see their scores and whether they see the correct answers.
**Why is it needed?** Instructors often want to hide results until everyone has finished or essays are reviewed, so answers do not leak to students still taking the test.
**How does it work?** Each assessment shows results immediately, after the due date, or only when the instructor clicks "release" (students are then notified). Until then students only see that their work was received. Correct answers and explanations appear only if the instructor allows it.

### Student results and history
**What is it?** A result page for each attempt and a history of all of a student's submissions.
**Why is it needed?** Feedback is where learning happens, and clear feedback builds trust in the grading.
**How does it work?** Once released, the result page shows a score ring, pass or fail, points, time spent, attempt number, any instructor adjustment, a breakdown by topic, next steps with a one-click "Practise weak topics" button, a summary of integrity warnings and a question-by-question review. The history page filters by course, status and type, and the filters can be shared as a link.

### Submissions list for instructors
**What is it?** A table of every attempt on an assessment with status, score, time, violations, similarity flag and a "needs review" badge.
**Why is it needed?** Instructors can see at a glance which attempts need attention.
**How does it work?** The table can be filtered and searched, and each row opens the submission for review and grading.

### Gradebook and CSV export
**What is it?** A table of every student's score on every assessment in a course, downloadable for Excel.
**Why is it needed?** It is the record instructors use for final grades and for uploading to student information systems.
**How does it work?** Each cell shows the student's best attempt, or "missing" when the due date passed with nothing submitted. Colours show passed, below pass mark, missing and in progress, and terminated attempts carry a warning icon. The download opens correctly in Excel, including accented names, and is protected against spreadsheet formula tricks. Practice quizzes never appear.

---

## Analytics & insights

### Staff dashboard
**What is it?** An overview of all of an instructor's courses: students, active courses, recent submissions, average score, pass rate, an 8-week trend, upcoming deadlines, recent submissions and students at risk.
**Why is it needed?** It answers "where does my attention go this week?" in one glance.
**How does it work?** The numbers are calculated live from finished, non-practice submissions in the courses the viewer manages. Submissions and average score are shown in two separate charts so neither is misread, and each item links to the course, assessment or submission it describes.

### Course analytics and topic mastery heatmap
**What is it?** A grid of each student against each topic, plus per-assessment summaries and a score distribution.
**Why is it needed?** It shows which topics the class struggles with, so teaching can be adjusted.
**How does it work?** A student's mastery of a topic is the points they earned on that topic's questions divided by the points available, using their latest attempt on each assessment. Darker cells mean higher mastery, topics not yet assessed are hatched, and hovering shows the exact number.

### Question analysis
**What is it?** Statistics for each question showing how hard it was and how well it separates strong from weak students.
**Why is it needed?** It finds broken, too-easy or too-hard questions so instructors can improve their tests.
**How does it work?** Once at least 5 students have submitted, each question gets a difficulty and a "separates strong from weak" measure, with plain-English tooltips. Questions are flagged "too easy", "too hard" or "doesn't separate" with advice on what to do.

### Assessment analytics
**What is it?** An Overview page per assessment with the score summary (average, median, highest, lowest, pass rate, average time) and a score distribution.
**Why is it needed?** It shows how the class did on a particular test.
**How does it work?** Bars below the pass mark are shown in red, next to the assessment's settings.

### At-risk students
**What is it?** A list of students who may fail or who had an integrity problem.
**Why is it needed?** Early intervention is the most effective way to improve pass rates and retention.
**How does it work?** A student is flagged when their average is below 50% across at least two graded assessments, or when one of their attempts was terminated in the last 30 days. Each entry says why.

### Student dashboard
**What is it?** A student's home page: a greeting, what is due next, their courses, recent results, topic strengths and a daily streak.
**Why is it needed?** Students should know in seconds what to do today and how they are doing. A student with no courses is invited to join one.
**How does it work?** "Up next" lists open assessments (unfinished attempts first, then by due date) with time left and a Start or Resume button. Only results the student is allowed to see are included, so unreleased grades never leak into charts.

---

## Adaptive learning

### Personal learning path
**What is it?** A personal study plan for each course: an overall level, a status for every topic (mastered, developing, needs work, not assessed) and study recommendations.
**Why is it needed?** It turns test results into concrete next steps for each student, which is Navigate's core promise.
**How does it work?** Mastery comes from the student's graded work (80% and above is mastered, 50 to 79% developing, below 50% needs work). For the weakest topics, AI writes study tips and suggested resources. If AI is unavailable or slow, ready-made tips are shown instead, so the page always works, and each tip is labelled "AI-generated" or "Suggested". The first visit can take up to about 20 seconds, so an animated placeholder is shown.

### Practice quizzes on weak topics
**What is it?** A one-click private quiz on the student's weakest topics.
**Why is it needed?** Students improve fastest by practising what they get wrong, without any effect on their grade.
**How does it work?** The student picks up to 5 topics (the weakest are pre-selected) and 5 to 15 questions. AI generates the questions, and anything it cannot provide is filled from instructor-approved practice questions, then from the course's past assessments, then from reflection prompts, so the quiz always has the requested length. Practice quizzes show answers immediately, are private to the student, are not proctored and never count in the gradebook or analytics. Each one uses one AI generation from the workspace allowance, refunded if AI was unavailable. If the allowance is used up, an upgrade prompt explains why.

---

## Team, settings & billing

### Members and roles
**What is it?** Owners and admins see everyone in the workspace and can change roles, deactivate people or remove them.
**Why is it needed?** Staff come and go, and access must follow.
**How does it work?** The Members page can be searched and filtered, and each change asks for confirmation. Changes take effect within seconds and the person is notified. Safeguards: a workspace always keeps at least one owner, admins cannot change owners, and nobody can lock themselves out. Removing someone also takes them out of their courses.

### Invite links
**What is it?** Shareable join links with a preset role, an expiry date and an optional use limit.
**Why is it needed?** It is the simplest way to bring a whole department or class in at once.
**How does it work?** An admin creates a link, copies it and shares it however they like, and can revoke it at any time. The invite page tells the invitee which workspace and role it is for before they sign up.

### Workspace settings
**What is it?** Settings to rename the workspace, choose a brand colour and decide whether students may sign up with a course code.
**Why is it needed?** Admins should manage their own workspace without asking support.
**How does it work?** Owners and admins change these in Settings. The brand colour appears on the workspace badge in the sidebar.

### Plans, limits and usage
**What is it?** Three plans (Free, Pro and Enterprise) with limits on staff seats, students and AI generations per month.
**Why is it needed?** It is the commercial model: customers pay more as they grow and use more AI.
**How does it work?** Free allows 2 staff seats, 50 students and 25 AI generations a month. Pro allows 25 seats, 2,000 students and 1,000 generations. Enterprise is unlimited. Seats are checked whenever someone joins or changes role, each AI action uses one generation, and the count resets every month. Usage meters on the Billing page warn at 80%.

### Plan-limit prompts
**What is it?** A friendly "you've reached your plan's limit" message.
**Why is it needed?** Hitting a limit should explain what happened and how to fix it, not show an error.
**How does it work?** The message shows current usage and, for admins, a link to the Billing page. Owners are also notified when AI generations run out.

### Billing page (demo billing)
**What is it?** A page where owners compare plans and switch between them.
**Why is it needed?** Customers need a self-serve way to upgrade, and sales needs to see who wants to.
**How does it work?** In demo mode, plan changes apply instantly and no payment is taken, which is stated on the page. In production mode the change is recorded as a request, owners are notified and the customer is told that sales will be in touch. A downgrade is refused if the workspace has more people than the smaller plan allows. Real payment processing is not connected yet.

### Audit log page
**What is it?** The workspace history described under Security & reliability, shown as a page in Settings.
**Why is it needed?** Admins can answer "who changed this?" themselves.
**How does it work?** It is available to owners and admins, with filters and paging.

---

## Experience & design

### Light and dark themes
**What is it?** Light, dark or "match my device" themes.
**Why is it needed?** Comfort during long sessions and late-night study.
**How does it work?** Chosen from the user menu or Profile, saved to the account and applied before the page appears so there is no flash.

### Navigation, command palette and shortcuts
**What is it?** A role-aware sidebar, a top bar, and a command palette opened with Ctrl or Cmd plus K.
**Why is it needed?** Fast, predictable navigation for staff and students.
**How does it work?** The sidebar shows the workspace name, plan badge and the links for the person's role. The command palette jumps to pages, courses and recent assessments, or runs actions such as creating a course, creating an assessment or switching theme. Pressing "?" lists shortcuts such as G then D for the dashboard.

### Landing page and pricing
**What is it?** A public homepage and a pricing page.
**Why is it needed?** They explain the product to prospective institutions and show what each plan includes.
**How does it work?** The homepage covers who Navigate is for, the main features, how it works, a pricing teaser and FAQ. The pricing page shows plan cards, a comparison table and FAQ, and signed-in users see their current plan.

### Mobile and accessibility
**What is it?** Screens that adapt to phones and tablets, with keyboard and screen-reader support in key places.
**Why is it needed?** Students take tests and check results on phones, and institutions need accessible software.
**How does it work?** Tables become cards on small screens, the exam question map opens from a bottom bar, and charts include tooltips and legends rather than relying on colour alone. A formal accessibility audit has not been carried out.

---

## Known limitations

These are things Navigate does not do yet. Please do not promise them to customers.

- **Payments are not processed.** The Billing page is demo billing: in demo mode plan changes are instant and free, and in production mode they are recorded as requests for sales to follow up. There is no card payment, invoicing or tax handling.
- **Email is not sent.** Password-reset and similar emails are only written to the server log until an email provider is connected. During development the reset link is also shown on screen.
- **No single sign-on.** People sign in with email and password; there is no Google, Microsoft or SAML single sign-on.
- **AI depends on a third-party provider.** Syllabus analysis, question generation and study recommendations use Google Gemini. The free Gemini tier is slow and rate limited, so a paid key is recommended for real use. When AI is unavailable, template-based fallbacks are used.
- **Proctoring is browser-based.** It records events (full screen, tabs, shortcuts, paste, camera loss) but does not record video or audio, and a determined student on a second device cannot be detected. Treat it as a deterrent and evidence aid, not a guarantee.
- **Plagiarism check is limited.** It compares answers within the same assessment, not against the internet or published sources.
- **Branding is limited.** Workspaces can set a brand colour; logo upload and a fully branded experience are not available yet, even though the Enterprise plan lists "custom branding".
- **Single language.** The interface is in English only.
- **Compliance.** Navigate has not been independently certified for FERPA, GDPR or similar rules. Institutions should complete their own review and agreements before loading student data.
