/** Login page - authentication form. */

import React, { type FormEvent, useState } from "react";

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, password: string) => Promise<void>;
  error: string | null;
  loading: boolean;
}

export function Login({
  onLogin,
  onRegister,
  error,
  loading,
}: LoginProps): React.ReactElement {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (isRegister) {
      await onRegister(username, password);
    } else {
      await onLogin(username, password);
    }
  };

  return (
    <main className="rd-login">
      <h1>{isRegister ? "Create Account" : "Log In"}</h1>
      <span className="rd-login__brand">Recovery Dharma Secretary Log</span>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={isRegister ? "new-password" : "current-password"}
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading
            ? "Please wait..."
            : isRegister
              ? "Create Account"
              : "Log In"}
        </button>
      </form>
      <p className="rd-login__toggle">
        <button type="button" onClick={() => setIsRegister(!isRegister)}>
          {isRegister
            ? "Already have an account? Log in"
            : "Need an account? Register"}
        </button>
      </p>
    </main>
  );
}
