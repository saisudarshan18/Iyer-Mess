import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { sendTemplate, templateRequest } = await import("./whatsapp");

describe("whatsapp templates", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("builds a Cloud API template request with a normalised number", () => {
    const r = templateRequest({ to: "+91 75400 50606", name: "order_update", body: ["Ravi", "IM1001", "confirmed", "We'll start\non it soon."], urlSuffix: "abc" });
    expect(r).toMatchObject({ messaging_product: "whatsapp", to: "917540050606", type: "template", template: { name: "order_update", language: { code: "en" } } });
    const [body, button] = r!.template.components as { type: string; parameters: { text: string }[] }[];
    expect(body.parameters.map((p) => p.text)).toEqual(["Ravi", "IM1001", "confirmed", "We'll start on it soon."]);
    expect(button).toMatchObject({ type: "button", sub_type: "url", index: "0", parameters: [{ text: "abc" }] });
  });

  it("refuses numbers that aren't Indian mobiles", () => {
    expect(templateRequest({ to: "12345", name: "x", body: [] })).toBeNull();
  });

  it("does nothing until the keys are set", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("WHATSAPP_TOKEN", "");
    await sendTemplate({ to: "9445012345", name: "order_update", body: ["a"] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to the phone number's messages endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("WHATSAPP_TOKEN", "t");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123");
    await sendTemplate({ to: "9445012345", name: "shop_new_order", body: ["IM1"] });
    expect(fetchMock.mock.calls[0][0]).toBe("https://graph.facebook.com/v21.0/123/messages");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer t");
  });
});
