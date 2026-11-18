import React, { Suspense, lazy } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { homePathFor, isStaffRole } from './auth/roles';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoadingState from './components/common/LoadingState';
import OfflineBanner from './components/common/OfflineBanner';
import Layout from './components/layout/Layout';
import { useAuth } from './contexts/AuthContext';

// Every route is split so the first paint stays fast.
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Pricing = lazy(() => import('./pages/public/Pricing'));
const JoinLanding = lazy(() => import('./pages/public/JoinLanding'));
const NotFound = lazy(() => import('./pages/public/NotFound'));
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));

const Home = lazy(() => import('./pages/Home'));
const Settings = lazy(() => import('./pages/settings/Settings'));
const Notifications = lazy(() => import('./pages/Notifications'));

// Staff (F2)
const Courses = lazy(() => import('./pages/staff/Courses'));
const CourseDetail = lazy(() => import('./pages/staff/CourseDetail'));
const AssessmentEditor = lazy(() => import('./pages/staff/AssessmentEditor'));
const AssessmentDetail = lazy(() => import('./pages/staff/AssessmentDetail'));
const SubmissionReview = lazy(() => import('./pages/staff/SubmissionReview'));
const QuestionBank = lazy(() => import('./pages/staff/QuestionBank'));

// Learner (F3)
const StudentCourse = lazy(() => import('./pages/learner/StudentCourse'));
const LearningPath = lazy(() => import('./pages/learner/LearningPath'));
const JoinCourse = lazy(() => import('./pages/learner/JoinCourse'));
const ResultsHistory = lazy(() => import('./pages/learner/ResultsHistory'));
const Result = lazy(() => import('./pages/learner/Result'));
const TakeAssessment = lazy(() => import('./pages/learner/TakeAssessment'));

const FullScreenLoader = () => <LoadingState fullScreen label="Loading Navigate…" />;
const PageLoader = () => <LoadingState label="Loading…" />;

/** Staff-only section; students go home. */
const StaffOnly = () => {
  const { currentUser, sessionVerified } = useAuth();
  if (isStaffRole(currentUser?.role)) return <Outlet />;
  // The cached role may be stale until /auth/me answers; don't bounce a just-promoted user.
  return sessionVerified ? <Navigate to="/app" replace /> : <PageLoader />;
};

/** Student-only section; staff go home. */
const LearnerOnly = () => {
  const { currentUser, sessionVerified } = useAuth();
  if (!isStaffRole(currentUser?.role)) return <Outlet />;
  return sessionVerified ? <Navigate to="/app" replace /> : <PageLoader />;
};

const COURSE_TABS = ['overview', 'assessments', 'students', 'gradebook', 'analytics', 'curriculum'];

/** /app/courses/:courseId/:tab? → staff course workspace or the student course page. */
const CourseRoute = () => {
  const { currentUser } = useAuth();
  const { courseId, tab } = useParams();
  if (isStaffRole(currentUser?.role)) {
    if (tab && !COURSE_TABS.includes(tab)) return <Navigate to={`/app/courses/${courseId}`} replace />;
    return <CourseDetail />;
  }
  if (tab) return <Navigate to={`/app/courses/${courseId}`} replace />;
  return <StudentCourse />;
};

// Login/Register are pointless for a signed-in user. Honour the page that sent
// them to /login (ProtectedRoute stores it in location.state.from).
const GuestOnly = ({ children }) => {
  const { currentUser } = useAuth();
  const location = useLocation();
  if (!currentUser) return children;
  const from = location.state?.from;
  const returnTo =
    from?.pathname && !['/login', '/register'].includes(from.pathname)
      ? `${from.pathname}${from.search || ''}${from.hash || ''}`
      : homePathFor(currentUser);
  return <Navigate to={returnTo} replace />;
};

/** Old URLs → new ones. */
const LegacyRedirect = ({ to }) => {
  const params = useParams();
  const target = to.replace(/:(\w+)/g, (_, key) => encodeURIComponent(params[key] || ''));
  return <Navigate to={target} replace />;
};

const LegacyInstructorRedirect = () => {
  const { '*': rest = '' } = useParams();
  const [section, id] = rest.split('/');
  if (section === 'courses' && id) return <Navigate to={`/app/courses/${id}`} replace />;
  if (section === 'courses') return <Navigate to="/app/courses" replace />;
  if (section === 'assessment' && id) return <Navigate to={`/app/assessments/${id}/edit`} replace />;
  if (section === 'assessment') return <Navigate to="/app/assessments/new" replace />;
  if (section === 'student-results' && id) return <Navigate to={`/app/courses/${id}/gradebook`} replace />;
  if (section === 'curriculum' && id) return <Navigate to={`/app/courses/${id}/curriculum`} replace />;
  return <Navigate to="/app" replace />;
};

/** Error boundary that resets whenever the route changes. */
const RouteBoundary = ({ children }) => {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
};

function App() {
  const { loading } = useAuth();

  if (loading) return <FullScreenLoader />;

  return (
    <RouteBoundary>
      <OfflineBanner />
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/join/:code" element={<JoinLanding />} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          <Route element={<ProtectedRoute />}>
            {/* Focused exam layout, outside the main shell */}
            <Route element={<LearnerOnly />}>
              <Route path="/app/take/:assessmentId" element={<Suspense fallback={<FullScreenLoader />}><TakeAssessment /></Suspense>} />
            </Route>

            <Route path="/app" element={<Layout pageFallback={<PageLoader />} />}>
              <Route index element={<Home />} />
              <Route path="courses/:courseId/learning-path" element={<LearnerOnly />}>
                <Route index element={<LearningPath />} />
              </Route>
              <Route path="courses/:courseId/:tab?" element={<CourseRoute />} />
              <Route path="settings/:tab?" element={<Settings />} />
              <Route path="notifications" element={<Notifications />} />

              <Route element={<StaffOnly />}>
                <Route path="courses" element={<Courses />} />
                <Route path="assessments" element={<Navigate to="/app/courses" replace />} />
                <Route path="assessments/new" element={<AssessmentEditor />} />
                <Route path="assessments/:assessmentId/edit" element={<AssessmentEditor />} />
                <Route path="assessments/:assessmentId/:tab?" element={<AssessmentDetail />} />
                <Route path="submissions/:submissionId" element={<SubmissionReview />} />
                <Route path="question-bank" element={<QuestionBank />} />
              </Route>

              <Route element={<LearnerOnly />}>
                <Route path="join" element={<JoinCourse />} />
                <Route path="results" element={<ResultsHistory />} />
                <Route path="results/:submissionId" element={<Result />} />
              </Route>

              <Route path="*" element={<NotFound inShell />} />
            </Route>

            {/* Legacy URLs */}
            <Route path="/dashboard" element={<Navigate to="/app" replace />} />
            <Route path="/instructor/*" element={<LegacyInstructorRedirect />} />
            <Route path="/course/:id" element={<LegacyRedirect to="/app/courses/:id" />} />
            <Route path="/assessment/:id" element={<LegacyRedirect to="/app/take/:id" />} />
            <Route path="/results/:id" element={<LegacyRedirect to="/app/results/:id" />} />
            <Route path="/learning-path/:id" element={<LegacyRedirect to="/app/courses/:id/learning-path" />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </RouteBoundary>
  );
}

export default App;
