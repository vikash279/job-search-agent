import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { client, setToken, getToken } from "./api";
import { AuthPage } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { ProfilePage } from "./pages/Profile";
import { ResumesPage } from "./pages/Resumes";
import { PreferencesPage } from "./pages/Preferences";
import { JobsPage } from "./pages/Jobs";
import { JobDetailPage } from "./pages/JobDetail";
import { MatchesPage } from "./pages/Matches";
import { ApplicationReviewPage } from "./pages/ApplicationReview";
import { TrackerPage } from "./pages/Tracker";
import { SettingsPage } from "./pages/Settings";

function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [name, setName] = useState("Signed in");

  useEffect(() => {
    client.me().then((res) => setName(res.user.name)).catch(() => {
      setToken(null);
      navigate("/login");
    });
  }, [navigate]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <p className="brand serif">Harbor<span>.</span></p>
          <p className="muted">Job application copilot</p>
        </div>
        <nav className="nav">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/profile">Profile</NavLink>
          <NavLink to="/resumes">Resumes</NavLink>
          <NavLink to="/preferences">Preferences</NavLink>
          <NavLink to="/jobs">Job search</NavLink>
          <NavLink to="/matches">Matches</NavLink>
          <NavLink to="/tracker">Tracker</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <div className="who">
          <div>{name}</div>
          <button
            className="btn ghost"
            onClick={() => {
              setToken(null);
              navigate("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

function Private({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/" element={<Private><Dashboard /></Private>} />
      <Route path="/profile" element={<Private><ProfilePage /></Private>} />
      <Route path="/resumes" element={<Private><ResumesPage /></Private>} />
      <Route path="/preferences" element={<Private><PreferencesPage /></Private>} />
      <Route path="/jobs" element={<Private><JobsPage /></Private>} />
      <Route path="/jobs/:id" element={<Private><JobDetailPage /></Private>} />
      <Route path="/matches" element={<Private><MatchesPage /></Private>} />
      <Route path="/applications/:id" element={<Private><ApplicationReviewPage /></Private>} />
      <Route path="/tracker" element={<Private><TrackerPage /></Private>} />
      <Route path="/settings" element={<Private><SettingsPage /></Private>} />
    </Routes>
  );
}
