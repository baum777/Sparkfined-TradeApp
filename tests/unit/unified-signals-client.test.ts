import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchUnifiedSignals } from "../../src/lib/api/feed";

function makeResponse(init: { ok: boolean; status: number; body: unknown; statusText?: string }): Response {
  const text = init.body === undefined ? "" : JSON.stringify(init.body);
  return new Response(text, {
    status: init.status,
    statusText: init.statusText,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchUnifiedSignals (canonical /signals/unified contract)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws a controlled error when asset is missing (prevents silent empty / 400)", async () => {
    await expect(fetchUnifiedSignals("")).rejects.toThrow(/asset/i);
  });

  it("calls /api/signals/unified with asset param and omits default filter/sort", async () => {
    const fetchMock = vi.fn(async (url: any) =>
      makeResponse({
        ok: true,
        status: 200,
        body: { data: { items: [] }, status: 200 },
      })
    );
    vi.stubGlobal("fetch", fetchMock as any);

    await fetchUnifiedSignals("SOL");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("/api/signals/unified?");
    expect(calledUrl).toContain("asset=SOL");
    expect(calledUrl).not.toContain("filter=");
    expect(calledUrl).not.toContain("sort=");
  });

  it("includes filter/sort only when non-default values are provided", async () => {
    const fetchMock = vi.fn(async () =>
      makeResponse({
        ok: true,
        status: 200,
        body: { data: { items: [] }, status: 200 },
      })
    );
    vi.stubGlobal("fetch", fetchMock as any);

    await fetchUnifiedSignals("BTC", "market", "newest");

    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("asset=BTC");
    expect(calledUrl).toContain("filter=market");
    expect(calledUrl).toContain("sort=newest");
  });
});

