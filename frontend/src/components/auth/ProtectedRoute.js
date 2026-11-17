import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingState from '../common/LoadingState';

const ProtectedRoute = () => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState fullScreen label="Checking your session…" />;
  }

  // Remember where the visitor was headed so Login can send them back afterwards.
  return currentUser ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />;
};

export default ProtectedRoute;
