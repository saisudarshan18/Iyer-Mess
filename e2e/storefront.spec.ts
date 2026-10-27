import { expect, test, type Page } from "@playwright/test";

/** The header hides while scrolling down, so scroll up to bring the cart button back. */
async function openCart(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const cart = page.locator("[data-cart-target]");
  await expect(cart).toBeInViewport();
  await cart.click();
}

// Runs against `next start` with or without Supabase connected.

test("home renders every chapter without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Iyer");
  for (const id of ["story", "almanac", "combos"]) await expect(page.locator(`#${id}`)).toBeAttached();
  await expect(page.getByText("₹650").first()).toBeAttached(); // Combo 1 incl. packing
  expect(errors).toEqual([]);
});

test("menu: filter, pick a weight, cart totals", async ({ page }) => {
  await page.goto("/menu");
  await page.getByRole("button", { name: /^Savories/ }).click();
  await expect(page.getByRole("link", { name: /^Laddu/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Mullu Murukku/ })).toHaveCount(1);
  await expect(page.getByRole("link", { name: /^Rava Laddu/ })).toHaveCount(0);
  await page.getByRole("button", { name: /^All/ }).click();
  const row = page.locator("li", { has: page.getByRole("link", { name: /^Laddu/ }) });
  test.skip(await row.getByText("Sold out").isVisible(), "Laddu has no stock in this database");
  await row.getByRole("button", { name: /Add/ }).click();
  await row.getByRole("button", { name: /½ kg/ }).click();
  await openCart(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Laddu");
  await expect(dialog).toContainText("₹300");
});

test("item page adds the chosen size and quantity", async ({ page }) => {
  await page.goto("/item/cashewnut-cake");
  test.skip(await page.getByRole("button", { name: "Sold out" }).isVisible(), "no stock in this database");
  // ¼ kg × 2 = ₹600; skips if the live stock is below 500 g
  await page.getByRole("radio", { name: /¼ kg/ }).click();
  await page.getByRole("button", { name: "Increase" }).click();
  const add = page.getByRole("button", { name: /Add to box · ₹600/ });
  test.skip(!(await add.isVisible()), "not enough stock in this database");
  await add.click();
  await openCart(page);
  await expect(page.getByRole("dialog")).toContainText("Cashewnut Cake");
});

test("checkout requires login", async ({ page }) => {
  await page.goto("/checkout");
  await expect(page).toHaveURL(/\/login/);
});

test("footer credit links to Team Code and opens in a new tab", async ({ page }) => {
  await page.goto("/menu");
  const credit = page.getByRole("link", { name: /Made with love by Team Code/ });
  await expect(credit).toHaveAttribute("href", "https://www.teamcode.in/");
  await expect(credit).toHaveAttribute("target", "_blank");
});

test("pages carry Open Graph tags and a share image", async ({ page, request }) => {
  await page.goto("/item/laddu");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /Laddu/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  const img = await page.locator('meta[property="og:image"]').getAttribute("content");
  const res = await request.get(new URL(new URL(img!).pathname + new URL(img!).search, page.url()).toString());
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");
});

test("every public page has a share image (Discord, WhatsApp, X)", async ({ request }) => {
  for (const path of ["/", "/menu", "/combos", "/contact", "/privacy", "/terms", "/item/laddu"]) {
    const html = await (await request.get(path)).text();
    const img = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
    expect(img, `${path} og:image`).toBeTruthy();
    expect(html, `${path} twitter:image`).toContain('name="twitter:image"');
    const u = new URL(img!);
    const res = await request.get(u.pathname + u.search);
    expect(res.status(), `${path} image loads`).toBe(200);
  }
});

test("refund and delivery policy pages are linked from the footer", async ({ page }) => {
  for (const [path, heading] of [["/refunds", "Cancellations & refunds"], ["/shipping", "Delivery & shipping"]] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expect(page.locator(`footer a[href="${path}"]`)).toBeAttached();
  }
});

test("WhatsApp webhook rejects a wrong verify token and an unsigned post", async ({ request }) => {
  expect((await request.get("/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1")).status()).toBe(403);
  expect((await request.post("/api/whatsapp/webhook", { data: { entry: [] } })).status()).toBe(401);
});

test("admin on a phone asks for login without horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login|\/admin/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
