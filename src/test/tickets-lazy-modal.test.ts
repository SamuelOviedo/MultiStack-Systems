// El modal «Alcance» (formulario, select y diálogo) no viaja con el cajón de tickets: se pide al abrirlo o al
// apuntar al botón «Convertir en proyecto». Lo que hace el modal lo fijan tickets-drawer y las pruebas del modal.
import { describe, expect, it } from "vitest";
import drawerSource from "@/components/dashboard/tickets/TicketDrawer.tsx?raw";

describe("cajón de tickets · modal «Alcance» bajo demanda", () => {
  it("no importa ProjectScopingModal de forma estática y usa la versión perezosa", () => {
    expect(drawerSource).not.toContain('requests/ProjectScopingModal"');
    expect(drawerSource).toContain("LazyProjectScopingModal");
    expect(drawerSource).toContain("loadProjectScopingModal");
  });

  it("se arma al pulsar el botón y se adelanta al apuntarlo o enfocarlo", () => {
    expect(drawerSource).toContain("setScopingArmed(true)");
    expect(drawerSource).toMatch(/onPointerEnter=\{\(\) => void loadProjectScopingModal\(\)\}/);
    expect(drawerSource).toMatch(/onFocus=\{\(\) => void loadProjectScopingModal\(\)\}/);
  });
});
