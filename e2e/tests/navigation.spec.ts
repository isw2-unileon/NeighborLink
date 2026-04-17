import { test, expect } from "@playwright/test";

test("homepage carga con navbar de NeighborLink", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav")).toBeVisible();
    await expect(page.locator("nav")).toContainText("NeighborLink");
});

test("navbar muestra enlaces públicos cuando no hay sesión", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Explorar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Registrarse" })).toBeVisible();
});

test("/profile sin token redirige a /login", async ({ page }) => {
    // Nos aseguramos de que no hay token en localStorage
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());

    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/);
});