/** Login page - authentication form. */

import React, { type FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useShowToast } from "../contexts/ToastContext";

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (
    username: string,
    password: string,
    inviteCode?: string,
  ) => Promise<void>;
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
  const [hasInviteCode, setHasInviteCode] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [searchParams] = useSearchParams();
  const showToast = useShowToast();

  useEffect(() => {
    if (searchParams.get("expired") === "1") {
      showToast("info", "Your session has expired. Please log in again.");
    }
  }, [searchParams, showToast]);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (isRegister) {
      await onRegister(
        username,
        password,
        hasInviteCode ? inviteCode.toUpperCase() : undefined,
      );
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
        {isRegister && (
          <>
            <label>
              <input
                type="checkbox"
                checked={hasInviteCode}
                onChange={(e) => setHasInviteCode(e.target.checked)}
              />
              I have an invite code
            </label>
            {hasInviteCode && (
              <label>
                Invite Code
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) =>
                    setInviteCode(e.target.value.toUpperCase().slice(0, 8))
                  }
                  placeholder="Enter 8-character code"
                  maxLength={8}
                  style={{ textTransform: "uppercase" }}
                />
              </label>
            )}
          </>
        )}
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
