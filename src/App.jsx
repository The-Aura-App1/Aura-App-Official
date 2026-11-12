import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Landing       from './pages/Landing';
import AppShell      from './components/layout/AppShell';
import Feed          from './pages/Feed';
import { ThemeSync } from './hooks/useChooseTheme';

// The welcome page and the feed come with the first download. Every other
// page is its own small file, fetched the first time it's opened, so phones
// don't download and parse the whole app up front.
const pages = {
  SignIn:        () => import('./pages/auth/SignIn'),
  SignUp:        () => import('./pages/auth/SignUp'),
  ConfirmEmail:  () => import('./pages/auth/ConfirmEmail'),
  About:         () => import('./pages/About'),
  Profile:       () => import('./pages/Profile'),
  CreatePost:    () => import('./pages/CreatePost'),
  Settings:      () => import('./pages/Settings'),
  Moderation:    () => import('./pages/Moderation'),
  AuraWallet:    () => import('./pages/AuraWallet'),
  PostView:      () => import('./components/post/PostView'),
  Onboarding:    () => import('./pages/Onboarding'),
  Notifications: () => import('./pages/Notifications'),
  Groups:        () => import('./pages/Groups'),
  GroupPage:     () => import('./pages/GroupPage'),
  Feedback:      () => import('./pages/Feedback'),
  Search:        () => import('./pages/Search'),
};
const SignIn        = lazy(pages.SignIn);
const SignUp        = lazy(pages.SignUp);
const ConfirmEmail  = lazy(pages.ConfirmEmail);
const About         = lazy(pages.About);
const Profile       = lazy(pages.Profile);
const CreatePost    = lazy(pages.CreatePost);
const Settings      = lazy(pages.Settings);
const Moderation    = lazy(pages.Moderation);
const AuraWallet    = lazy(pages.AuraWallet);
const PostView      = lazy(pages.PostView);
const Onboarding    = lazy(pages.Onboarding);
const Notifications = lazy(pages.Notifications);
const Groups        = lazy(pages.Groups);
const GroupPage     = lazy(pages.GroupPage);
const Feedback      = lazy(pages.Feedback);
const Search        = lazy(pages.Search);

// Once the first page has settled, fetch the rest quietly in the background
// so tapping around later is instant.
function PrefetchPages() {
  useEffect(() => {
    const idle = window.requestIdleCallback ?? (fn => setTimeout(fn, 2500));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    const handle = idle(() => Object.values(pages).forEach(load => load().catch(() => {})), { timeout: 6000 });
    return () => cancel(handle);
  }, []);
  return null;
}

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
        <Route path="feedback"           element={<Feedback />} />
        <Route path="search"             element={<Search />} />
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
          <Suspense fallback={<div className="min-h-screen bg-[var(--bg-primary)]" />}>
            <AppRoutes />
          </Suspense>
          <PrefetchPages />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}