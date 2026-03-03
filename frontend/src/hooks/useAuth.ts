/** Authentication hook for managing login state. */

import { useCallback, useState } from "react";
import {
  isLoggedIn,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
} from "../api/index";
import type { User } from "../types/index";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  error: string | null;
  loading: boolean;
}

interface AuthActions {
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    password: string,
    inviteCode?: string,
  ) => Promise<void>;
  logout: () => void;
}

export function useAuth(): AuthState & AuthActions {
  const [user, setUser] = useState<User | null>(
    isLoggedIn() ? { id: 0, username: "", group_id: 0 } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiLogin(username, password);
      setUser({ id: 0, username, group_id: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (username: string, password: string, inviteCode?: string) => {
      setLoading(true);
      setError(null);
      try {
        const newUser = await apiRegister(username, password, inviteCode);
        await apiLogin(username, password);
        setUser(newUser);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Registration failed");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  return {
    user,
    isAuthenticated: user !== null,
    error,
    loading,
    login,
    register,
    logout,
  };
}
