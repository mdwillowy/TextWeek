import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import AdminDashboard from './pages/AdminDashboard';
import { useAuth } from './context/AuthContext';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="screen-loader">Loading your profile...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/?modal=login" replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="screen-loader">Loading admin...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/?modal=login" replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/home" replace />;
  }

  return children;
}

function PublicOnlyRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="screen-loader">Preparing app...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  return children;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: (
          <PublicOnlyRoute>
            <LandingPage />
          </PublicOnlyRoute>
        ),
      },
      {
        path: 'signup',
        element: <Navigate to="/?modal=signup" replace />,
      },
      {
        path: 'login',
        element: <Navigate to="/?modal=login" replace />,
      },
      {
        path: 'privacy',
        element: <Navigate to="/?modal=privacy" replace />,
      },
      {
        path: 'terms',
        element: <Navigate to="/?modal=terms" replace />,
      },
      {
        path: 'safety',
        element: <Navigate to="/?modal=safety" replace />,
      },
      {
        path: 'data-policy',
        element: <Navigate to="/?modal=data-policy" replace />,
      },
      {
        path: 'home',
        element: (
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'chat/:chatId',
        element: (
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin',
        element: (
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        ),
      },
    ],
  },
]);

export default router;
