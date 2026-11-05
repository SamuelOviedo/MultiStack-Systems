// Primitivas nuevas de src/components/ui para el panel de administración:
// roles ARIA, nombres accesibles, estados y contrato de movimiento.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { useForm } from "react-hook-form";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PortalContainerProvider } from "@/components/ui/portal-container-context";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Patrón armado por partes para que Tailwind no genere esas utilidades al escanear este archivo.
const BANNED_MOTION = new RegExp(["transition-all", ["scale", "0"].join("-"), "\\bease" + "-in\\b"].join("|"));

beforeAll(() => {
  // jsdom no implementa estas APIs que Radix y floating-ui consultan.
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

describe("Select", () => {
  function renderSelect(onValueChange = vi.fn()) {
    render(
      <Select onValueChange={onValueChange}>
        <SelectTrigger aria-label="Estado del proyecto">
          <SelectValue placeholder="Elegir estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="activo">Activo</SelectItem>
          <SelectItem value="pausado">Pausado</SelectItem>
        </SelectContent>
      </Select>,
    );
    return onValueChange;
  }

  it("expone un combobox con nombre accesible y marcador de posición", () => {
    renderSelect();
    const trigger = screen.getByRole("combobox", { name: "Estado del proyecto" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveTextContent("Elegir estado");
  });

  it("abre con el teclado, lista opciones y notifica la elegida", async () => {
    const onValueChange = renderSelect();
    const trigger = screen.getByRole("combobox", { name: "Estado del proyecto" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const listbox = await screen.findByRole("listbox");
    const options = within(listbox).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Activo", "Pausado"]);
    fireEvent.click(options[1]);
    expect(onValueChange).toHaveBeenCalledWith("pausado");
  });

  it("contrato de movimiento: origen en el disparador, fundido+escala 95, sin deslizamiento y con movimiento reducido", async () => {
    renderSelect();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    const listbox = await screen.findByRole("listbox");
    const cls = listbox.className;
    expect(cls).toContain("origin-[--radix-select-content-transform-origin]");
    expect(cls).toContain("data-[state=open]:zoom-in-95");
    expect(cls).toContain("data-[state=open]:duration-150");
    expect(cls).toContain("[animation-timing-function:cubic-bezier(0.23,1,0.32,1)]");
    expect(cls).toContain("data-[state=closed]:duration-100");
    expect(cls).toContain("motion-reduce:data-[state=open]:zoom-in-100");
    expect(cls).not.toMatch(BANNED_MOTION);
  });
});

describe("DropdownMenu", () => {
  it("abre con el teclado y expone menú, etiqueta, elementos y separador", async () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Acciones del ticket">Acciones</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Ticket</DropdownMenuLabel>
          <DropdownMenuItem onSelect={onSelect}>Resolver</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>Convertir</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const trigger = screen.getByRole("button", { name: "Acciones del ticket" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    fireEvent.keyDown(trigger, { key: "Enter" });
    const menu = await screen.findByRole("menu");
    expect(menu.className).toContain("origin-[--radix-dropdown-menu-content-transform-origin]");
    expect(menu.className).toContain("motion-reduce:data-[state=open]:zoom-in-100");
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["Resolver", "Convertir"]);
    expect(items[1]).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(items[0]);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe("AlertDialog", () => {
  function renderDialog(onConfirm = vi.fn()) {
    render(
      <AlertDialog>
        <AlertDialogTrigger>Eliminar servicio</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este servicio?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
    return onConfirm;
  }

  it("abre un alertdialog con nombre y descripción accesibles, y el foco va a Cancelar", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar servicio" }));
    const dialog = await screen.findByRole("alertdialog", { name: "¿Eliminar este servicio?" });
    expect(dialog).toHaveAccessibleDescription("Esta acción no se puede deshacer.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus());
  });

  it("confirma con la acción y cierra con Escape sin confirmar", async () => {
    const onConfirm = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar servicio" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar servicio" }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("modal centrado: fundido+escala 95 con 200/150 ms, sin origen de disparador y con movimiento reducido", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar servicio" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.className).toContain("data-[state=open]:duration-200");
    expect(dialog.className).toContain("data-[state=closed]:duration-150");
    expect(dialog.className).toContain("motion-reduce:data-[state=open]:zoom-in-100");
    expect(dialog.className).not.toContain("origin-[");
  });

  it("se renderiza dentro del contenedor del ámbito cuando hay <PortalContainerProvider>", async () => {
    const host = document.createElement("div");
    host.className = "erp";
    document.body.appendChild(host);
    render(
      <PortalContainerProvider value={host}>
        <AlertDialog>
          <AlertDialogTrigger>Abrir</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Confirmar</AlertDialogTitle>
            <AlertDialogDescription>Detalle.</AlertDialogDescription>
          </AlertDialogContent>
        </AlertDialog>
      </PortalContainerProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(host).toContainElement(dialog);
    cleanup();
    host.remove();
  });
});

describe("Progress", () => {
  it("es un progressbar con nombre y valores", () => {
    render(<Progress value={40} aria-label="Etapas completadas" />);
    const bar = screen.getByRole("progressbar", { name: "Etapas completadas" });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("desplaza con transform (no con width), acota 0-100 y respeta movimiento reducido", () => {
    const { rerender } = render(<Progress value={150} aria-label="p" />);
    const indicator = () => screen.getByRole("progressbar").firstElementChild as HTMLElement;
    expect(indicator().style.transform).toBe("translateX(-0%)");
    rerender(<Progress value={-20} aria-label="p" />);
    expect(indicator().style.transform).toBe("translateX(-100%)");
    expect(indicator().className).toContain("transition-transform");
    expect(indicator().className).toContain("motion-reduce:transition-none");
    expect(indicator().className).not.toMatch(/transition-all|transition-\[width/);
  });
});

describe("Separator", () => {
  it("es decorativo por defecto (sin rol separator)", () => {
    const { container } = render(<Separator />);
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("data-orientation", "horizontal");
  });

  it("con decorative={false} es un separator con orientación", () => {
    render(<Separator decorative={false} orientation="vertical" />);
    expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "vertical");
  });
});

describe("Skeleton", () => {
  it("es decorativo, pulsa solo en opacidad y se apaga con movimiento reducido", () => {
    const { container } = render(<Skeleton className="h-5 w-24" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el.className).toContain("animate-pulse");
    expect(el.className).toContain("motion-reduce:animate-none");
    expect(el.className).not.toMatch(/gradient|shimmer/);
  });
});

describe("Card", () => {
  it("compone título (h3 por defecto, nivel ajustable), descripción y contenido", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
          <CardDescription>Estado general</CardDescription>
        </CardHeader>
        <CardContent>
          <CardTitle as="h4">Detalle</CardTitle>
        </CardContent>
      </Card>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Resumen" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Detalle" })).toBeInTheDocument();
    expect(screen.getByText("Estado general")).toBeInTheDocument();
  });

  it("usa borde, shadow-card y radio rounded-lg; sin degradado ni blur", () => {
    const { container } = render(<Card />);
    const cls = (container.firstElementChild as HTMLElement).className;
    expect(cls).toContain("shadow-card");
    expect(cls).toContain("rounded-lg");
    expect(cls).not.toMatch(/gradient|backdrop/);
  });
});

describe("Table", () => {
  it("expone tabla, cabeceras de columna (con aria-sort), filas y celdas", () => {
    render(
      <Table>
        <TableCaption>Tickets abiertos</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead aria-sort="ascending">Título</TableHead>
            <TableHead>Prioridad</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Error al iniciar sesión</TableCell>
            <TableCell>Alta</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole("table", { name: "Tickets abiertos" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
    expect(screen.getByRole("columnheader", { name: "Título" })).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByRole("cell", { name: "Alta" })).toBeInTheDocument();
  });

  it("el contenedor desplaza en horizontal y admite hacerse operable con teclado", () => {
    render(
      <Table containerProps={{ tabIndex: 0, role: "region", "aria-label": "Lista de tickets" }}>
        <TableBody>
          <TableRow>
            <TableCell>x</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const region = screen.getByRole("region", { name: "Lista de tickets" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region.className).toContain("overflow-x-auto");
  });
});

describe("Form", () => {
  function Demo({ onValid }: { onValid: (v: { nombre: string }) => void }) {
    const form = useForm<{ nombre: string }>({ defaultValues: { nombre: "" } });
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onValid)}>
          <FormField
            control={form.control}
            name="nombre"
            rules={{ required: "Escribe el nombre del proyecto." }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input maxLength={120} {...field} />
                </FormControl>
                <FormDescription>Se muestra en el panel.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <button type="submit">Guardar</button>
        </form>
      </Form>
    );
  }

  it("asocia etiqueta y descripción al campo", () => {
    render(<Demo onValid={vi.fn()} />);
    const input = screen.getByLabelText("Nombre");
    expect(input).toHaveAccessibleDescription("Se muestra en el panel.");
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("muestra el error en español como alerta enlazada al campo y no envía", async () => {
    const onValid = vi.fn();
    render(<Demo onValid={onValid} />);
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Escribe el nombre del proyecto.");
    const input = screen.getByLabelText("Nombre");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(alert.id);
    expect(onValid).not.toHaveBeenCalled();
  });

  it("envía cuando el valor es válido", async () => {
    const onValid = vi.fn();
    render(<Demo onValid={onValid} />);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Sitio web" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onValid).toHaveBeenCalledTimes(1));
    expect(onValid.mock.calls[0][0]).toEqual({ nombre: "Sitio web" });
  });
});

// ---- Alcance y aislamiento (análisis estático del código fuente) -------------
function listSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return listSources(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const SRC = path.resolve(__dirname, "..");
const NEW_PRIMITIVES = [
  "select",
  "dropdown-menu",
  "alert-dialog",
  "progress",
  "separator",
  "skeleton",
  "card",
  "table",
  "form",
  "form-context",
  "popover-motion",
  "portal-container-context",
];

describe("alcance de las primitivas nuevas", () => {
  // El panel (`pages/dashboard/**` y `components/dashboard/**`) es el primer consumidor. Lo que sigue prohibido
  // es que las usen la landing, el Navbar, las páginas públicas o los módulos compartidos (`common/`, `hooks/`, `lib/`).
  it("ningún módulo compartido las importa (solo ui/, admin/, el panel y pruebas)", () => {
    const importers = listSources(SRC).filter((file) => {
      const rel = path.relative(SRC, file).replace(/\\/g, "/");
      if (rel.startsWith("components/dashboard/") || rel.startsWith("pages/dashboard/")) return false;
      if (rel.startsWith("components/ui/") || rel.startsWith("components/admin/") || rel.startsWith("test/")) return false;
      const text = readFileSync(file, "utf8");
      return NEW_PRIMITIVES.some((p) => new RegExp(`from\\s+["'](@/components/ui/${p}|\\./${p}|\\.\\./ui/${p})["']`).test(text));
    });
    expect(importers).toEqual([]);
  });

  it("nada fuera de admin/, el panel y las pruebas importa src/components/admin", () => {
    const importers = listSources(SRC).filter((file) => {
      const rel = path.relative(SRC, file).replace(/\\/g, "/");
      if (rel.startsWith("components/dashboard/") || rel.startsWith("pages/dashboard/")) return false;
      if (rel.startsWith("components/admin/") || rel.startsWith("test/")) return false;
      const text = readFileSync(file, "utf8");
      const imports = [...text.matchAll(/from\s+["']@\/components\/admin\/([^"']+)["']/g)].map((m) => m[1]);
      return imports.length > 0;
    });
    expect(importers).toEqual([]);
  });

  it("las primitivas y átomos no importan módulos de la landing", () => {
    const files = [...listSources(path.join(SRC, "components/admin")), ...NEW_PRIMITIVES.map((p) => path.join(SRC, `components/ui/${p}.${p.includes("context") || p === "popover-motion" ? "ts" : "tsx"}`))];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/components\/marketing|useMsThemeVars|msTokens|framer-motion|lib\/products/);
    }
  });

  it("no usan transiciones prohibidas, aceleración de entrada, escala desde cero ni valores hex", () => {
    const files = [...listSources(path.join(SRC, "components/admin")), ...NEW_PRIMITIVES.map((p) => path.join(SRC, `components/ui/${p}.${p.includes("context") || p === "popover-motion" ? "ts" : "tsx"}`))];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(BANNED_MOTION);
      expect(text, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      // `ease-[...]` es ambiguo con tailwindcss-animate: Tailwind lo descarta en silencio.
      expect(text, file).not.toMatch(/\bease-\[/);
    }
  });
});
