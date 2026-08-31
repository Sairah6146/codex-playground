import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { useApp } from './store.jsx';
import Discover from './pages/Discover.jsx';
import Compare from './pages/Compare.jsx';
import Profile from './pages/Profile.jsx';
import Auth from './pages/Auth.jsx';
import More from './pages/More.jsx';

function RequireAuth({ children }) {
  const { user, authLoading } = useApp();
  if (authLoading) return <div className="container"><p className="hint">Loading…</p></div>;
  return user ? children : <Navigate to="/auth" replace />;
}

export default function App() {
  const { user, logout, authLoading } = useApp();

  return (
    <div className="app-shell">
      <nav className="topnav">
        <NavLink to="/" className="brand">🎙️ Podcast Connect</NavLink>
        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Discover</NavLink>
          <NavLink to="/compare" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Compare</NavLink>
          <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Profile</NavLink>
          <NavLink to="/more" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Saved &amp; Pipeline</NavLink>
        </div>
        <div className="nav-account">
          {!authLoading && (user ? (
            <>
              <span className="hint">{user.name || user.email}</span>
              <button className="btn btn-sm" onClick={logout}>Sign out</button>
            </>
          ) : (
            <NavLink to="/auth" className="btn btn-sm btn-primary">Sign in</NavLink>
          ))}
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Discover />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/more" element={<RequireAuth><More /></RequireAuth>} />
        <Route path="/auth" element={authLoading ? null : (user ? <Navigate to="/" replace /> : <Auth />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
