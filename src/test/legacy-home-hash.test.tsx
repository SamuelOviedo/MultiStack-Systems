import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LegacyHomeGate from "@/components/common/LegacyHomeGate";
import {
  LEGACY_HOME_PATHS,
  LEGACY_HOME_SCROLL_ANCHORS,
  legacyHomeDestination,
  legacyHomeScrollId,
} from "@/lib/legacyHomeHash";
import { SITE_PATHS } from "@/pages/marketing/siteContent";

const at = (pathname: string, search = "", hash = "") => ({ pathname, search, hash });

function Where() {
  const { pathname, search, hash } = useLocation();
  return <output data-testid="where">{`${pathname}${search}${hash}`}</output>;
}

/** La ruta `/` con su puerta, y una vista que solo muestra dónde está. */
function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/"
          element={
            <LegacyHomeGate>
              <p>HOME</p>
            </LegacyHomeGate>
          }
        />
        <Route path="*" element={<p>VISTA</p>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

describe("legacyHomeDestination", () => {
  it.each([
    ["#planes", "/planes"],
    ["#combo-emprendedor", "/planes"],
    ["#contacto", "/contacto"],
    ["#servicios", "/servicios"],
  ])("%s lleva a %s", (hash, destination) => {
    expect(legacyHomeDestination(at("/", "", hash))).toBe(destination);
  });

  it("conserva los parámetros de campaña y descarta el hash", () => {
    expect(legacyHomeDestination(at("/", "?gclid=PRUEBA&utm_source=x", "#planes"))).toBe(
      "/planes?gclid=PRUEBA&utm_source=x",
    );
  });

  it.each(["redirect=//evil.test", "code=abc", "error=access_denied", "token=x", "access_token=eyJ.x.y", "foo=bar"])(
    "el parámetro funcional %s no pasa a la vista nueva, con o sin parámetros de campaña",
    (pair) => {
      expect(legacyHomeDestination(at("/", `?${pair}`, "#planes"))).toBe("/planes");
      expect(legacyHomeDestination(at("/", `?gclid=PRUEBA&${pair}&utm_source=x`, "#planes"))).toBe(
        "/planes?gclid=PRUEBA&utm_source=x",
      );
    },
  );

  it("el caso de la auditoría: code, redirect y token no sobreviven; los click-ids y utm_* sí, tal cual", () => {
    expect(legacyHomeDestination(at("/", "?code=abc&redirect=//evil.test&token=x", "#planes"))).toBe("/planes");
    expect(
      legacyHomeDestination(at("/", "?code=abc&gclid=AbC_1-2.3~4=&redirect=//evil.test&UTM_Source=x&gbraid=ZZ%2F&token=x", "#contacto")),
    ).toBe("/contacto?gclid=AbC_1-2.3~4=&UTM_Source=x&gbraid=ZZ%2F");
  });

  it.each(["gclid", "gbraid", "wbraid", "dclid", "gclsrc", "gad_source", "gad_campaignid", "utm_campaign"])(
    "%s viaja a la vista nueva",
    (key) => {
      expect(legacyHomeDestination(at("/", `?${key}=v`, "#servicios"))).toBe(`/servicios?${key}=v`);
    },
  );

  it("sin parámetros de campaña el destino queda sin `?`", () => {
    expect(legacyHomeDestination(at("/", "?", "#planes"))).toBe("/planes");
    expect(legacyHomeDestination(at("/", "?&&", "#planes"))).toBe("/planes");
    expect(legacyHomeDestination(at("/", "?code=abc", "#planes"))).toBe("/planes");
  });

  it.each(["#inicio", "#proceso", "#por-que-elegirnos", "#preguntas", "#solicitar", "#faq", "#Planes", "#planes-x", "#", ""])(
    "la ancla %j no redirige: se queda en la home",
    (hash) => {
      expect(legacyHomeDestination(at("/", "?gclid=PRUEBA", hash))).toBeNull();
    },
  );

  it("solo mira la home, y una ancla con % mal formado no rompe", () => {
    expect(legacyHomeDestination(at("/planes", "", "#contacto"))).toBeNull();
    expect(legacyHomeDestination(at("/paginas-web", "", "#planes"))).toBeNull();
    expect(legacyHomeDestination(at("/", "", "#%E0%A4%A"))).toBeNull();
  });

  it.each([
    ["#inicio", "inicio"],
    ["#por-que-elegirnos", "por-que-elegirnos"],
    ["#proceso", "proceso"],
    ["#proces%6F", "proceso"],
  ])("la ancla %s baja hasta el id %s", (hash, id) => {
    expect(legacyHomeScrollId(at("/", "?gclid=PRUEBA", hash))).toBe(id);
  });

  it.each(["#preguntas", "#solicitar", "#planes", "#contacto", "#Inicio", "#proceso-x", "#", "", "#%E0%A4%A"])(
    "la ancla %j no baja a ninguna sección",
    (hash) => {
      expect(legacyHomeScrollId(at("/", "", hash))).toBeNull();
    },
  );

  it("solo baja en la home", () => {
    expect(legacyHomeScrollId(at("/planes", "", "#proceso"))).toBeNull();
    expect(legacyHomeScrollId(at("/paginas-web", "", "#proceso"))).toBeNull();
  });

  it("las rutas son las de SITE_PATHS (el módulo no importa siteContent para no entrar al chunk de entrada)", () => {
    expect(LEGACY_HOME_PATHS).toEqual({
      planes: SITE_PATHS.planes,
      servicios: SITE_PATHS.servicios,
      contacto: SITE_PATHS.contacto,
    });
  });
});

/** La home de la prueba con los tres ids que le pone la home real (Hero y WhyAndProcess), y un id que no es ancla. */
function renderHomeWithSections(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/"
          element={
            <LegacyHomeGate>
              <section id="inicio">inicio</section>
              <section id="por-que-elegirnos">por que</section>
              <ol id="proceso">proceso</ol>
              <section id="preguntas-que-no-es-ancla">otra</section>
            </LegacyHomeGate>
          }
        />
        <Route path="*" element={<p>VISTA</p>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

describe("LegacyHomeGate · baja a las secciones de las anclas que se quedan en la home", () => {
  const scrollIntoView = vi.fn();
  let original: typeof Element.prototype.scrollIntoView | undefined;

  beforeEach(() => {
    original = Element.prototype.scrollIntoView;
    scrollIntoView.mockClear();
    // jsdom no implementa scrollIntoView: se registra sobre qué elemento se llama.
    Element.prototype.scrollIntoView = function (this: Element, arg?: boolean | ScrollIntoViewOptions) {
      scrollIntoView(this.id, arg);
    };
  });

  afterEach(() => {
    if (original) Element.prototype.scrollIntoView = original;
    else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  });

  it.each([
    ["/#inicio", "inicio"],
    ["/#por-que-elegirnos", "por-que-elegirnos"],
    ["/#proceso", "proceso"],
    ["/?gclid=PRUEBA&utm_source=x#proceso", "proceso"],
  ])("%s se queda en la home y baja a #%s, sin animación", (entry, id) => {
    renderHomeWithSections(entry);
    expect(screen.getByText("proceso")).toBeInTheDocument();
    expect(screen.getByTestId("where").textContent).toBe(entry); // ni redirige ni cambia la URL
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith(id, { behavior: "auto", block: "start" });
  });

  it.each(["/", "/?gclid=PRUEBA", "/#preguntas", "/#solicitar", "/?gclid=PRUEBA#solicitar", "/#preguntas-que-no-es-ancla"])(
    "%s se queda arriba: no baja a ninguna sección",
    (entry) => {
      renderHomeWithSections(entry);
      expect(screen.getByText("proceso")).toBeInTheDocument();
      expect(screen.getByTestId("where").textContent).toBe(entry);
      expect(scrollIntoView).not.toHaveBeenCalled();
    },
  );

  it.each(["/#planes", "/#contacto", "/#servicios", "/#combo-emprendedor"])(
    "%s redirige a su vista y no baja a nada",
    (entry) => {
      renderHomeWithSections(entry);
      expect(screen.getByText("VISTA")).toBeInTheDocument();
      expect(scrollIntoView).not.toHaveBeenCalled();
    },
  );
});

describe("LEGACY_HOME_SCROLL_ANCHORS", () => {
  // Los ids reales de la home se comprueban en site-home.test.tsx (renderiza Index).
  it("son exactamente inicio, por-que-elegirnos y proceso", () => {
    expect([...LEGACY_HOME_SCROLL_ANCHORS].sort()).toEqual(["inicio", "por-que-elegirnos", "proceso"]);
  });
});

describe("LegacyHomeGate", () => {
  it.each([
    ["/#planes", "/planes"],
    ["/#combo-emprendedor", "/planes"],
    ["/#contacto", "/contacto"],
    ["/#servicios", "/servicios"],
    ["/?gclid=PRUEBA#planes", "/planes?gclid=PRUEBA"],
    ["/?gclid=PRUEBA&utm_campaign=a#contacto", "/contacto?gclid=PRUEBA&utm_campaign=a"],
    ["/?code=abc&redirect=//evil.test&token=x#planes", "/planes"],
    ["/?code=abc&gclid=PRUEBA&redirect=//evil.test&access_token=x&utm_source=g#planes", "/planes?gclid=PRUEBA&utm_source=g"],
  ])("%s redirige a %s sin montar la home", (entry, destination) => {
    renderAt(entry);
    expect(screen.getByTestId("where").textContent).toBe(destination);
    expect(screen.queryByText("HOME")).toBeNull();
    expect(screen.getByText("VISTA")).toBeInTheDocument();
  });

  it.each(["/", "/?gclid=PRUEBA", "/#proceso", "/#inicio", "/#preguntas", "/?gclid=PRUEBA#solicitar"])(
    "%s se queda en la home",
    (entry) => {
      renderAt(entry);
      expect(screen.getByText("HOME")).toBeInTheDocument();
      expect(screen.getByTestId("where").textContent).toBe(entry);
    },
  );

  it("reemplaza la entrada del historial: atrás no vuelve a la ancla", () => {
    let navigationType = "";
    function Spy() {
      navigationType = useNavigationType();
      return null;
    }
    render(
      <MemoryRouter initialEntries={["/#planes"]}>
        <Routes>
          <Route
            path="/"
            element={
              <LegacyHomeGate>
                <p>HOME</p>
              </LegacyHomeGate>
            }
          />
          <Route path="*" element={<p>VISTA</p>} />
        </Routes>
        <Spy />
      </MemoryRouter>,
    );
    expect(navigationType).toBe("REPLACE");
  });
});
