import { test, expect } from "@playwright/test";

test("homepage carga sin errores", async ({ page }) => {
  await page.goto("/");
  // Verificamos que no hay error 500 ni pantalla en blanco
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("nav")).toBeVisible();
});

test("health endpoint responde correctamente", async ({ request }) => {
  const response = await request.get("http://localhost:8080/health");
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toEqual({ status: "ok" });
});