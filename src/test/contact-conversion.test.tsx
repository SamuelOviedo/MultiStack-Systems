import type { ReactElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ContactForm y lib/analytics reales; solo se simula la red (sendContactMessage, como en contact.test.tsx). Los mismos
// casos se prueban en ContactSplit (home) y PwContact (/paginas-web), los dos contenedores del formulario.

const send = vi.hoisted(() => vi.fn());
vi.mock("@/lib/contact", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/contact")>();
  return { ...actual, sendContactMessage: send };
});

type Analytics = typeof import("@/lib/analytics");

// Identificadores de PRUEBA: nunca los reales de la cuenta de Google Ads.
const TAG_ID = "AW-1000000000";
const SEND_TO = "AW-1000000000/PRUEBA";
const ORIGIN = window.location.origin;
const GOOGLE_REFERRER = "https://www.google.com/search?q=x";
/** Forma típica de un gclid real, con valor de PRUEBA: 90 caracteres con letras, dígitos, guion y guion bajo. */
const TYPICAL_CLICK_ID = "Cj0KCQiA0eO8BhDfARIsAL6xmuSDEEZqY_tF6nLDmTK-J4hm2Nq7rP1sUvWxYzaB3_-xY9_Qw-ErTy_UiOp-AsDfGh";

/** Datos del visitante, todos marcados PRUEBA: ninguno debe llegar al dataLayer. */
const VISITOR = {
  name: "Visitante PRUEBA",
  phone: "+504 0000-0001",
  email: "visitante.prueba@example.test",
  message: "Mensaje de PRUEBA: quiero cotizar una pagina",
};

interface Container {
  label: string;
  path: string;
  element: () => Promise<ReactElement>;
}

const CONTAINERS: Container[] = [
  {
    label: "ContactSplit (home)",
    path: "/",
    element: async () => {
      const { default: ContactSplit } = await import("@/components/marketing/ContactSplit");
      return <ContactSplit />;
    },
  },
  {
    label: "PwContact (/paginas-web)",
    path: "/paginas-web",
    element: async () => {
      const { default: PwContact } = await import("@/components/marketing/paginas-web/PwContact");
      const { PAGINAS_WEB_CONTENT } = await import("@/pages/marketing/paginasWebContent");
      return <PwContact contact={PAGINAS_WEB_CONTENT.contact} />;
    },
  },
];

const setUrl = (url: string): void => window.history.pushState({}, "", url);

function setReferrer(value: string): void {
  Object.defineProperty(document, "referrer", { configurable: true, get: () => value });
}

const scriptTags = (): HTMLScriptElement[] => Array.from(document.querySelectorAll("script"));

/** Entradas del dataLayer como arreglos: gtag las empuja como objetos Arguments. */
const layerEntries = (): unknown[][] => (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>));

const eventsOf = (name: string): unknown[][] => layerEntries().filter((entry) => entry[0] === "event" && entry[1] === name);

const conversions = (): unknown[][] => eventsOf("conversion");

function resetPage(): void {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  localStorage.clear();
  scriptTags().forEach((script) => script.remove());
  Reflect.deleteProperty(window, "gtag");
  Reflect.deleteProperty(window, "dataLayer");
  Reflect.deleteProperty(document, "referrer");
  setUrl("/");
}

beforeEach(() => {
  resetPage();
  send.mockReset();
});
afterEach(resetPage);

interface AdsEnv {
  id: string | undefined;
  label: string | undefined;
}

const TEST_ENV: AdsEnv = { id: TAG_ID, label: SEND_TO };

/**
 * Módulo nuevo (estado en cero), variables de prueba fijadas (Vitest carga el .env del desarrollador) y la
 * etiqueta inicializada con syncAdsTag, como haría AdsTagRouteSync al montar la ruta.
 */
async function mount(container: Container, env: AdsEnv = TEST_ENV, url: string = container.path): Promise<Analytics> {
  vi.stubEnv("VITE_GADS_ID", env.id);
  vi.stubEnv("VITE_GADS_CONTACT_LABEL", env.label);
  vi.resetModules();
  setUrl(url);
  const analytics = await import("@/lib/analytics");
  analytics.syncAdsTag(container.path);
  render(await container.element());
  return analytics;
}

function fillForm(): void {
  fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: VISITOR.name } });
  fireEvent.change(screen.getByLabelText("Número de teléfono (opcional)"), { target: { value: VISITOR.phone } });
  fireEvent.change(screen.getByLabelText("Correo electrónico (opcional)"), { target: { value: VISITOR.email } });
  fireEvent.change(screen.getByLabelText("Mensaje"), { target: { value: VISITOR.message } });
}

const submitButton = (): HTMLElement => screen.getByRole("button", { name: /Enviar mensaje|Enviando/ });

const findSuccess = (): Promise<HTMLElement> => screen.findByText(/¡Mensaje enviado!/);

const SEND_ERROR = "No se pudo enviar. Intenta de nuevo.";

describe.each(CONTAINERS)("conversión «Contacto enviado» en $label", (container) => {
  const PAGE_LOCATION = `${ORIGIN}${container.path}`;

  it("éxito: una conversión con send_to, page_location y page_referrer, y solo después de que el envío resolvió", async () => {
    await mount(container);
    const order: string[] = [];
    const realGtag = window.gtag as (...args: unknown[]) => void;
    window.gtag = (...args: unknown[]) => {
      if (args[0] === "event" && args[1] === "conversion") order.push("conversión");
      realGtag(...args);
    };
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    send.mockImplementation(async () => {
      order.push("envío iniciado");
      await gate;
      order.push("envío resuelto");
    });

    fillForm();
    fireEvent.click(submitButton());
    await waitFor(() => expect(order).toEqual(["envío iniciado"]));
    expect(conversions()).toHaveLength(0);
    expect(screen.queryByText(/¡Mensaje enviado!/)).toBeNull();

    await act(async () => {
      release();
    });
    expect(await findSuccess()).toBeInTheDocument();

    expect(order).toEqual(["envío iniciado", "envío resuelto", "conversión"]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(VISITOR);
    expect(conversions()).toHaveLength(1);
    const params = conversions()[0][2] as Record<string, unknown>;
    expect(Object.keys(params).sort()).toEqual(["page_location", "page_referrer", "send_to"]);
    expect(params).toEqual({ send_to: SEND_TO, page_location: PAGE_LOCATION, page_referrer: "" });
  });

  it("con un gclid válido típico (90 caracteres) en la URL la conversión dispara y conserva el click-id", async () => {
    await mount(container, TEST_ENV, `${container.path}?gclid=${TYPICAL_CLICK_ID}`);
    send.mockResolvedValue(undefined);
    fillForm();
    fireEvent.click(submitButton());
    await findSuccess();
    expect(conversions()).toHaveLength(1);
    expect(conversions()[0][2]).toEqual({
      send_to: SEND_TO,
      page_location: `${PAGE_LOCATION}?gclid=${TYPICAL_CLICK_ID}`,
      page_referrer: "",
    });
  });

  it("la conversión lleva la page_location saneada: solo el gclid, sin utm, token ni ancla", async () => {
    await mount(container, TEST_ENV, `${container.path}?gclid=PRUEBA&utm_source=x&token=SECRET#contacto`);
    send.mockResolvedValue(undefined);
    fillForm();
    fireEvent.click(submitButton());
    await findSuccess();
    expect(conversions()).toHaveLength(1);
    expect(conversions()[0][2]).toEqual({ send_to: SEND_TO, page_location: `${PAGE_LOCATION}?gclid=PRUEBA`, page_referrer: "" });
    expect(JSON.stringify(layerEntries())).not.toMatch(/SECRET|utm_source|contacto/);
  });

  it("la conversión lleva el page_referrer saneado del page_view de la visita", async () => {
    setReferrer(GOOGLE_REFERRER);
    await mount(container);
    send.mockResolvedValue(undefined);
    fillForm();
    fireEvent.click(submitButton());
    await findSuccess();
    const pageView = eventsOf("page_view")[0][2] as { page_referrer: string };
    expect(pageView.page_referrer).toBe("https://www.google.com/");
    expect(conversions()).toHaveLength(1);
    expect((conversions()[0][2] as { page_referrer: string }).page_referrer).toBe("https://www.google.com/");
  });

  it("rechazo del envío: muestra el error y no hay conversión; el reintento exitoso suma una", async () => {
    await mount(container);
    send.mockRejectedValueOnce(new Error("fallo simulado de red"));
    fillForm();
    fireEvent.click(submitButton());

    expect(await screen.findByText(SEND_ERROR)).toBeInTheDocument();
    expect(screen.queryByText(/¡Mensaje enviado!/)).toBeNull();
    expect(conversions()).toHaveLength(0);

    send.mockResolvedValueOnce(undefined);
    fireEvent.click(submitButton());
    expect(await findSuccess()).toBeInTheDocument();
    expect(screen.queryByText(SEND_ERROR)).toBeNull();
    expect(send).toHaveBeenCalledTimes(2);
    expect(conversions()).toHaveLength(1);
  });

  it.each([
    ["formulario vacío", () => undefined, "Escribe tu nombre completo."],
    [
      "sin teléfono ni correo",
      () => {
        fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: VISITOR.name } });
        fireEvent.change(screen.getByLabelText("Mensaje"), { target: { value: VISITOR.message } });
      },
      "Déjanos un teléfono o un correo para responderte.",
    ],
    [
      "correo mal escrito",
      () => {
        fillForm();
        fireEvent.change(screen.getByLabelText("Correo electrónico (opcional)"), { target: { value: "visitante.prueba@" } });
      },
      "Revisa el correo electrónico.",
    ],
    [
      "mensaje demasiado corto",
      () => {
        fillForm();
        fireEvent.change(screen.getByLabelText("Mensaje"), { target: { value: "hey" } });
      },
      "Cuéntanos un poco más.",
    ],
  ])("errores de validación (%s): sin envío y sin conversión", async (_case, prepare, expectedError) => {
    await mount(container);
    prepare();
    fireEvent.click(submitButton());
    expect(await screen.findByText(expectedError)).toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
    expect(conversions()).toHaveLength(0);
    expect(screen.queryByText(/¡Mensaje enviado!/)).toBeNull();
  });

  it("doble clic y doble submit mientras envía: un envío y una conversión", async () => {
    await mount(container);
    let release!: () => void;
    send.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    fillForm();
    const button = submitButton();
    const form = button.closest("form") as HTMLFormElement;
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(send).toHaveBeenCalledTimes(1);

    await act(async () => {
      release();
    });
    expect(await findSuccess()).toBeInTheDocument();
    expect(send).toHaveBeenCalledTimes(1);
    expect(conversions()).toHaveLength(1);
  });

  it("un submit extra después del éxito no envía ni mide otra vez", async () => {
    await mount(container);
    send.mockResolvedValue(undefined);
    fillForm();
    fireEvent.click(submitButton());
    await findSuccess();
    const form = screen.getByLabelText("Nombre completo").closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(send).toHaveBeenCalledTimes(1);
    expect(conversions()).toHaveLength(1);
  });

  it("si gtag lanza al medir, el formulario sigue mostrando éxito y no el error", async () => {
    await mount(container);
    window.gtag = () => {
      throw new Error("gtag roto");
    };
    send.mockResolvedValue(undefined);
    fillForm();
    fireEvent.click(submitButton());
    expect(await findSuccess()).toBeInTheDocument();
    expect(screen.queryByText(SEND_ERROR)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("si el dataLayer fue reemplazado por un objeto sin push, el envío igual se muestra como exitoso", async () => {
    await mount(container);
    window.dataLayer = {} as unknown as unknown[];
    send.mockResolvedValue(undefined);
    fillForm();
    fireEvent.click(submitButton());
    expect(await findSuccess()).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("en una ruta no permitida (pushState a /login) el envío funciona y no hay conversión", async () => {
    await mount(container);
    const entriesBefore = layerEntries().length;
    setUrl("/login");
    send.mockResolvedValue(undefined);
    fillForm();
    fireEvent.click(submitButton());
    expect(await findSuccess()).toBeInTheDocument();
    expect(send).toHaveBeenCalledTimes(1);
    expect(conversions()).toHaveLength(0);
    expect(layerEntries()).toHaveLength(entriesBefore);
  });

  it.each([
    ["una sesión de Supabase guardada", () => localStorage.setItem("sb-abc-auth-token", "PRUEBA")],
    ["credenciales de auth en el hash de la URL", () => setUrl(`${container.path}#access_token=PRUEBA&type=recovery`)],
    ["un código de auth en la query de la URL", () => setUrl(`${container.path}?code=PRUEBA`)],
    ["un click-id inválido (gclid con @ y espacio) en la query de la URL", () => setUrl(`${container.path}?gclid=PRUEBA%40example.com%20SUCIO`)],
    ["un click-id inválido de 600 caracteres en la query de la URL", () => setUrl(`${container.path}?gclid=${"G".repeat(600)}`)],
    ["un click-id inválido en el hash de la URL", () => setUrl(`${container.path}#gclid=PRUEBA%40example.com%20SUCIO`)],
  ])("con %s el envío funciona y no hay conversión", async (_case, arrange) => {
    await mount(container);
    const entriesBefore = layerEntries().length;
    arrange();
    send.mockResolvedValue(undefined);
    fillForm();
    fireEvent.click(submitButton());
    expect(await findSuccess()).toBeInTheDocument();
    expect(send).toHaveBeenCalledTimes(1);
    expect(conversions()).toHaveLength(0);
    expect(layerEntries()).toHaveLength(entriesBefore);
  });

  it("ningún valor del dataLayer contiene el nombre, correo, teléfono ni mensaje tecleados", async () => {
    setReferrer(GOOGLE_REFERRER);
    await mount(container);
    send.mockResolvedValue(undefined);
    fillForm();
    fireEvent.click(submitButton());
    await findSuccess();
    expect(conversions()).toHaveLength(1);
    const dump = JSON.stringify(layerEntries());
    for (const value of Object.values(VISITOR)) expect(dump).not.toContain(value);
    expect(dump).not.toMatch(/visitante|example\.test|0000-0001/i);
  });

  it.each([
    ["sin etiqueta de conversión", { id: TAG_ID, label: "" }],
    ["con la etiqueta de conversión de otra cuenta", { id: TAG_ID, label: "AW-2000000000/PRUEBA" }],
    ["con la etiqueta de conversión mal formada", { id: TAG_ID, label: "AW-1000000000/ab" }],
  ])("%s: el envío funciona y no hay conversión", async (_case, env) => {
    await mount(container, env);
    send.mockResolvedValue(undefined);
    fillForm();
    fireEvent.click(submitButton());
    expect(await findSuccess()).toBeInTheDocument();
    expect(conversions()).toHaveLength(0);
    expect(eventsOf("page_view")).toHaveLength(1);
  });

  it("sin ID de etiqueta no existe gtag ni dataLayer y el envío funciona", async () => {
    await mount(container, { id: "", label: SEND_TO });
    expect(window.gtag).toBeUndefined();
    send.mockResolvedValue(undefined);
    fillForm();
    fireEvent.click(submitButton());
    expect(await findSuccess()).toBeInTheDocument();
    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
    expect(scriptTags()).toHaveLength(0);
  });
});
