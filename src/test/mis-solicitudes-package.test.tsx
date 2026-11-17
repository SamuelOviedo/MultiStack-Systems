import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Sesión de un cliente: la página solo lee el correo.
// El objeto de sesión es estable: la página recarga la lista cada vez que `user` cambia de identidad.
const session = vi.hoisted(() => ({ user: { email: "cliente@example.test" } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => session }));

// Nunca se llama al backend.
const tickets = vi.hoisted(() => ({
  createSolicitud: vi.fn(),
  getSolicitudesByEmail: vi.fn(),
}));
vi.mock("@/lib/tickets", () => tickets);

const toastSpy = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastSpy }) }));

// Barra, logo y cargador fuera: traen temas y auth que esta página no necesita para sus pruebas.
vi.mock("@/components/common/Navbar", () => ({ default: () => null }));
vi.mock("@/components/common/Logo", () => ({ default: () => null }));
vi.mock("@/components/common/BrandLoader", () => ({ default: () => null }));

import MisSolicitudes from "@/pages/client/MisSolicitudes";
import { PACKAGE_INTENT_KEY, readPackageIntent, rememberPackageIntent } from "@/lib/packageIntent";

const COMBO_TITLE = "Solicitud: Combo Emprendedor";
const COMBO_DESCRIPTION = [
  "Paquete solicitado: Combo Emprendedor (L 3,950)",
  "Consentimiento para compartir datos con LAU Graphic: aceptado al enviar esta solicitud (texto de autorización v1; política de privacidad v1.2).",
  "Esta solicitud no es un pago ni un contrato.",
  "",
  "Negocio: Panadería Luna",
  "Mensaje del cliente:",
  "> Quiero mi logo y mi página.",
].join("\n");
const CONSENT_LABEL =
  "Autorizo a MultiStack Systems a compartir con LAU Graphic mi nombre, mi correo, el nombre de mi negocio y la información necesaria para diseñar mi logo, solo para diseñar el logo de mi Combo Emprendedor.";
const NOT_A_PAYMENT =
  "Esto es una solicitud, no un pago ni un contrato. Te contactamos para confirmar el paquete y los siguientes pasos.";

const Where = () => {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
};

function renderPage(url = "/solicitudes") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/solicitudes" element={<MisSolicitudes />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

const consent = () => screen.getByRole("checkbox", { name: CONSENT_LABEL });
const submit = () => screen.getByRole("button", { name: "[ ENVIAR SOLICITUD ]" });
const where = () => screen.getByTestId("where").textContent;

// jsdom no trae ResizeObserver y la casilla de Radix lo usa para medirse.
beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

beforeEach(() => {
  window.localStorage.clear();
  tickets.createSolicitud.mockReset().mockResolvedValue(undefined);
  tickets.getSolicitudesByEmail.mockReset().mockResolvedValue([]);
  toastSpy.mockReset();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("MisSolicitudes · sin paquete (formulario normal)", () => {
  it("no muestra el modo paquete: el formulario sigue cerrado hasta pulsar «Nueva solicitud»", async () => {
    renderPage();
    await waitFor(() => expect(tickets.getSolicitudesByEmail).toHaveBeenCalledWith("cliente@example.test"));

    expect(screen.queryByText("Paquete seleccionado")).toBeNull();
    expect(screen.queryByRole("form")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "[ NUEVA SOLICITUD ]" }));

    expect(screen.getByText("Tipo de servicio")).toBeInTheDocument();
    expect(screen.queryByText("Paquete seleccionado")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("enviar el formulario normal llama a createSolicitud como antes", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "[ NUEVA SOLICITUD ]" }));
    fireEvent.change(screen.getByPlaceholderText(/Describe qué necesitas/), { target: { value: "Quiero una tienda" } });
    fireEvent.click(screen.getByRole("button", { name: "[ ENVIAR SOLICITUD ]" }));

    await waitFor(() => expect(tickets.createSolicitud).toHaveBeenCalledTimes(1));
    expect(tickets.createSolicitud).toHaveBeenCalledWith(
      "cliente@example.test",
      "cliente@example.test",
      "Página web corporativa",
      "Tipo de servicio: Página web corporativa\n\nQuiero una tienda",
    );
  });

  it("un ?paquete= inválido se ignora y no abre el modo paquete", async () => {
    renderPage("/solicitudes?paquete=admin");
    await waitFor(() => expect(tickets.getSolicitudesByEmail).toHaveBeenCalled());

    expect(screen.queryByText("Paquete seleccionado")).toBeNull();
    expect(screen.queryByRole("button", { name: "[ ENVIAR SOLICITUD ]" })).toBeNull();
  });
});

describe("MisSolicitudes · modo paquete", () => {
  it("con ?paquete=combo-emprendedor abre el formulario con el recuadro del paquete", async () => {
    renderPage("/solicitudes?paquete=combo-emprendedor");

    const box = await screen.findByRole("region", { name: "Paquete seleccionado" });
    expect(within(box).getByText("Combo Emprendedor")).toBeInTheDocument();
    expect(within(box).getByText("L 3,950")).toHaveAttribute("aria-hidden", "true");
    expect(within(box).getByText("3950 lempiras")).toHaveClass("sr-only");
    expect(within(box).getByText("Incluye el diseño de tu logo.")).toBeInTheDocument();
    expect(within(box).getByRole("button", { name: "Quitar paquete" })).toBeInTheDocument();
    expect(screen.getByText(NOT_A_PAYMENT)).toBeInTheDocument();
    expect(screen.queryByText("Tipo de servicio")).toBeNull();
  });

  it("con la intención guardada (sin ?paquete) también abre el modo paquete", async () => {
    rememberPackageIntent("estandar");
    renderPage();

    const box = await screen.findByRole("region", { name: "Paquete seleccionado" });
    expect(within(box).getByText("Plan Estándar")).toBeInTheDocument();
    expect(within(box).getByText("3500 lempiras")).toBeInTheDocument();
  });

  it("la URL manda sobre lo guardado", async () => {
    rememberPackageIntent("estandar");
    renderPage("/solicitudes?paquete=combo-emprendedor");

    const box = await screen.findByRole("region", { name: "Paquete seleccionado" });
    expect(within(box).getByText("Combo Emprendedor")).toBeInTheDocument();
  });

  it("al abrir, el foco está en el recuadro del paquete", async () => {
    renderPage("/solicitudes?paquete=combo-emprendedor");

    const box = await screen.findByRole("region", { name: "Paquete seleccionado" });
    expect(document.activeElement).toBe(box);
  });

  it("los campos tienen etiqueta real (label htmlFor) y los límites 120 y 2000", async () => {
    renderPage("/solicitudes?paquete=estandar");

    const business = await screen.findByLabelText(/^Nombre de tu negocio/);
    const message = screen.getByLabelText(/^Cuéntanos de tu negocio o lo que necesitas/);
    expect(business).toHaveAttribute("maxlength", "120");
    expect(message).toHaveAttribute("maxlength", "2000");
    expect(business.tagName).toBe("INPUT");
    expect(message.tagName).toBe("TEXTAREA");
    expect(business).not.toBeRequired();
    expect(message).not.toBeRequired();
    expect(screen.getByText("Nombre de tu negocio").closest("label")).toHaveAttribute("for", business.id);
  });

  it("los objetivos táctiles propios (Quitar paquete, casilla, enviar) son de 24 px o más", async () => {
    renderPage("/solicitudes?paquete=combo-emprendedor");

    expect(await screen.findByRole("button", { name: "Quitar paquete" })).toHaveClass("min-h-8"); // 32 px
    expect(consent()).toHaveClass("h-6", "w-6"); // 24 px
    expect(submit()).toHaveClass("h-10"); // 40 px
  });
});

describe("MisSolicitudes · casilla de LAU Graphic (Combo)", () => {
  it("el Combo trae la casilla obligatoria con el texto exacto, y el envío está bloqueado sin marcarla", async () => {
    renderPage("/solicitudes?paquete=combo-emprendedor");
    await screen.findByRole("region", { name: "Paquete seleccionado" });

    expect(consent()).toHaveAttribute("aria-required", "true");
    expect(consent()).not.toBeChecked();
    expect(submit()).toBeDisabled();
    // Mensaje visible y asociado a la casilla (aria-describedby).
    expect(consent()).toHaveAccessibleDescription("Marca la casilla para poder enviar tu solicitud.");

    fireEvent.submit(submit().closest("form")!);
    expect(tickets.createSolicitud).not.toHaveBeenCalled();
  });

  it("al marcarla se habilita el envío y desaparece el aviso", async () => {
    renderPage("/solicitudes?paquete=combo-emprendedor");
    await screen.findByRole("region", { name: "Paquete seleccionado" });

    fireEvent.click(consent());

    expect(consent()).toBeChecked();
    expect(submit()).toBeEnabled();
    expect(screen.queryByText("Marca la casilla para poder enviar tu solicitud.")).toBeNull();
    // Sin ayuda en pantalla, la casilla no apunta a un id que ya no existe.
    expect(consent()).not.toHaveAttribute("aria-describedby");

    fireEvent.click(consent());
    expect(submit()).toBeDisabled();
  });

  it("con la casilla marcada llama a createSolicitud con el título y la descripción exactos", async () => {
    renderPage("/solicitudes?paquete=combo-emprendedor");
    await screen.findByRole("region", { name: "Paquete seleccionado" });

    fireEvent.change(screen.getByLabelText(/^Nombre de tu negocio/), { target: { value: "  Panadería Luna " } });
    fireEvent.change(screen.getByLabelText(/^Cuéntanos de tu negocio/), { target: { value: "Quiero mi logo y mi página." } });
    fireEvent.click(consent());
    fireEvent.click(submit());

    await waitFor(() => expect(tickets.createSolicitud).toHaveBeenCalledTimes(1));
    expect(tickets.createSolicitud).toHaveBeenCalledWith(
      "cliente@example.test",
      "cliente@example.test",
      COMBO_TITLE,
      COMBO_DESCRIPTION,
    );
  });

  it("el Estándar no lleva casilla y se envía sin ella", async () => {
    renderPage("/solicitudes?paquete=estandar");
    await screen.findByRole("region", { name: "Paquete seleccionado" });

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText(/LAU Graphic/)).toBeNull();
    expect(submit()).toBeEnabled();

    fireEvent.click(submit());

    await waitFor(() => expect(tickets.createSolicitud).toHaveBeenCalledTimes(1));
    expect(tickets.createSolicitud).toHaveBeenCalledWith(
      "cliente@example.test",
      "cliente@example.test",
      "Solicitud: Plan Estándar",
      "Paquete solicitado: Plan Estándar (L 3,500)\nEsta solicitud no es un pago ni un contrato.",
    );
  });
});

describe("MisSolicitudes · Quitar paquete", () => {
  it("borra la intención, limpia ?paquete con replace y vuelve al formulario normal", async () => {
    rememberPackageIntent("combo-emprendedor");
    renderPage("/solicitudes?paquete=combo-emprendedor&otro=1");
    await screen.findByRole("region", { name: "Paquete seleccionado" });

    fireEvent.click(screen.getByRole("button", { name: "Quitar paquete" }));

    expect(window.localStorage.getItem(PACKAGE_INTENT_KEY)).toBeNull();
    expect(readPackageIntent("")).toBeNull();
    expect(where()).toBe("/solicitudes?otro=1");
    expect(screen.queryByText("Paquete seleccionado")).toBeNull();
    // Formulario normal, ya abierto.
    expect(screen.getByText("Tipo de servicio")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("sin otros parámetros la URL queda en /solicitudes", async () => {
    renderPage("/solicitudes?paquete=estandar");
    await screen.findByRole("region", { name: "Paquete seleccionado" });

    fireEvent.click(screen.getByRole("button", { name: "Quitar paquete" }));

    expect(where()).toBe("/solicitudes");
    expect(tickets.createSolicitud).not.toHaveBeenCalled();
  });
});

describe("MisSolicitudes · tras enviar", () => {
  it("si se crea: borra la intención, quita ?paquete, avisa «Solicitud enviada» y recarga la lista", async () => {
    rememberPackageIntent("combo-emprendedor");
    renderPage("/solicitudes?paquete=combo-emprendedor");
    await screen.findByRole("region", { name: "Paquete seleccionado" });
    await waitFor(() => expect(tickets.getSolicitudesByEmail).toHaveBeenCalledTimes(1));

    fireEvent.click(consent());
    fireEvent.click(submit());

    await waitFor(() => expect(tickets.getSolicitudesByEmail).toHaveBeenCalledTimes(2));
    expect(window.localStorage.getItem(PACKAGE_INTENT_KEY)).toBeNull();
    expect(where()).toBe("/solicitudes");
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: "Solicitud enviada" }));
    expect(screen.queryByText("Paquete seleccionado")).toBeNull();
    expect(screen.queryByRole("button", { name: "[ ENVIAR SOLICITUD ]" })).toBeNull();
  });

  it("si falla: conserva la intención, la URL y el formulario, y no muestra el error crudo", async () => {
    tickets.createSolicitud.mockRejectedValueOnce(new Error('new row violates row-level security policy for table "tickets"'));
    rememberPackageIntent("combo-emprendedor");
    renderPage("/solicitudes?paquete=combo-emprendedor");
    await screen.findByRole("region", { name: "Paquete seleccionado" });
    fireEvent.change(screen.getByLabelText(/^Nombre de tu negocio/), { target: { value: "Luna" } });

    fireEvent.click(consent());
    fireEvent.click(submit());

    await waitFor(() => expect(toastSpy).toHaveBeenCalled());
    expect(readPackageIntent()).toBe("combo-emprendedor");
    expect(where()).toBe("/solicitudes?paquete=combo-emprendedor");
    expect(screen.getByRole("region", { name: "Paquete seleccionado" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nombre de tu negocio/)).toHaveValue("Luna");
    const toast = toastSpy.mock.calls[0][0] as { title: string; description: string; variant: string };
    expect(toast.variant).toBe("destructive");
    expect(`${toast.title} ${toast.description}`).not.toMatch(/row-level|policy|tickets/i);
    expect(tickets.getSolicitudesByEmail).toHaveBeenCalledTimes(1); // no recargó

    // Se puede reintentar: el botón vuelve a estar disponible.
    await waitFor(() => expect(submit()).toBeEnabled());
    fireEvent.click(submit());
    await waitFor(() => expect(tickets.createSolicitud).toHaveBeenCalledTimes(2));
  });
});

describe("MisSolicitudes · accesibilidad del formulario de paquete", () => {
  it("el «>» decorativo del título está oculto a los lectores y el formulario se llama «Solicitud de paquete»", async () => {
    renderPage("/solicitudes?paquete=estandar");
    await screen.findByRole("region", { name: "Paquete seleccionado" });

    const form = screen.getByRole("form", { name: "Solicitud de paquete" });
    const title = form.querySelector("p")!;
    expect(title.querySelector("[aria-hidden='true']")?.textContent).toBe("> ");
    expect(title).toHaveTextContent("> Solicitud de paquete");
    expect(form).toHaveAccessibleName("Solicitud de paquete");
  });

  it("la ayuda de la casilla está enlazada con aria-describedby mientras existe", async () => {
    renderPage("/solicitudes?paquete=combo-emprendedor");
    await screen.findByRole("region", { name: "Paquete seleccionado" });

    const helpId = consent().getAttribute("aria-describedby")!;
    expect(document.getElementById(helpId)).toHaveTextContent("Marca la casilla para poder enviar tu solicitud.");
  });

  it("el texto secundario usa el token de cuerpo y no muted-foreground, y el título y el enlace no usan text-primary", async () => {
    renderPage("/solicitudes?paquete=combo-emprendedor");
    await screen.findByRole("region", { name: "Paquete seleccionado" });

    const form = screen.getByRole("form", { name: "Solicitud de paquete" });
    const classes = Array.from(form.querySelectorAll("[class]")).map((el) => el.getAttribute("class") ?? "");
    // 1.4.3: ni muted-foreground (2,65:1 en claro) ni text-primary a 12 px (3,86:1) en ningún texto del formulario.
    expect(classes.filter((c) => /(^|\s)text-muted-foreground/.test(c))).toEqual([]);
    expect(classes.filter((c) => /(^|\s)text-primary(\s|$)/.test(c))).toEqual([]);
    expect(screen.getByText("Paquete seleccionado")).toHaveClass("text-[hsl(var(--body-foreground))]");
    expect(screen.getByText("Marca la casilla para poder enviar tu solicitud.")).toHaveClass("text-[hsl(var(--body-foreground))]");
    expect(screen.getByRole("link", { name: /política de privacidad/ })).toHaveClass("text-foreground", "underline");
  });

  it("mientras envía, el botón no usa disabled (conserva el foco) sino aria-disabled, y un segundo envío no hace nada", async () => {
    let finish!: () => void;
    tickets.createSolicitud.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));
    renderPage("/solicitudes?paquete=combo-emprendedor");
    await screen.findByRole("region", { name: "Paquete seleccionado" });
    fireEvent.click(consent());
    submit().focus();

    fireEvent.click(submit());

    const sending = await screen.findByRole("button", { name: "[ ENVIANDO... ]" });
    expect(sending).toHaveAttribute("aria-disabled", "true");
    expect(sending).not.toHaveAttribute("disabled");
    expect(document.activeElement).toBe(sending);
    fireEvent.click(sending);
    fireEvent.submit(sending.closest("form")!);
    expect(tickets.createSolicitud).toHaveBeenCalledTimes(1);

    finish();
    await waitFor(() => expect(screen.queryByText("Paquete seleccionado")).toBeNull());
  });

  it("tras el éxito el foco pasa al encabezado «MIS SOLICITUDES», no se pierde en <body>", async () => {
    renderPage("/solicitudes?paquete=estandar");
    await screen.findByRole("region", { name: "Paquete seleccionado" });
    submit().focus();

    fireEvent.click(submit());

    await waitFor(() => expect(screen.queryByText("Paquete seleccionado")).toBeNull());
    const heading = screen.getByRole("heading", { level: 1, name: "MIS SOLICITUDES" });
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).toBe(heading);
  });

  it("tras el fallo el foco se queda en el botón de enviar", async () => {
    tickets.createSolicitud.mockRejectedValueOnce(new Error("fallo"));
    renderPage("/solicitudes?paquete=estandar");
    await screen.findByRole("region", { name: "Paquete seleccionado" });
    submit().focus();

    fireEvent.click(submit());

    await waitFor(() => expect(toastSpy).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: "[ ENVIAR SOLICITUD ]" })).toBeInTheDocument());
    expect(document.activeElement).toBe(submit());
  });

  it("«Quitar paquete» también deja el foco en el encabezado", async () => {
    renderPage("/solicitudes?paquete=estandar");
    await screen.findByRole("region", { name: "Paquete seleccionado" });
    screen.getByRole("button", { name: "Quitar paquete" }).focus();

    fireEvent.click(screen.getByRole("button", { name: "Quitar paquete" }));

    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "MIS SOLICITUDES" }));
  });
});

describe("MisSolicitudes · enlace a la política de privacidad (Combo)", () => {
  const privacyLink = () => screen.getByRole("link", { name: "Lee la política de privacidad (se abre en una pestaña nueva)" });

  it("junto a la casilla hay un enlace a /politica-de-privacidad en pestaña nueva, con noopener noreferrer", async () => {
    renderPage("/solicitudes?paquete=combo-emprendedor");
    await screen.findByRole("region", { name: "Paquete seleccionado" });

    const link = privacyLink();
    expect(link).toHaveAttribute("href", "/politica-de-privacidad");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")?.split(/\s+/).sort()).toEqual(["noopener", "noreferrer"]);
    // El texto visible es el de la petición y el nombre accesible empieza con él (WCAG 2.5.3) y avisa de la pestaña.
    expect(link.textContent).toBe("Lee la política de privacidad");
    expect(link.getAttribute("aria-label")?.startsWith("Lee la política de privacidad")).toBe(true);
    expect(link).toHaveClass("min-h-6"); // 24 px
  });

  it("no va dentro del <label>: pulsarlo no marca ni desmarca la casilla", async () => {
    renderPage("/solicitudes?paquete=combo-emprendedor");
    await screen.findByRole("region", { name: "Paquete seleccionado" });

    const link = privacyLink();
    expect(link.closest("label")).toBeNull();
    // Comparte contenedor con la casilla y su etiqueta, tras ellas.
    expect(link.parentElement).toContainElement(consent());
    expect(consent().compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(link);
    expect(consent()).not.toBeChecked();
    expect(submit()).toBeDisabled();
    expect(tickets.createSolicitud).not.toHaveBeenCalled();
  });

  it("sigue visible con la casilla marcada y el nombre de la etiqueta no incluye el enlace", async () => {
    renderPage("/solicitudes?paquete=combo-emprendedor");
    await screen.findByRole("region", { name: "Paquete seleccionado" });

    fireEvent.click(consent());

    expect(privacyLink()).toBeInTheDocument();
    expect(consent()).toHaveAccessibleName(CONSENT_LABEL);
  });

  it("el Estándar no tiene consentimiento y tampoco ese enlace", async () => {
    renderPage("/solicitudes?paquete=estandar");
    await screen.findByRole("region", { name: "Paquete seleccionado" });

    expect(screen.queryByRole("link", { name: /política de privacidad/i })).toBeNull();
  });
});
