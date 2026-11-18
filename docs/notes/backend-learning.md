# Backend: learning domain

What the learning side of the Navigate backend does, written for a product owner. The exact API contract is in
`docs/ARCHITECTURE.md` (§3 and §5); this note explains the features in plain English and lists what to run.

Code map: `backend/models/{Course,Enrollment,Assessment,Submission,QuestionBankItem}.js`,
`backend/api/{courses,assessments,submissions,questionBank,analytics,learningPath}.js`, the AI tools in
`backend/api/assessment.js`, and `backend/services/{access,questions,attemptService,gradebookService,analyticsService,learningPathService}.js`.

---

## Features

### Courses
- **What is it?** A course is a class an institution runs (for example "Database Systems"), with instructors, students, topics and learning outcomes.
- **Why is it needed?** Everything students do (assessments, grades, analytics) belongs to a course, so it is the main way work is organised.
- **How does it work?** Instructors create courses and become their first instructor. Owners and admins see and manage every course in the workspace; instructors see only the courses they teach; students see only the courses they are enrolled in. Deleting a course archives it so no history is lost.

### Join codes
- **What is it?** A short 6-character code (like `7PQ93S`) that students type to join a course.
- **Why is it needed?** It lets an instructor fill a class without typing in every email address.
- **How does it work?** Every course gets a unique code made of characters that cannot be confused (no 0/O or 1/I). Students of the workspace enter it to enrol; instructors can switch the code off or generate a new one, which makes the old code stop working. A student removed by the instructor cannot rejoin with the code on their own.

### Class roster and co-instructors
- **What is it?** The list of students in a course, and the list of instructors who teach it.
- **Why is it needed?** Instructors need to add or remove students, see who is falling behind, and share a course with colleagues.
- **How does it work?** Instructors add students by email (anyone not found in the workspace is reported back) and can remove them. The roster shows each student's average score, number of submissions and last activity. Owners and admins can add or remove co-instructors, who then have full access to the course.

### Curriculum mapping
- **What is it?** A course's learning outcomes (for example "Design normalised schemas") linked to the assessments that measure them.
- **Why is it needed?** Accreditation and programme reviews ask institutions to show which assessment covers which outcome.
- **How does it work?** Instructors edit the outcomes and their links on the course. Each outcome keeps a stable id, and links are checked so they can only point at this course's outcomes and assessments.

### Assessment authoring and publishing
- **What is it?** Creating quizzes and exams with five question types: multiple choice, multiple select, true/false, short answer and essay.
- **Why is it needed?** Assessments are the core of the product: they produce the grades and the data behind every insight.
- **How does it work?** Instructors write questions (or import them from the question bank or AI tools) and set the time limit, attempts, due date, pass mark, shuffling, results policy and proctoring. Drafts are private. Publishing checks that there is at least one question and every objective question has a valid answer key, then notifies the enrolled students. Once students have started, questions are locked (only wording fixes are allowed), so nobody is graded against a changed test. Assessments can be closed, duplicated, archived and restored; a published assessment nobody has started yet can be unpublished back to draft.

### Taking an assessment (server-side attempts)
- **What is it?** The server keeps track of every attempt: when it started, when it must end, which questions in which order.
- **Why is it needed?** Students cannot cheat the clock by changing their computer's time, and they can continue on another device if their laptop dies.
- **How does it work?** Starting an attempt checks enrolment, the availability window, the due date and the number of attempts allowed. The end time is fixed at the start (time limit, but never past the due date). If a student starts again while an attempt is open, they get the same attempt back with the same question and answer order. Students never receive answer keys or explanations while taking a test.

### Autosave
- **What is it?** Answers are saved to the server as the student works.
- **Why is it needed?** A crash, a closed tab or a lost connection must not cost a student their work.
- **How does it work?** Each save merges the new answers into the attempt. After the time is up (with 30 seconds of grace for slow networks) saves are refused and the attempt is submitted automatically with what was saved.

### Proctoring and integrity events
- **What is it?** A record of suspicious behaviour during a test, such as leaving full screen, switching tabs, pasting or losing the camera.
- **Why is it needed?** Institutions need evidence for academic-integrity decisions and a deterrent against cheating.
- **How does it work?** The browser reports each event; the server counts it and keeps the latest 200. When proctoring is on and the student reaches the limit set by the instructor (default 5), the attempt ends and is submitted as "terminated", still graded on what was answered. Instructors see the event timeline on the submission.

### Automatic grading
- **What is it?** Instant scoring of every answer when a student submits.
- **Why is it needed?** It saves instructors hours and gives students fast feedback.
- **How does it work?** Choice and true/false questions are marked exactly (multiple select needs exactly the right set). Short answers that match an accepted answer are marked correct. Other short answers and essays get a provisional score and are flagged "needs review" so the instructor can confirm it. The pass mark comes from the assessment.

### Results release and answer-key protection
- **What is it?** Control over when students see their score and whether they see the correct answers.
- **Why is it needed?** Instructors often want to hide results until everyone has finished, or until they have reviewed essays, so answers do not leak to students still taking the test.
- **How does it work?** Each assessment shows results immediately, after the due date, or only when the instructor clicks "release" (students are notified). Until then students only see that their work was received. Correct answers and explanations are shown only if the instructor allows it.

### Manual grading and overrides
- **What is it?** Instructors can change the points for any question or set the final score, with a comment.
- **Why is it needed?** Automatic grading of written answers is only a first pass, and instructors need the final say.
- **How does it work?** Changing question points recalculates the total and pass/fail and clears the "needs review" flag; an overall override replaces the total until it is cleared. Every change is recorded in the audit log and the student is notified.

### Plagiarism check
- **What is it?** A similarity check of written answers against other students' answers to the same assessment.
- **Why is it needed?** It helps instructors spot copied work.
- **How does it work?** After a submission, short answers and essays are checked in the background (never slowing the student down, and stopped after 30 seconds). The result is stored on the submission and flagged in the instructor's submission list.

### Instructor notifications
- **What is it?** Instructors are told when new work arrives.
- **Why is it needed?** They know when there is something to review without checking constantly.
- **How does it work?** Each instructor gets at most one "new submission" notification per assessment per hour, so a class of 200 does not create 200 alerts.

### Gradebook and CSV export
- **What is it?** A table of every student's score on every assessment in a course, downloadable for Excel.
- **Why is it needed?** It is the official record instructors use for final grades and for uploading to student information systems.
- **How does it work?** Each cell shows the student's best attempt, or "missing" when the due date passed with nothing submitted. The CSV opens correctly in Excel (including accented names) and neutralises spreadsheet formulas for security. Practice quizzes never appear.

### Question bank
- **What is it?** A shared library of reusable questions.
- **Why is it needed?** Instructors build better tests faster by reusing proven questions instead of rewriting them each term.
- **How does it work?** Questions can belong to a course or to the whole workspace, carry topics, difficulty and tags, and be searched and filtered. Selected questions are copied into an assessment (only before students start it), and each question counts how often it was used.

### Analytics: staff dashboard
- **What is it?** An overview across all of an instructor's courses: totals, average score, pass rate, an 8-week trend, upcoming deadlines, recent submissions and students at risk.
- **Why is it needed?** It shows at a glance where attention is needed this week.
- **How does it work?** Calculated live from finished, non-practice submissions in the courses the viewer manages.

### Analytics: course view
- **What is it?** A topic mastery heatmap (each student × each topic), per-assessment summaries and a score distribution.
- **Why is it needed?** It shows which topics the class as a whole is struggling with, so teaching can be adjusted.
- **How does it work?** Mastery for a topic is the points a student earned on that topic's questions divided by the points available, using their best graded attempt at each assessment. Topics are grouped under the course's own topic names, so "Queue Fundamentals" and "Queues" both count towards "queues".

### Analytics: assessment view (item analysis)
- **What is it?** Statistics for each question: how hard it was and how well it separates strong from weak students.
- **Why is it needed?** It finds broken, too-easy or too-hard questions so instructors can improve their tests.
- **How does it work?** With at least 5 submissions, the "difficulty index" is the average share of points students earned on the question, and the "discrimination index" compares the top 27% of students with the bottom 27%. Questions are flagged as too easy (above 0.9), too hard (below 0.3) or poorly discriminating (below 0.2). Also shows the score summary, the distribution and integrity statistics.

### At-risk students
- **What is it?** A list of students who may fail or who had an integrity problem.
- **Why is it needed?** Early intervention is the most effective way to improve pass rates and retention.
- **How does it work?** A student is at risk in a course when their average is below 50% across at least two graded assessments, or when one of their attempts was terminated in the last 30 days. Each entry says why.

### Student dashboard
- **What is it?** A student's own progress: courses completed, average scores, topic strengths, recent results, upcoming deadlines and a daily streak.
- **Why is it needed?** It motivates students and shows them where to focus.
- **How does it work?** Only results the student is allowed to see are included, so unreleased grades never leak through charts.

### Adaptive learning path
- **What is it?** A personal study plan per course: mastery and a status for each topic (mastered, developing, needs work, not assessed), an overall level and study recommendations.
- **Why is it needed?** It turns test results into concrete next steps for each student, which is Navigate's core promise.
- **How does it work?** Topic mastery comes from the student's graded work (80%+ mastered, 50–79% developing, below 50% needs work). For the weakest topics, Gemini writes study tips and suggested resources in the background: the page opens instantly with ready-made tips and swaps in the AI tips when they are ready (cached for 6 hours). If AI is unavailable or fails, the ready-made tips stay, so the page always works.

### Personal practice quizzes
- **What is it?** A one-click practice quiz on the student's weakest topics.
- **Why is it needed?** Students learn by practising exactly what they get wrong, without it affecting their grade.
- **How does it work?** AI generates questions on the chosen topics (it uses one AI generation from the workspace's plan). The quiz always has the number of questions the student asked for: anything AI could not provide is filled from question-bank questions instructors marked for practice (weak topics first), then from the course's past (already closed) assessments, then from varied reflection prompts per topic. Questions of tests that are still open are never used. When AI was unavailable the AI generation is refunded. Practice quizzes show results and answers immediately, are private to the student, and never count in the gradebook or analytics.

### AI tools for instructors
- **What is it?** Syllabus upload and analysis, AI question generation and assessment templates.
- **Why is it needed?** They cut the time to build an assessment from hours to minutes.
- **How does it work?** Restricted to staff, rate limited per user, and counted against the workspace's monthly AI allowance (analysis and generation count; uploading a file and listing templates do not). When AI is unavailable, topics are still extracted from the syllabus text (numbered, bulleted or one-per-line lists), split into single, de-duplicated topics.

### Workspace isolation
- **What is it?** Each customer's data is completely separate from every other customer's.
- **Why is it needed?** It is a basic requirement for selling to institutions.
- **How does it work?** Every learning query is filtered by the caller's workspace, and anything from another workspace behaves as if it does not exist (404). Within a workspace, students only ever see their own submissions.

### Demo data
- **What is it?** `npm run seed` creates the demo workspace "Northwind Institute of Technology".
- **Why is it needed?** Sales demos, screenshots and frontend development need realistic data.
- **How does it work?** It rebuilds only the `northwind` workspace: an owner, 2 instructors, 25 students, 3 courses, 11 assessments and about 110 graded submissions with a realistic spread of ability (including at-risk students, integrity warnings and one terminated attempt). The same data is produced on every run.

---

## Running

```bash
cd backend
npm run seed                                   # demo workspace (uses MONGO_URI, falls back to local MongoDB)
MONGO_URI_TEST=mongodb://127.0.0.1:27017/navigate_test_learning npx jest tests/learning --runInBand
```

Demo logins (password `Navigate123` for all): `owner@northwind.edu`, `priya.sharma@northwind.edu`,
`daniel.okafor@northwind.edu`, students `firstname.lastname@northwind.edu` (e.g. `aarav.patel@northwind.edu`,
`noah.johnson@northwind.edu` who is at risk).

## Decisions worth knowing

- The attempt end time is the time limit capped at the due date, so an attempt started just before the deadline cannot run past it.
- Submitting after time is up is accepted but only the autosaved answers are graded (`lateAnswersRejected: true`); autosave after time is up returns 409.
- Integrity events are always counted; attempts are only terminated when proctoring is switched on.
- One scoring basis everywhere: each student's best graded attempt per assessment (the official grade), current roster only, rounded once to one decimal. Class figures are the mean of each student's course average, so the dashboard, course list, course overview, gradebook and roster always agree.
- Practice-quiz fallback questions come from opted-in bank questions and closed or past-due assessments, never from a live test or an untagged bank question.
- Tag a bank question `practice` to make it available for student practice quizzes.
- The overall feedback sentence is based on points (partial credit included) and is marked provisional while written answers await review.
- Recommendations are not metered (they are cached and fall back to templates); practice quizzes, syllabus analysis and question generation are.
- The old in-memory assessment routes (`/api/student/assessment`, `/api/assessment/save|submit|...`, `/api/adaptive-learning`, `/api/curriculum`) and the quiz-refinement stub were removed after the frontend moved to the new APIs.
- Every staff action on courses, assessments, grades and the question bank is written to the workspace audit log with the actor and client IP (behind a proxy, set `TRUST_PROXY`).
- An assessment is announced to students only the first time it is published; deactivated students are left out of rosters, counts and notifications.
