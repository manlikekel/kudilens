import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * Runs public/sw.js against a small fake service-worker environment (caches, fetch, clients,
 * registration) to check its caching, offline fallbacks, background sync and notifications.
 */

type Handler = (event: Record<string, unknown>) => void;
const ORIGIN = "https://kudilens.app";

function setup(network: { online: boolean; body?: string }) {
  const handlers: Record<string, Handler> = {};
  const stores = new Map<string, Map<string, Response>>();
  const keyOf = (req: Request | string) =>
    new URL(typeof req === "string" ? req : req.url, ORIGIN).href;
  const cacheFor = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      match: async (req: Request | string) => m.get(keyOf(req))?.clone(),
      put: async (req: Request | string, res: Response) => void m.set(keyOf(req), res),
      addAll: async (urls: string[]) =>
        urls.forEach((u) => m.set(keyOf(u), new Response(`cached ${u}`))),
    };
  };
  const notifications: { title: string; options: Record<string, unknown> }[] = [];
  const fetched: string[] = [];
  const widgetUpdates: { tag: string; template: string; data: string }[] = [];
  const self = {
    widgets: {
      getByTag: async (tag: string) => ({
        definition: {
          tag,
          msAcTemplate: `/widgets/${tag}-template.json`,
          data: `/widgets/${tag}-data.json`,
        },
      }),
      updateByTag: async (tag: string, payload: { template: string; data: string }) =>
        void widgetUpdates.push({ tag, ...payload }),
    },
    location: new URL(ORIGIN),
    addEventListener: (type: string, fn: Handler) => (handlers[type] = fn),
    skipWaiting: () => undefined,
    clients: {
      claim: async () => undefined,
      matchAll: async () => [],
      openWindow: async () => undefined,
    },
    registration: {
      navigationPreload: null,
      showNotification: async (title: string, options: Record<string, unknown>) =>
        void notifications.push({ title, options }),
    },
  };
  const g = globalThis as Record<string, unknown>;
  g["self"] = self;
  g["caches"] = {
    open: async (n: string) => cacheFor(n),
    keys: async () => [...stores.keys()],
    delete: async (n: string) => stores.delete(n),
    match: async (req: Request | string) => {
      for (const m of stores.values()) {
        const hit = m.get(keyOf(req));
        if (hit) return hit.clone();
      }
      return undefined;
    },
  };
  g["fetch"] = async (req: Request | string) => {
    fetched.push(keyOf(req));
    if (!network.online) throw new TypeError("offline");
    return new Response(network.body ?? "fresh", { status: 200 });
  };
  new Function(readFileSync(resolve(__dirname, "../../public/sw.js"), "utf8"))();

  /** dispatches an event and resolves with what the worker answered or waited on */
  const dispatch = async (type: string, event: Record<string, unknown> = {}) => {
    let responded: Promise<Response> | undefined;
    const waits: Promise<unknown>[] = [];
    handlers[type]!({
      ...event,
      respondWith: (p: Promise<Response>) => (responded = Promise.resolve(p)),
      waitUntil: (p: Promise<unknown>) => void waits.push(p),
    });
    await Promise.all(waits);
    return responded ? await responded : undefined;
  };
  const get = (path: string, mode = "cors") => ({
    request: { method: "GET", url: ORIGIN + path, mode } as unknown as Request,
  });
  return { dispatch, get, stores, notifications, fetched, network, widgetUpdates };
}

describe("service worker", () => {
  let sw: ReturnType<typeof setup>;
  beforeEach(async () => {
    sw = setup({ online: true });
    await sw.dispatch("install");
    await sw.dispatch("activate");
  });

  it("precaches the offline page and icons on install", () => {
    const shell = sw.stores.get("kudilens-v2-shell")!;
    expect([...shell.keys()]).toContain(`${ORIGIN}/offline.html`);
    expect([...shell.keys()]).toContain(`${ORIGIN}/icons/icon-512.png`);
  });

  it("serves the offline page when a navigation fails with no saved copy", async () => {
    sw.network.online = false;
    const res = await sw.dispatch("fetch", sw.get("/plan", "navigate"));
    expect(await res!.text()).toBe("cached /offline.html");
  });

  it("serves the last loaded page when offline after a successful visit", async () => {
    sw.network.body = "<html>app</html>";
    await sw.dispatch("fetch", sw.get("/", "navigate"));
    await new Promise((r) => setTimeout(r, 0));
    sw.network.online = false;
    const res = await sw.dispatch("fetch", sw.get("/plan", "navigate"));
    expect(await res!.text()).toBe("<html>app</html>");
  });

  it("keeps public market data for offline use (stale-while-revalidate)", async () => {
    sw.network.body = '{"inflation":15.39}';
    const first = await sw.dispatch("fetch", sw.get("/api/market"));
    expect(await first!.text()).toBe('{"inflation":15.39}');
    await new Promise((r) => setTimeout(r, 0));
    sw.network.online = false;
    const offline = await sw.dispatch("fetch", sw.get("/api/market"));
    expect(await offline!.text()).toBe('{"inflation":15.39}');
  });

  it("never intercepts personal data or other API calls", async () => {
    expect(await sw.dispatch("fetch", sw.get("/api/advisor"))).toBeUndefined();
    expect(
      await sw.dispatch("fetch", {
        request: { method: "GET", url: "https://xyz.supabase.co/rest/v1/debts", mode: "cors" },
      }),
    ).toBeUndefined();
    expect(
      await sw.dispatch("fetch", {
        request: { method: "POST", url: `${ORIGIN}/api/market`, mode: "cors" },
      }),
    ).toBeUndefined();
  });

  it("refreshes market data on background sync", async () => {
    sw.fetched.length = 0;
    await sw.dispatch("sync", { tag: "refresh-market" });
    expect(sw.fetched).toContain(`${ORIGIN}/api/market`);
    expect(sw.fetched).toContain(`${ORIGIN}/api/ng-funds`);
  });

  it("shows pushed notifications with a link to open", async () => {
    await sw.dispatch("push", {
      data: {
        json: () => ({ title: "Check-in time", body: "Update your balances", url: "/records" }),
      },
    });
    expect(sw.notifications[0]).toMatchObject({
      title: "Check-in time",
      options: { body: "Update your balances", data: { url: "/records" } },
    });
  });

  it("keeps a shared statement on the device and opens Spending to import it", async () => {
    const form = new FormData();
    form.append(
      "statement",
      new File(["Date,Amount\n2026-10-01,-500"], "gtbank.csv", { type: "text/csv" }),
    );
    const res = await sw.dispatch("fetch", {
      request: new Request(`${ORIGIN}/share-target`, { method: "POST", body: form }),
    });
    expect(res!.status).toBe(303);
    expect(res!.headers.get("Location")).toBe(`${ORIGIN}/spending?shared=1`);
    const saved = sw.stores.get("kudilens-share")!.get(`${ORIGIN}/__shared/statement`)!;
    expect(await saved.text()).toContain("2026-10-01");
    expect(decodeURIComponent(saved.headers.get("X-Filename")!)).toBe("gtbank.csv");
  });

  it("opens Ask Kudi with shared text filled in", async () => {
    const form = new FormData();
    form.append("text", "Your account was debited N25,000");
    const res = await sw.dispatch("fetch", {
      request: new Request(`${ORIGIN}/share-target`, { method: "POST", body: form }),
    });
    expect(res!.headers.get("Location")).toBe(
      `${ORIGIN}/advisor?q=${encodeURIComponent("Your account was debited N25,000")}`,
    );
  });

  it("stores the dashboard summary and refreshes the My money widget", async () => {
    sw.network.body = '{"type":"AdaptiveCard"}';
    await sw.dispatch("message", { data: { type: "widget-data", data: { safe: "₦10K" } } });
    const saved = sw.stores.get("kudilens-widgets")!.get(`${ORIGIN}/widgets/money-data.json`)!;
    expect(JSON.parse(await saved.text())).toEqual({ safe: "₦10K" });
    expect(sw.widgetUpdates.at(-1)).toMatchObject({ tag: "money", data: '{"safe":"₦10K"}' });
  });
});
