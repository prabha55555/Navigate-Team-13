import React, { lazy } from 'react';
import { isStaffRole } from '../auth/roles';
import { useAuth } from '../contexts/AuthContext';

const StaffDashboard = lazy(() => import('./staff/StaffDashboard'));
const StudentDashboard = lazy(() => import('./learner/StudentDashboard'));

/** /app — the dashboard for the signed-in user's role. */
const Home = () => {
  const { currentUser } = useAuth();
  return isStaffRole(currentUser?.role) ? <StaffDashboard /> : <StudentDashboard />;
};

export default Home;
