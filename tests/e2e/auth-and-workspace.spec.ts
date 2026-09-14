import { test, expect } from "@playwright/test";

test("login screen is reachable and exposes the expected auth controls", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "تسجيل الدخول" })).toBeVisible();
  await expect(page.getByLabel("البريد الإلكتروني")).toBeVisible();
  await expect(page.getByLabel("كلمة المرور")).toBeVisible();
  await expect(page.getByRole("button", { name: "تسجيل الدخول" })).toBeVisible();
});

test("unauthenticated workspace access is rejected", async ({ page }) => {
  await page.goto("/workspace");
  await expect(page).toHaveURL(/\/login\?next=%2Fworkspace|\/login\?next=\/workspace/);
});

test("authenticated workspace journey", async ({ page }) => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD for the authenticated release journey.");

  await page.goto("/login?next=/start");
  await page.getByLabel("البريد الإلكتروني").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("كلمة المرور").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();

  await expect(page).toHaveURL(/\/start|\/workspace/);
  if (page.url().endsWith("/start")) {
    const companyEntry = page.getByRole("button", { name: /دخول/ }).first();
    if (await companyEntry.isVisible().catch(() => false)) await companyEntry.click();
  }

  await expect(page).toHaveURL(/\/workspace/);
  await expect(page.getByText("مركز البيانات المالية")).toBeVisible();
  await expect(page.getByText("دليل الحسابات")).toBeVisible();
});
