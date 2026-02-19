/** Root application component with routing. */

import React from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
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
      <nav>
        <Link to="/">Home</Link>
        {" | "}
        <Link to="/log">Meeting Log</Link>
        {" | "}
        <Link to="/settings">Settings</Link>
        {" | "}
        <button type="button" onClick={onLogout}>
          Log Out
        </button>
      </nav>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/log" element={<Log />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
        <Login
          onLogin={login}
          onRegister={register}
          error={error}
          loading={loading}
        />
      )}
    </BrowserRouter>
  );
}
