# Frontend: staff screens (instructors, admins, owners)

What the staff side of the Navigate web app does, written for a product owner. Code lives in
`frontend/src/pages/staff/*` (one file per screen) and `frontend/src/components/staff/**` (shared pieces:
question editor, AI generator, charts, dialogs, course and assessment tabs).

---

## Features

### Staff dashboard (`/app`)
- **What is it?** The home page for instructors and admins: a greeting, five headline numbers (students, active courses, submissions in the last 30 days, average score, pass rate), an 8-week trend, students at risk, upcoming deadlines, recent submissions and the getting-started checklist.
- **Why is it needed?** It answers "where does my attention go this week?" in one glance.
- **How does it work?** One call to the analytics overview fills the page. Trend charts are two side-by-side charts (submissions and average score) rather than one chart with two scales, so neither number is misread. Every list item links to the course, assessment or submission it describes.

### Courses (`/app/courses`)
- **What is it?** A card grid of the courses you teach (admins see all), with colour, code, term, counts and the join code.
- **Why is it needed?** It is the entry point to everything else and the place to create new classes.
- **How does it work?** Search is server-side and debounced; a switch shows archived courses. "New course" opens a dialog with title, code, term, colour swatches, description and topics. Clicking a join code copies it. Archiving and restoring ask for confirmation. `/app/courses?new=1` opens the create dialog directly (used by the command palette and onboarding).

### Course workspace (`/app/courses/:id/:tab`)
- **What is it?** One page per course with a header (join code, edit, invite) and six tabs whose name is in the URL, so links and the back button work.
- **Why is it needed?** Instructors run a class from here: students, assessments, grades, insight and curriculum.
- **How does it work?**
  - **Join code & invites:** the code can be copied, turned off/on, or regenerated (with a warning that the old code stops working). "Invite students" offers the code and a sign-up link, or adds existing workspace students by pasting emails; the result says who was added, already enrolled or not found.
  - **Overview:** course KPIs, score distribution, at-risk students, recent activity and what is due soon.
  - **Assessments:** table with status chips, due dates, submission counts and averages; each row has the actions that fit its status (edit, publish, close, release results, duplicate, archive), all confirmed first. Publishing problems are listed with a shortcut to fix them.
  - **Students:** sortable, searchable roster (average, submissions, last activity) with remove-with-confirmation. Owners/admins can add or remove co-instructors.
  - **Gradebook:** a students × assessments grid with frozen header and name column, colour-coded cells (passed, below pass mark, missing, in progress; terminated attempts carry a warning icon), class averages, click-through to each submission and CSV export.
  - **Analytics:** topic-mastery heatmap (one colour from light to dark, a legend, the number in each cell, hatched "not assessed" cells and a hover/focus tooltip) plus per-assessment statistics.
  - **Curriculum:** learning outcomes (code, description, Bloom level) and a tick-box grid mapping outcomes to assessments, with coverage counts. Changes are saved to the server together, with an "unsaved changes" bar.

### Assessment editor (`/app/assessments/new?courseId=…`, `/app/assessments/:id/edit`)
- **What is it?** A four-step editor: Details, Questions, Settings, Review & publish.
- **Why is it needed?** Building a good assessment is the core job of an instructor; the editor makes it fast and hard to get wrong.
- **How does it work?**
  - Drafts **save automatically** a second after you stop typing (the header shows "Saving…", "Saved just now" or "Not saved — Retry"). A new assessment becomes a draft as soon as it has a title and a course. Published assessments save only when you click "Save changes", and you are asked before leaving with unsaved work.
  - **Questions:** five types (multiple choice, multiple select, true/false, short answer with accepted answers, essay with a marking guide), each with points, topic (suggested from the course), difficulty, Bloom level and explanation. Questions can be reordered by dragging or with Move up/down, duplicated, deleted, saved to the question bank, and edited in bulk (topic, difficulty, points, delete, save to bank). Problems are flagged on the question itself.
  - **Generate with AI:** upload a PDF/Word/text syllabus or paste it, let AI find the topics, pick a suggested pattern, a template or a custom mix, then review the generated questions and add the ones you want. Long steps show progress, elapsed time and a Cancel button. If AI is busy the generator says so and the questions are template-based; if analysis fails you can continue with the course's own topics; if the monthly AI allowance is used up an upgrade prompt appears.
  - **Import from question bank:** searchable, filterable picker; selected questions are appended in order.
  - **Locked questions:** once a student has started, options, keys and points are locked (with an explanation); wording and explanations can still be fixed.
  - **Settings:** opening and due dates, time limit, attempts, pass mark, shuffling, results policy (immediately, after due date, when released), showing correct answers, proctoring (full screen, shortcut blocking, webcam, violation limit).
  - **Review & publish:** a checklist that mirrors the server's publish rules (title, course, at least one question, every objective question has a valid answer key, dates in order) plus advice (no due date, answers that will need manual review, questions without a topic). Each item links to where it can be fixed.

### Assessment results (`/app/assessments/:id/:tab`)
- **What is it?** A page per assessment with Overview, Submissions, Item analysis and Integrity tabs.
- **Why is it needed?** It shows how the class did, which questions worked and whether anything suspicious happened.
- **How does it work?** Overview shows KPIs, the score distribution (bars below the pass mark in red) and the settings. Submissions lists every attempt with status, score, time, violations, similarity flag and a "needs review" badge, with filters and search. Item analysis shows each question's difficulty and discrimination with plain-English tooltips and flags ("too easy", "too hard", "doesn't separate") explaining what to do. Integrity lists flagged attempts; expanding one shows a timeline of what happened and when.

### Submission review (`/app/submissions/:id`)
- **What is it?** One student's attempt, question by question, with the grading panel.
- **Why is it needed?** Written answers need a human; instructors need the final say on any score.
- **How does it work?** Each question shows the student's answer against the key (choices are marked "Student's answer" and "Correct"), the auto-grader's result and a points box. Answers awaiting review are highlighted. Instructors can change points, override the total and leave a comment; saving notifies the student. The attempt timeline, similarity result and automatic feedback are shown alongside, and Previous/Next moves through the class.

### Question bank (`/app/question-bank`)
- **What is it?** A shared library of reusable questions.
- **Why is it needed?** Good questions get reused instead of rewritten each term.
- **How does it work?** A paginated table filtered by course, topic, type, difficulty, tag and text. Questions are created and edited with the same editor as in assessments, can belong to a course or the whole workspace, carry tags, and can be deleted (with confirmation) or added to any draft assessment — one at a time or in bulk.

---

## Notes for developers
- All API calls go through `src/api/*` (F1). Pages use `components/staff/useApiData` for load/error/retry and run independent requests in parallel.
- Shared helpers: `staffUtils.js` (formatting, question rules mirroring `backend/services/questions.js`), `StaffUI.js` (cards, chips, skeletons), `charts.js` (theme-driven Chart.js setup), `useAssessmentActions.js` (lifecycle actions with confirmations), `useNavigationGuard.js` (unsaved-changes guard that works with `<BrowserRouter>`).
- Course accent colours offered in the course dialog are stored on the course as data (`COURSE_COLORS` in `staffUtils.js`); all UI colours come from the theme.
- The legacy `src/pages/instructor/**` and `src/components/instructor/**` were removed; their AI-syllabus flow was rebuilt as `components/staff/editor/AiQuestionGenerator.js`, and curriculum mapping now persists to the API.

## Refinements (design review round 1)
- **Archived assessments & revert to draft:** the course Assessments tab has an "Archived" filter; archived assessments can be restored as drafts, and a published assessment nobody has started can be reverted to draft (once a student starts, the app explains it must be closed instead).
- **Breadcrumbs:** course, assessment, editor and submission pages put the real course/assessment/student name in the top bar (the separate back links were removed).
- **Phones:** wide tables (assessments, roster, submissions, question bank) become stacked cards; the course header collapses join code and Edit into a "…" menu; the editor shows "Step n of 4" with a step picker; overview stat cards drop their icons so labels fit.
- **Charts:** heatmap text colour is chosen by measured contrast; every histogram bucket is labelled; item-analysis bars are green/amber/red by quality; dark-mode bars use a brighter blue; the gradebook legend lists only the states that appear.
