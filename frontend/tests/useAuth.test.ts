/** Tests for useAuth hook — login, logout, and state synchronization. */

import { act, renderHook } from "@testing-library/react";
import { useAuth } from "../src/hooks/useAuth";

// Mock the API module
jest.mock("../src/api/index", () => ({
  TOKEN_KEY: "rd_log_token",
  isLoggedIn: jest.fn(() => false),
  login: jest.fn(),
  logout: jest.fn(),
  register: jest.fn(),
}));

import * as apiModule from "../src/api/index";

const mockIsLoggedIn = apiModule.isLoggedIn as jest.Mock;
const mockLogin = apiModule.login as jest.Mock;
const mockLogout = apiModule.logout as jest.Mock;
const mockRegister = apiModule.register as jest.Mock;

describe("useAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockIsLoggedIn.mockReturnValue(false);
  });

  it("starts unauthenticated when no token exists", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("starts authenticated when token exists", () => {
    mockIsLoggedIn.mockReturnValue(true);
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).not.toBeNull();
  });

  it("sets user after successful login", async () => {
    mockLogin.mockImplementation(async () => {
      mockIsLoggedIn.mockReturnValue(true);
      return { access_token: "tok" };
    });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login("alice", "pass123");
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.username).toBe("alice");
    expect(result.current.error).toBeNull();
  });

  it("sets error on login failure", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid credentials"));
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login("alice", "wrong");
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBe("Invalid credentials");
  });

  it("clears user on logout", async () => {
    mockLogin.mockImplementation(async () => {
      mockIsLoggedIn.mockReturnValue(true);
      return { access_token: "tok" };
    });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login("alice", "pass123");
    });
    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.logout();
    });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(mockLogout).toHaveBeenCalled();
  });

  it("can re-login after logout", async () => {
    mockLogin.mockImplementation(async () => {
      mockIsLoggedIn.mockReturnValue(true);
      return { access_token: "tok" };
    });
    const { result } = renderHook(() => useAuth());

    // Login
    await act(async () => {
      await result.current.login("alice", "pass123");
    });
    expect(result.current.isAuthenticated).toBe(true);

    // Logout
    act(() => {
      result.current.logout();
    });
    expect(result.current.isAuthenticated).toBe(false);

    // Re-login
    await act(async () => {
      await result.current.login("alice", "pass123");
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.username).toBe("alice");
    expect(result.current.error).toBeNull();
  });

  it("clears previous error on successful login", async () => {
    mockLogin
      .mockRejectedValueOnce(new Error("Invalid credentials"))
      .mockImplementationOnce(async () => {
        mockIsLoggedIn.mockReturnValue(true);
        return { access_token: "tok" };
      });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login("alice", "wrong");
    });
    expect(result.current.error).toBe("Invalid credentials");

    await act(async () => {
      await result.current.login("alice", "pass123");
    });
    expect(result.current.error).toBeNull();
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("sets loading during login", async () => {
    let resolveLogin: (v: unknown) => void;
    mockLogin.mockReturnValue(
      new Promise((r) => {
        resolveLogin = r;
      }),
    );
    const { result } = renderHook(() => useAuth());

    expect(result.current.loading).toBe(false);

    let loginPromise: Promise<void>;
    act(() => {
      loginPromise = result.current.login("alice", "pass123");
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      mockIsLoggedIn.mockReturnValue(true);
      resolveLogin!({ access_token: "tok" });
      await loginPromise!;
    });
    expect(result.current.loading).toBe(false);
  });

  it("registers and logs in a new user", async () => {
    mockRegister.mockResolvedValue({
      id: 1,
      username: "bob",
      group_id: 1,
    });
    mockLogin.mockImplementation(async () => {
      mockIsLoggedIn.mockReturnValue(true);
      return { access_token: "tok" };
    });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.register("bob", "pass123");
    });

    expect(mockRegister).toHaveBeenCalledWith("bob", "pass123", undefined);
    expect(mockLogin).toHaveBeenCalledWith("bob", "pass123");
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("sets error on registration failure", async () => {
    mockRegister.mockRejectedValue(new Error("Username taken"));
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.register("bob", "pass123");
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBe("Username taken");
  });

  it("handles non-Error login exceptions gracefully", async () => {
    mockLogin.mockRejectedValue("string error");
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login("alice", "pass123");
    });

    expect(result.current.error).toBe("Login failed");
  });

  it("handles non-Error register exceptions gracefully", async () => {
    mockRegister.mockRejectedValue(42);
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.register("bob", "pass123");
    });

    expect(result.current.error).toBe("Registration failed");
  });

  describe("storage event synchronization", () => {
    it("logs out when token is removed externally", () => {
      mockIsLoggedIn.mockReturnValue(true);
      const { result } = renderHook(() => useAuth());
      expect(result.current.isAuthenticated).toBe(true);

      // Simulate external token removal (e.g., 401 handler or another tab)
      act(() => {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "rd_log_token",
            newValue: null,
          }),
        );
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it("ignores storage events for unrelated keys", () => {
      mockIsLoggedIn.mockReturnValue(true);
      const { result } = renderHook(() => useAuth());
      expect(result.current.isAuthenticated).toBe(true);

      act(() => {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "some_other_key",
            newValue: null,
          }),
        );
      });

      expect(result.current.isAuthenticated).toBe(true);
    });

    it("cleans up storage listener on unmount", () => {
      const removeSpy = jest.spyOn(window, "removeEventListener");
      const { unmount } = renderHook(() => useAuth());

      unmount();

      expect(removeSpy).toHaveBeenCalledWith("storage", expect.any(Function));
      removeSpy.mockRestore();
    });
  });
});
