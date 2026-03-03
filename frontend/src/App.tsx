/** Root application component with routing. */

import React, { useCallback, useEffect, useState } from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { getSettings } from "./api/index";
import { ToastProvider } from "./contexts/ToastContext";
import { useAuth } from "./hooks/useAuth";
import { Landing } from "./pages/Landing";
import { Log } from "./pages/Log";
import { Login } from "./pages/Login";
import { Settings } from "./pages/Settings";
import { Setup } from "./pages/Setup";

function AuthenticatedApp({
  onLogout,
}: {
  onLogout: () => void;
}): React.ReactElement {
  const [groupName, setGroupName] = useState("RD Log");
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    getSettings()
      .then((settings) => {
        setGroupName(settings.name);
        setSetupCompleted(settings.setup_completed);
      })
      .catch(() => {
        setSetupCompleted(true);
      });
  }, []);

  const handleSetupComplete = useCallback(() => {
    setSetupCompleted(true);
    getSettings()
      .then((settings) => setGroupName(settings.name))
      .catch(() => {});
  }, []);

  if (setupCompleted === null) {
    return <div className="container" aria-busy="true" />;
  }

  if (!setupCompleted) {
    return (
      <div className="container">
        <Routes>
          <Route
            path="*"
            element={<Setup onComplete={handleSetupComplete} />}
          />
        </Routes>
      </div>
    );
  }

  return (
    <>
      <nav className="container rd-nav">
        <ul>
          <li>
            <strong>{groupName}</strong>
          </li>
        </ul>
        <input
          type="checkbox"
          id="rd-nav-toggle"
          className="rd-nav__toggle"
          aria-label="Toggle navigation"
        />
        <label
          htmlFor="rd-nav-toggle"
          className="rd-nav__hamburger"
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </label>
        <ul className="rd-nav__links">
          <li>
            <NavLink to="/" end>
              Home
            </NavLink>
          </li>
          <li>
            <NavLink to="/log">Log</NavLink>
          </li>
          <li>
            <NavLink to="/settings">Settings</NavLink>
          </li>
          <li>
            <button type="button" className="outline" onClick={onLogout}>
              Log Out
            </button>
          </li>
        </ul>
      </nav>
      <div className="container">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/log" element={<Log />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
}

export function App(): React.ReactElement {
  const { isAuthenticated, error, loading, login, register, logout } =
    useAuth();

  return (
    <BrowserRouter>
      <ToastProvider>
        {isAuthenticated ? (
          <AuthenticatedApp onLogout={logout} />
        ) : (
          <div className="container">
            <Login
              onLogin={login}
              onRegister={register}
              error={error}
              loading={loading}
            />
          </div>
        )}
      </ToastProvider>
    </BrowserRouter>
  );
}
