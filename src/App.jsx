import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import SignIn        from './pages/auth/SignIn';
import SignUp        from './pages/auth/SignUp';
import ConfirmEmail  from './pages/auth/ConfirmEmail';
import Landing       from './pages/Landing';
import About         from './pages/About';
import AppShell      from './components/layout/AppShell';
import Feed          from './pages/Feed';
import Profile       from './pages/Profile';
import CreatePost    from './pages/CreatePost';
import Settings      from './pages/Settings';
import Moderation from './pages/Moderation';
import { ThemeSync } from './hooks/useChooseTheme';
import AuraWallet    from './pages/AuraWallet';
import PostView from './components/post/PostView';
import Onboarding from './pages/Onboarding';
import Notifications from './pages/Notifications';
import Groups from './pages/Groups';
import GroupPage from './pages/GroupPage';

function ProtectedRoute({ children }) {
  const { user, loading, profileComplete } = useAuth();
  if (loading) return null;
  if (!user)   return <Navigate to="/welcome" replace />;
  if (!profileComplete && window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}
function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user)    return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/welcome" element={<PublicRoute><Landing /></PublicRoute>} />
      <Route path="/about" element={<About />} />
      <Route path="/signin" element={<PublicRoute><SignIn /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><SignUp /></PublicRoute>} />
      <Route path="/confirm-email" element={<PublicRoute><ConfirmEmail /></PublicRoute>} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index                     element={<Feed />} />
        <Route path="create"             element={<CreatePost />} />
        <Route path="wallet"             element={<AuraWallet />} />
        <Route path="settings"           element={<Settings />} />
        <Route path="moderation"         element={<Moderation />} />
        <Route path="notifications"      element={<Notifications />} />
        <Route path="groups"             element={<Groups />} />
        <Route path="groups/:groupId"    element={<GroupPage />} />
        <Route path="profile/:username"  element={<Profile />} />
        <Route path="profile"            element={<Profile />} />
        <Route path="post/:postId"       element={<PostView />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemeSync />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}