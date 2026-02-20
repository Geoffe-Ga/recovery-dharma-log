/** Root application component with routing. */

import React from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { Landing } from "./pages/Landing";
import { Log } from "./pages/Log";
import { Login } from "./pages/Login";
import { Settings } from "./pages/Settings";

function AuthenticatedApp({
  onLogout,
}: {
  onLogout: () => void;
}): React.ReactElement {
  return (
    <>
      <nav className="container">
        <ul>
          <li>
            <strong>RD Log</strong>
          </li>
        </ul>
        <ul>
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
    </BrowserRouter>
  );
}
