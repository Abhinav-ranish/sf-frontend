import { server } from "../mocks/server";
import { api } from "../mocks/handlers";
import { http, HttpResponse } from "msw";
import {
  ApiError,
  ApiUnreachableError,
  apiFetch,
  apiJson,
  apiUrl,
} from "@/lib/apiClient";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("apiUrl", () => {
  it("passes absolute URLs through untouched", () => {
    expect(apiUrl("https://example.com/x")).toBe("https://example.com/x");
  });

  it("adds a leading slash to relative paths", () => {
    expect(apiUrl("health")).toBe(apiUrl("/health"));
  });
});

describe("apiJson", () => {
  it("returns the parsed body on success", async () => {
    await expect(apiJson<{ status: string }>("/health")).resolves.toMatchObject({
      status: "ok",
    });
  });

  it("returns undefined for a 204", async () => {
    server.use(
      http.get(api("/health"), () => new HttpResponse(null, { status: 204 })),
    );

    await expect(apiJson("/health")).resolves.toBeUndefined();
  });

  it("throws ApiError with the status on failure", async () => {
    server.use(
      http.get(api("/health"), () =>
        HttpResponse.text("boom", { status: 503 }),
      ),
    );

    await expect(apiJson("/health")).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
      body: "boom",
    });
    await expect(apiJson("/health")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("ApiError.json", () => {
  it("parses a JSON body", () => {
    expect(new ApiError(409, '{"detail":"taken"}').json()).toEqual({
      detail: "taken",
    });
  });

  it("returns undefined when the body is not JSON", () => {
    expect(new ApiError(500, "<html>")).toHaveProperty("body", "<html>");
    expect(new ApiError(500, "<html>").json()).toBeUndefined();
  });
});

describe("apiFetch", () => {
  it("wraps a network failure in ApiUnreachableError", async () => {
    server.use(http.get(api("/health"), () => HttpResponse.error()));

    await expect(apiFetch("/health")).rejects.toBeInstanceOf(
      ApiUnreachableError,
    );
  });

  it("defaults the JSON headers when sending a body", async () => {
    let contentType: string | null = null;
    server.use(
      http.post(api("/echo"), ({ request }) => {
        contentType = request.headers.get("Content-Type");
        return HttpResponse.json({});
      }),
    );

    await apiFetch("/echo", { method: "POST", body: "{}" });
    expect(contentType).toBe("application/json");
  });
});

describe("request timeout", () => {
  it("reports a stalled backend as unreachable rather than hanging", async () => {
    server.use(
      http.get(api("/health"), async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json({ status: "ok" });
      }),
    );

    await expect(
      apiFetch("/health", { signal: AbortSignal.timeout(10) }),
    ).rejects.toMatchObject({
      name: "ApiUnreachableError",
      message: expect.stringContaining("did not respond"),
    });
  });
});
