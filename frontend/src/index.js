import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ColorModeProvider } from './contexts/ColorModeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import './styles/index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ColorModeProvider>
          <NotificationProvider>
            <App />
          </NotificationProvider>
        </ColorModeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
