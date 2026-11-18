# Frontend: learner (student) experience

What students see in Navigate, written for a product owner. Code: `frontend/src/pages/learner/*` and
`frontend/src/components/learner/*`. API contract: `docs/ARCHITECTURE.md` §5.

---

### Student dashboard (`/app`)
- **What is it?** The student's home page: a greeting, what is due next, their courses, recent results, topic strengths and a daily streak.
- **Why is it needed?** Students should know in five seconds what to do today and how they are doing.
- **How does it work?** It loads the student's analytics and assessment list together. "Up next" lists open assessments (in-progress attempts first, then by due date) with a time-left chip and a Start/Resume button. A student with no courses sees a "Join your first course" prompt.

### Join a course (`/app/join`)
- **What is it?** A page where a student types the 6-character course code from their instructor.
- **Why is it needed?** It is how a class fills itself without the instructor typing in every email address.
- **How does it work?** The box upper-cases the code, strips spaces and dashes (so pasted codes work) and warns about look-alike characters (0/O/1/I). Clear messages explain a wrong or switched-off code, or that the student was removed from the course. On success the student lands on the course page.

### Course page (`/app/courses/:id`)
- **What is it?** One course from the student's point of view: its assessments grouped as Open now, Upcoming, Completed and Closed, plus personal practice quizzes.
- **Why is it needed?** It shows exactly what can be taken, what was missed and how each attempt went.
- **How does it work?** Each assessment shows attempts used, best score (or "Pending" until results are released), the reason it can't be started (opens later, past due, all attempts used, closed), and Start, Resume, Retake or View result buttons.

### Taking an assessment (`/app/take/:id`)
- **What is it?** A focused, full-page exam screen outside the normal app layout.
- **Why is it needed?** Students need a calm, distraction-free place to work, and institutions need a fair, tamper-resistant test.
- **How does it work?**
  - *Before starting* the student sees the rules: time limit, attempts, pass mark, results policy and any proctoring rules (full screen, stay on the page, no copy/paste, camera). Proctored tests with a camera run a live camera check, and graded tests need an "I agree" tick.
  - *The clock belongs to the server.* The end time comes from the server and is corrected for a wrong device clock; warnings appear at 5 and 1 minutes, and the answers are submitted automatically when time is up.
  - *Answers save themselves* about 1.5 s after each change, when the student leaves a text box and when they change question. A status shows "Saving… / Saved / Offline — will retry". Failed saves retry with growing pauses and as soon as the connection returns. Unsaved answers are also kept on the device, so a crash or reload never loses work. Resuming on another device returns the same questions in the same order.
  - *Navigation:* a question map shows answered, flagged and current questions. The student can flag questions for review, use ← → to move between questions and 1–9 to pick an option. On phones the map opens from a bottom bar.
  - *Proctoring (only when the instructor turned it on):* leaving full screen, switching tabs, blocked shortcuts (copy, paste, cut, reload), pasting into answers and camera loss are reported to the server. The header shows the warning count from the server (for example 2/5). At the limit the attempt ends and the student sees a clear "Your attempt was ended" screen. A "Return to full screen" panel covers the questions until the student goes back to full screen.
  - *Submitting:* a review dialog shows how many questions are answered, unanswered and flagged, with links to jump back to them. A guard stops double submissions. After submitting, the browser history is replaced so "Back" can't reopen the test.
  - *Can't start:* friendly screens explain "not open yet" (with the opening time), "past due", "no attempts left" and "closed".
  - *Practice quizzes* use the same screen with proctoring off and no agreement tick.

### Result page (`/app/results/:id`)
- **What is it?** The student's score and a question-by-question review of one attempt.
- **Why is it needed?** Feedback is where learning happens. It also builds trust in how the test was graded.
- **How does it work?** If results aren't released yet, the page confirms the submission and explains when scores will appear. Once released it shows a score ring, pass/fail, points, time spent, the attempt number and any instructor adjustment. It breaks the score down by topic, lists next steps (with a one-click "Practise weak topics"), shows a summary of integrity warnings, and reviews each question: the student's answer, the correct answer (only if the instructor allows it), feedback, points and a "needs review" badge for written answers.

### Results history (`/app/results`)
- **What is it?** A list of every submission the student has made.
- **Why is it needed?** Students track their progress and find past feedback.
- **How does it work?** It shows a table on desktop and cards on phones, with filters by course, status (passed, not passed, awaiting release, ended early) and type (graded or practice). The filters live in the URL so they can be shared, and a "Load more" button fetches older results.

### Learning path (`/app/courses/:id/learning-path`)
- **What is it?** A personal route through one course. Mastered topics are cleared checkpoints, a "You are here · next focus" marker shows the topic to study now, the remaining topics follow in the recommended order, and "Course mastery" is the destination.
- **Why is it needed?** It turns test results into one clear next step, which is Navigate's core promise. It also uses the brand's route/compass idea instead of a generic grid.
- **How does it work?** A dark brand panel shows overall mastery, level, topic counts and a small route map (the same art as the landing page). Below it, a vertical route lists the topics: cleared checkpoints first, then the recommended focus (weakest first), then other weak topics and topics with no grades yet. The focus stop is expanded with its study tips, resources (labelled "AI-generated" or "Suggested") and a "Practise this topic" button. Other stops can expand their tips. The first visit can take up to about 20 seconds while AI writes recommendations, so an animated "Personalising your path…" placeholder is shown.

### Practice my weak topics
- **What is it?** A one-click private quiz on the student's weakest topics.
- **Why is it needed?** Students improve fastest by practising what they get wrong, without any effect on their grade.
- **How does it work?** When nothing is weak, the button becomes "Challenge yourself" (a mixed review) instead of "Practice my weak topics". The student picks up to 5 topics (the weakest are pre-selected) and 5–15 questions. A progress view with changing messages runs while the quiz is generated, because AI can take up to a minute. The student then goes straight into the quiz. If the workspace has used up its monthly AI allowance, an upgrade prompt explains this. If AI is unavailable, the quiz is built from past course questions and the student is told so.
