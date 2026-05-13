import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test("renders heading and OAuth buttons", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" })
    ).toBeVisible();

    await expect(page.getByRole("button", { name: /GitHub/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Google/ })).toBeVisible();
  });

  test("renders email and password fields", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByLabel(/Email de trabajo/i)).toBeVisible();
    await expect(page.getByLabel(/Contraseña/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Iniciar sesión" })
    ).toBeVisible();
  });

  test("has a link to signup", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("link", { name: /Regístrate/ })).toBeVisible();
  });
});

test.describe("Protected routes — unauthenticated", () => {
  test("redirect /dashboard to /login when not authenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirect /dashboard/tickets to /login when not authenticated", async ({ page }) => {
    await page.goto("/dashboard/tickets");
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Landing page", () => {
  test("loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");

    expect(errors).toHaveLength(0);
  });
});
