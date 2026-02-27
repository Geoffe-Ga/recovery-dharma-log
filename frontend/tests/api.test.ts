/** Tests for API client module and export URL helpers. */

import { api, getToken, setToken } from "../src/api/client";
import { getCsvExportUrl, getPrintableExportUrl } from "../src/api/index";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("API client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setToken(null);
    localStorage.clear();
  });

  it("sets and gets auth token from localStorage", () => {
    expect(getToken()).toBeNull();
    setToken("test-token");
    expect(getToken()).toBe("test-token");
    expect(localStorage.getItem("rd_log_token")).toBe("test-token");
  });

  it("clears token from localStorage", () => {
    setToken("test-token");
    setToken(null);
    expect(getToken()).toBeNull();
    expect(localStorage.getItem("rd_log_token")).toBeNull();
  });

  it("makes GET request with correct path", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: "test" }),
    });

    const result = await api.get("/test");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(result).toEqual({ data: "test" });
  });

  it("includes auth header when token is set", async () => {
    setToken("my-jwt");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await api.get("/test");
    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders["Authorization"]).toBe("Bearer my-jwt");
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ detail: "Bad request" }),
    });

    await expect(api.get("/test")).rejects.toThrow("Bad request");
  });

  it("clears token and redirects on 401 for non-auth paths", async () => {
    setToken("my-jwt");
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ detail: "Unauthorized" }),
    });

    await expect(api.get("/test")).rejects.toThrow("Session expired");
    expect(getToken()).toBeNull();
  });

  it("does not redirect on 401 for auth paths", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ detail: "Invalid credentials" }),
    });

    await expect(api.get("/auth/login")).rejects.toThrow("Invalid credentials");
  });

  it("makes POST request with body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
    });

    await api.post("/test", { name: "value" });
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ name: "value" });
  });

  it("makes DELETE request", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await api.delete("/test/1");
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe("DELETE");
  });
});

describe("getCsvExportUrl", () => {
  it("returns base URL with no date params", () => {
    expect(getCsvExportUrl()).toBe("/api/export/csv");
  });

  it("returns base URL when dates are empty strings", () => {
    expect(getCsvExportUrl("", "")).toBe("/api/export/csv");
  });

  it("includes start_date param when provided", () => {
    expect(getCsvExportUrl("2025-01-01")).toBe(
      "/api/export/csv?start_date=2025-01-01",
    );
  });

  it("includes end_date param when provided", () => {
    expect(getCsvExportUrl(undefined, "2025-12-31")).toBe(
      "/api/export/csv?end_date=2025-12-31",
    );
  });

  it("includes both date params when provided", () => {
    expect(getCsvExportUrl("2025-01-01", "2025-12-31")).toBe(
      "/api/export/csv?start_date=2025-01-01&end_date=2025-12-31",
    );
  });
});

describe("getPrintableExportUrl", () => {
  it("returns base URL with no date params", () => {
    expect(getPrintableExportUrl()).toBe("/api/export/printable");
  });

  it("returns base URL when dates are empty strings", () => {
    expect(getPrintableExportUrl("", "")).toBe("/api/export/printable");
  });

  it("includes start_date param when provided", () => {
    expect(getPrintableExportUrl("2025-01-01")).toBe(
      "/api/export/printable?start_date=2025-01-01",
    );
  });

  it("includes end_date param when provided", () => {
    expect(getPrintableExportUrl(undefined, "2025-12-31")).toBe(
      "/api/export/printable?end_date=2025-12-31",
    );
  });

  it("includes both date params when provided", () => {
    expect(getPrintableExportUrl("2025-01-01", "2025-12-31")).toBe(
      "/api/export/printable?start_date=2025-01-01&end_date=2025-12-31",
    );
  });
});
