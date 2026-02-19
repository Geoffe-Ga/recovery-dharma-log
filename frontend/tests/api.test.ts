/** Tests for API client module. */

import { api, getToken, setToken } from "../src/api/client";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("API client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setToken(null);
  });

  it("sets and gets auth token", () => {
    expect(getToken()).toBeNull();
    setToken("test-token");
    expect(getToken()).toBe("test-token");
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
      status: 401,
      json: () => Promise.resolve({ detail: "Unauthorized" }),
    });

    await expect(api.get("/test")).rejects.toThrow("Unauthorized");
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
