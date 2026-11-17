import { Box, CircularProgress } from '@mui/material';
import React, { Suspense, lazy } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { homePathFor, isInstructorRole } from './auth/roles';
import { useAuth } from './contexts/AuthContext';

import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';

// Public pages are small and needed first, so they stay in the main bundle.
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import LandingPage from './pages/LandingPage';

// Everything behind login is split per route so the first paint stays fast.
const Dashboard = lazy(() => import('./pages/student/Dashboard'));
const CourseView = lazy(() => import('./pages/student/CourseView'));
const AssessmentTake = lazy(() => import('./pages/student/AssessmentTake'));
const SubmissionResults = lazy(() => import('./pages/student/SubmissionResults'));
const LearningPath = lazy(() => import('./pages/student/LearningPath'));

const InstructorDashboard = lazy(() => import('./pages/instructor/InstructorDashboard'));
const CourseManagement = lazy(() => import('./pages/instructor/CourseManagement'));
const AssessmentCreation = lazy(() => import('./pages/instructor/AssessmentCreation'));
const StudentResults = lazy(() => import('./pages/instructor/StudentResults'));
const CurriculumMapping = lazy(() => import('./pages/instructor/CurriculumMapping'));

const PageLoader = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
    <CircularProgress />
  </Box>
);

const FullScreenLoader = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
    <CircularProgress />
  </Box>
);

// Instructor-only section; students are sent to their own dashboard.
const InstructorRoute = () => {
  const { currentUser } = useAuth();
  return isInstructorRole(currentUser?.role) ? <Outlet /> : <Navigate to="/dashboard" replace />;
};

const FallbackRoute = () => {
  const { currentUser } = useAuth();
  return <Navigate to={currentUser ? homePathFor(currentUser) : '/'} replace />;
};

// Login/Register are pointless for a signed-in user. Honour the page that sent
// them to /login (ProtectedRoute stores it in location.state.from); this guard
// re-renders the moment login succeeds, before Login's own navigate() runs.
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

function App() {
  const { loading } = useAuth();

  if (loading) {
    return <FullScreenLoader />;
  }

  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout pageFallback={<PageLoader />} />}>
            {/* Student Routes */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/course/:courseId" element={<CourseView />} />
            <Route path="/assessment/:assessmentId" element={<AssessmentTake />} />
            <Route path="/results/:submissionId" element={<SubmissionResults />} />
            <Route path="/learning-path/:courseId" element={<LearningPath />} />

            {/* Instructor Routes */}
            <Route element={<InstructorRoute />}>
              <Route path="/instructor/dashboard" element={<InstructorDashboard />} />
              <Route path="/instructor/courses/:courseId?" element={<CourseManagement />} />
              <Route path="/instructor/assessment/:assessmentId?" element={<AssessmentCreation />} />
              <Route path="/instructor/student-results/:courseId?" element={<StudentResults />} />
              <Route path="/instructor/curriculum/:courseId?" element={<CurriculumMapping />} />
            </Route>
          </Route>
        </Route>

        {/* Catch all */}
        <Route path="*" element={<FallbackRoute />} />
      </Routes>
    </Suspense>
  );
}

export default App;
