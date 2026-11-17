import { test, expect, type Page } from "@playwright/test";
import { USERS, fakeJwt, fromPanel, mockSupabase, panelSeen, signIn, watchForAdminContent, type Role } from "./support/supabase-simulado";

// Acceso al panel por rol, con Supabase SIMULADO: ninguna petición sale a la red. Los ayudantes (simulacro de
// /auth/v1, /rest/v1 y /functions/v1, usuarios ficticios, marcas del panel) viven en `e2e/support/supabase-simulado.ts`,
// compartidos con `cotizaciones-acceso.spec.ts`. Solo prueba la INTERFAZ: la API real se protege con RLS, que esta
// prueba no toca.

const PANEL_PATHS = ["/dashboard", "/dashboard/tickets"] as const;

/** Lo que solo existe cuando el panel está montado, por ruta. */
const panelReady = (page: Page, path: (typeof PANEL_PATHS)[number]) =>
  path === "/dashboard" ? page.locator("#contenido") : page.getByRole("heading", { level: 1, name: "Tickets" });
const DENIED: ReadonlyArray<readonly [Role, string]> = [
  [1, "/"],
  [2, "/solicitudes"],
];

test.describe("Dashboard is administrator-only (UI)", () => {
  for (const path of PANEL_PATHS) {
    test(`administrator (0) opens ${path} directly`, async ({ page, context, baseURL }) => {
      await mockSupabase(context, baseURL!, 0);
      await signIn(page, 0);
      await page.goto(path);
      await expect(panelReady(page, path)).toBeVisible({ timeout: 15000 });
      expect(new URL(page.url()).pathname).toBe(path);
    });

    for (const [role, destination] of DENIED) {
      test(`role ${role} typing ${path} ends on ${destination} and never sees the panel`, async ({ page, context, baseURL }) => {
        const mock = await mockSupabase(context, baseURL!, role);
        await watchForAdminContent(page);
        await signIn(page, role);
        mock.dataQueries.length = 0;

        await page.goto(path);
        await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe(destination);

        await expect(panelReady(page, path)).toHaveCount(0);
        expect(await panelSeen(page)).toEqual([]);
        // Ninguna consulta de datos lanzada desde una pantalla del panel.
        expect(fromPanel(mock)).toEqual([]);
      });
    }
  }

  // El hueco real: sesión nueva en la misma pestaña, con el rol aún por resolver (la respuesta del perfil tarda).
  for (const path of PANEL_PATHS) {
    for (const role of [0, 1, 2] as const) {
      test(`role ${role} navigating to ${path} while the role is still resolving`, async ({ page, context, baseURL }) => {
        const mock = await mockSupabase(context, baseURL!, role, 2500);
        await watchForAdminContent(page);

        await page.goto("/login");
        await page.getByLabel(/Email de trabajo/i).fill(USERS[role].email);
        await page.getByLabel(/^Contraseña$/i).fill("clave-de-prueba-1");
        const tokenResponse = page.waitForResponse((r) => r.url().includes("/auth/v1/token"));
        await page.getByRole("button", { name: "Iniciar sesión" }).click();
        await tokenResponse;

        // Navegación dentro de la SPA (como un enlace o el botón «atrás»), con la sesión ya guardada pero el rol sin llegar.
        await page.evaluate((target) => {
          window.history.pushState({}, "", target);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }, path);
        expect(new URL(page.url()).pathname).toBe(path);

        // Captura del DOM durante la resolución: solo el cargador de marca, nada del panel.
        const sampled: string[] = [];
        const deadline = Date.now() + 1500;
        while (Date.now() < deadline) {
          sampled.push(
            await page.evaluate(() => {
              const sidebar = document.querySelector("#admin-sidebar") ? "panel" : "";
              const content = document.querySelector("#contenido") ? "panel" : "";
              const tickets = Array.from(document.querySelectorAll("h1")).some((h) => h.textContent?.trim() === "Tickets") ? "panel" : "";
              const logo = document.querySelector('img[alt="MultiStack Systems Logo"]') ? "logo" : "";
              return [sidebar, content, tickets, logo].filter(Boolean).join("+") || "vacío";
            }),
          );
          await page.waitForTimeout(100);
        }
        expect(sampled.filter((s) => s.includes("panel"))).toEqual([]);
        expect(sampled).toContain("logo");
        expect(fromPanel(mock)).toEqual([]);

        // El rol llega: el administrador ve el panel; los demás terminan en su destino sin haberlo visto.
        if (role === 0) {
          await expect(panelReady(page, path)).toBeVisible({ timeout: 15000 });
          expect(new URL(page.url()).pathname).toBe(path);
        } else {
          const destination = role === 1 ? "/" : "/solicitudes";
          await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe(destination);
          expect(await panelSeen(page)).toEqual([]);
        }
      });
    }
  }

  // Cambio de cuenta con el panel del administrador abierto: otra pestaña del mismo navegador inicia sesión con otra
  // cuenta y supabase-js avisa a ésta (SIGNED_IN de otro usuario, sin SIGNED_OUT). El rol del administrador no debe
  // quedar emparejado con la sesión nueva mientras llega el rol nuevo.
  for (const path of PANEL_PATHS) {
    for (const next of [1, 2] as const) {
      test(`admin on ${path}, then role ${next} signs in from another tab while its role is resolving`, async ({ page, context, baseURL }) => {
        const mock = await mockSupabase(context, baseURL!, 0, 2500, [next]);
        await watchForAdminContent(page);
        await signIn(page, 0);
        await page.goto(path);
        await expect(panelReady(page, path)).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(500); // que terminen las lecturas del administrador
        mock.dataQueries.length = 0;

        // Otra pestaña abre un enlace de acceso de la otra cuenta (confirmación / enlace mágico, flujo implícito): el
        // formulario de /login no está disponible con una sesión abierta, y esta es la vía real de un cambio de cuenta.
        const other = await context.newPage();
        const link = `/#access_token=${fakeJwt(USERS[next].id)}&refresh_token=r&expires_in=3600&token_type=bearer&type=magiclink`;
        await other.goto(link);

        // La pestaña del administrador se entera por supabase-js: el panel se desmonta y queda el cargador de marca.
        await expect(panelReady(page, path)).toHaveCount(0, { timeout: 5000 });
        await page.evaluate(() => ((window as unknown as { __panelSeen: string[] }).__panelSeen = []));
        const sampled: string[] = [];
        const deadline = Date.now() + 1500;
        while (Date.now() < deadline) {
          sampled.push(
            await page.evaluate(() => {
              const sidebar = document.querySelector("#admin-sidebar") ? "panel" : "";
              const content = document.querySelector("#contenido") ? "panel" : "";
              const tickets = Array.from(document.querySelectorAll("h1")).some((h) => h.textContent?.trim() === "Tickets") ? "panel" : "";
              const logo = document.querySelector('img[alt="MultiStack Systems Logo"]') ? "logo" : "";
              return [sidebar, content, tickets, logo].filter(Boolean).join("+") || "vacío";
            }),
          );
          await page.waitForTimeout(100);
        }
        expect(sampled.filter((s) => s.includes("panel"))).toEqual([]);
        expect(sampled).toContain("logo");
        expect(await panelSeen(page)).toEqual([]);
        expect(fromPanel(mock)).toEqual([]);

        // El rol nuevo llega: la pestaña termina en el destino de esa cuenta, sin haber vuelto a ver el panel.
        const destination = next === 1 ? "/" : "/solicitudes";
        await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe(destination);
        expect(await panelSeen(page)).toEqual([]);
        expect(fromPanel(mock)).toEqual([]);
      });
    }
  }
});
