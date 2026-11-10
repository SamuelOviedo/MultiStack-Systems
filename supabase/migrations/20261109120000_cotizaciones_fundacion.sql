-- =============================================================================
-- Cotizaciones, fase F1 (fundación): tablas, RLS, privilegios por columna y
-- triggers de la máquina de estados, la inmutabilidad y la auditoría.
--
-- Módulo SOLO del administrador (user_type = 0). Esta migración no crea RPC,
-- ni números de cotización, ni líneas, ni cálculo, ni aceptaciones: eso llega
-- en las fases siguientes, que reemiten las funciones con CREATE OR REPLACE
-- en su propia migración (nunca se edita esta).
--
-- Capas independientes, cada una suficiente por sí sola:
--   1. Privilegios: anon y service_role sin nada; authenticated solo SELECT y,
--      en cotizaciones, INSERT/UPDATE de las cuatro columnas del prospecto. Sin
--      DELETE ni TRUNCATE para nadie de la API. Eventos: solo SELECT.
--   2. RLS: todas las políticas usan get_user_type() = 0 (nunca IN (0,1));
--      un usuario sin perfil (rol NULL) queda fuera.
--   3. Triggers (para cualquier rol que llegue a escribir, también postgres):
--      alta segura, matriz de estados, inmutabilidad por lista blanca que falla
--      cerrado, borrado y TRUNCATE bloqueados, eventos inmutables con esquema
--      estricto y actor igual a la sesión. Un índice único parcial admite un
--      solo evento 'creada' por cotización. Sin variables de sesión, sin
--      exención por rol y sin triggers desactivados; los 8 triggers quedan en
--      ENABLE ALWAYS para que session_replication_role = replica tampoco los
--      salte.
--
-- Errores propios: ERRCODE 'P0001' y MESSAGE = 'COT:<CODIGO>', sin nada más
-- (jamás datos del prospecto). El alta sin sesión de administrador y el evento
-- cuyo actor no es la sesión usan ERRCODE '42501' con 'COT:SIN_PERMISO', para
-- que todo rechazo de un no-administrador sea 42501 sea cual sea la capa que
-- lo detecte.
--
-- DECISIÓN DE security (desviación respecto al texto de la tarea T003):
-- service_role SIN PRIVILEGIOS
-- ----------------------------------------------------------------------
-- T003 solo revocaba a PUBLIC, anon y authenticated. Pero Supabase concede por
-- defecto ALL a service_role sobre los objetos nuevos de public, y service_role
-- salta RLS: con una clave de servicio filtrada se podrían falsificar eventos
-- (actor, ocurrido_at, duplicados) y llamar a setval en las secuencias. Por eso
-- se le retira todo sobre las dos tablas, las dos secuencias y las seis
-- funciones. Las RPC de las fases siguientes (F3 a F5a) serán SECURITY DEFINER
-- propiedad de postgres y no se ven afectadas; el módulo no usa Edge Functions.
-- Todo objeto nuevo del módulo (tabla, secuencia, función) debe retirarle
-- también service_role.
--
-- OPERACIÓN: léelo antes de restaurar, migrar o reactivar triggers
-- ----------------------------------------------------------------------
-- * Los 8 triggers (también los de DELETE y TRUNCATE de cotizaciones y los de
--   eventos) son inmunes a session_replication_role = replica.
-- * ALTER TABLE ... ENABLE TRIGGER (sin ALWAYS) BAJA un trigger de modo A a O
--   (solo origin) en silencio, y entonces replica ya lo salta. Al reactivar,
--   usa siempre ENABLE ALWAYS TRIGGER <nombre>. pg_dump --disable-triggers
--   emite justo DISABLE TRIGGER ALL / ENABLE TRIGGER ALL: tras una carga así,
--   comprueba pg_trigger.tgenabled = 'A' en los 8.
-- * Una restauración lógica de cotizaciones falla cerrado con COT:SIN_PERMISO,
--   porque no hay sesión de administrador. Para restaurar, desactiva SOLO
--   cotizaciones_preparar_alta y cotizaciones_registrar_creada (el resto sigue
--   protegiendo), carga las dos tablas y reactiva con ENABLE ALWAYS TRIGGER.
-- * Un CHECK que falla ejecutado por un rol que salta RLS (postgres) registra
--   la fila completa en el DETAIL del error: el prospecto. No ejecutes DML con
--   datos reales, ni fuera de límite, desde el editor SQL.
--
-- DESVIACIÓN APROBADA DEL TEXTO DE LA TAREA T002 (referencia_interna)
-- ----------------------------------------------------------------------
-- La tarea pedía un DEFAULT 'BOR-' || nextval('public.cotizacion_borrador_seq').
-- Un DEFAULT se evalúa con los privilegios de quien inserta, así que habría
-- obligado a conceder USAGE sobre la secuencia a authenticated. El propietario
-- decidió no conceder ningún privilegio sobre la secuencia a authenticated.
-- Por eso la columna NO tiene DEFAULT: la asigna siempre el trigger BEFORE
-- INSERT cotizacion_preparar_alta (SECURITY DEFINER), que además SOBRESCRIBE
-- cualquier valor recibido. La columna sigue siendo text UNIQUE NOT NULL y el
-- navegador no tiene privilegio de escritura sobre ella.
--
-- Identidad de auditoría (creado_por, actualizado_por, actor): son uuid SIN
-- clave foránea a auth.users, a propósito. Borrar la cuenta de un
-- administrador no debe bloquearse (RESTRICT), ni borrar cotizaciones
-- (CASCADE), ni perder la atribución de la auditoría (SET NULL contradiría
-- actor NOT NULL). El valor sale siempre de auth.uid() dentro de los
-- triggers; el navegador no puede escribirlo.
-- =============================================================================

-- ── 1. Secuencia de la referencia interna ────────────────────────────────────
-- Solo la usa el trigger de alta (SECURITY DEFINER). Sin privilegios para la API
-- ni para service_role.
CREATE SEQUENCE public.cotizacion_borrador_seq AS bigint;
REVOKE ALL ON SEQUENCE public.cotizacion_borrador_seq FROM PUBLIC, anon, authenticated, service_role;

-- ── 2. Tablas ────────────────────────────────────────────────────────────────
CREATE TABLE public.cotizaciones (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'BOR-' + identidad numérica. Sin DEFAULT: la asigna el trigger de alta.
  referencia_interna text NOT NULL,
  estado             text NOT NULL DEFAULT 'borrador',
  prospecto_nombre   text,
  prospecto_contacto text,
  prospecto_email    text,
  prospecto_telefono text,
  creado_por         uuid NOT NULL,
  creado_at          timestamptz NOT NULL DEFAULT now(),
  -- NULL cuando el UPDATE no trae sesión (por ejemplo, mantenimiento como postgres).
  actualizado_por    uuid,
  actualizado_at     timestamptz NOT NULL DEFAULT now(),
  row_version        integer NOT NULL DEFAULT 1,
  CONSTRAINT cotizaciones_referencia_interna_key     UNIQUE (referencia_interna),
  CONSTRAINT cotizaciones_referencia_interna_formato CHECK (referencia_interna ~ '^BOR-[0-9]+$'),
  CONSTRAINT cotizaciones_estado_check
    CHECK (estado IN ('borrador', 'emitida', 'aceptada_firmada', 'rechazada', 'cancelada')),
  CONSTRAINT cotizaciones_prospecto_nombre_len   CHECK (char_length(prospecto_nombre)   <= 200),
  CONSTRAINT cotizaciones_prospecto_contacto_len CHECK (char_length(prospecto_contacto) <= 200),
  CONSTRAINT cotizaciones_prospecto_email_len    CHECK (char_length(prospecto_email)    <= 254),
  CONSTRAINT cotizaciones_prospecto_telefono_len CHECK (char_length(prospecto_telefono) <= 40),
  CONSTRAINT cotizaciones_row_version_check      CHECK (row_version >= 1)
);

ALTER SEQUENCE public.cotizacion_borrador_seq OWNED BY public.cotizaciones.referencia_interna;

CREATE INDEX cotizaciones_estado_creado_idx ON public.cotizaciones (estado, creado_at DESC);

CREATE TABLE public.cotizacion_eventos (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones (id) ON DELETE RESTRICT,
  -- Conjunto cerrado que crece con cada fase (la migración de cada fase amplía el CHECK).
  tipo          text NOT NULL,
  actor         uuid NOT NULL,
  ocurrido_at   timestamptz NOT NULL DEFAULT now(),
  motivo        text,
  detalle       jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT cotizacion_eventos_tipo_check CHECK (tipo IN ('creada')),
  CONSTRAINT cotizacion_eventos_motivo_len CHECK (char_length(motivo) <= 1000),
  -- Red de seguridad declarativa; la validación por tipo la hace el trigger BEFORE INSERT.
  CONSTRAINT cotizacion_eventos_detalle_forma
    CHECK (jsonb_typeof(detalle) = 'object' AND char_length(detalle::text) <= 256)
);

-- Cubre también la clave foránea cotizacion_id.
CREATE INDEX cotizacion_eventos_cotizacion_idx ON public.cotizacion_eventos (cotizacion_id, ocurrido_at);

-- Una sola 'creada' por cotización, de forma estructural (también frente a
-- postgres). Una revisión o un duplicado crean una cotización nueva, con su
-- propio 'creada'; los demás tipos de evento (fases siguientes) no se limitan.
CREATE UNIQUE INDEX cotizacion_eventos_creada_unica
  ON public.cotizacion_eventos (cotizacion_id) WHERE tipo = 'creada';

COMMENT ON TABLE public.cotizaciones IS
  'Cotizaciones (solo administrador). Nace en borrador; el estado y la auditoria los fijan triggers y funciones del modulo.';
COMMENT ON COLUMN public.cotizaciones.referencia_interna IS
  'BOR-n, estable, asignada por el trigger de alta (sin DEFAULT para no exponer la secuencia). No es el numero de cotizacion.';
COMMENT ON TABLE public.cotizacion_eventos IS
  'Auditoria de cotizaciones: solo se anade, nunca se modifica ni se borra. Sin datos personales (detalle con esquema estricto).';

-- ── 3. RLS y privilegios ─────────────────────────────────────────────────────
ALTER TABLE public.cotizaciones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizacion_eventos ENABLE ROW LEVEL SECURITY;

-- Supabase concede por defecto privilegios a anon, authenticated y service_role
-- sobre los objetos nuevos de public: se retiran y se conceden solo los de abajo
-- (a service_role no se le concede nada: ver la decisión de security arriba).
-- (Retirar un privilegio de tabla retira también los de columna.)
REVOKE ALL ON public.cotizaciones       FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.cotizacion_eventos FROM PUBLIC, anon, authenticated, service_role;
-- Secuencia de identidad de eventos: nadie de la API la usa.
REVOKE ALL ON SEQUENCE public.cotizacion_eventos_id_seq FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON public.cotizaciones       TO authenticated;
GRANT SELECT ON public.cotizacion_eventos TO authenticated;

-- INSERT y UPDATE solo por columna: lo demás (id, referencia_interna, estado,
-- creado_*, actualizado_*, row_version) lo fija la base. Sin DELETE.
GRANT INSERT (prospecto_nombre, prospecto_contacto, prospecto_email, prospecto_telefono)
  ON public.cotizaciones TO authenticated;
GRANT UPDATE (prospecto_nombre, prospecto_contacto, prospecto_email, prospecto_telefono)
  ON public.cotizaciones TO authenticated;

-- (SELECT public.get_user_type()) se evalúa una vez por sentencia, no por fila.
CREATE POLICY cotizaciones_admin_select ON public.cotizaciones
  FOR SELECT TO authenticated
  USING ((SELECT public.get_user_type()) = 0);

CREATE POLICY cotizaciones_admin_insert ON public.cotizaciones
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.get_user_type()) = 0 AND estado = 'borrador');

CREATE POLICY cotizaciones_admin_update ON public.cotizaciones
  FOR UPDATE TO authenticated
  USING      ((SELECT public.get_user_type()) = 0 AND estado = 'borrador')
  WITH CHECK ((SELECT public.get_user_type()) = 0 AND estado = 'borrador');

CREATE POLICY cotizacion_eventos_admin_select ON public.cotizacion_eventos
  FOR SELECT TO authenticated
  USING ((SELECT public.get_user_type()) = 0);

-- ── 4. Funciones de trigger ──────────────────────────────────────────────────
-- Todas SECURITY DEFINER con search_path fijo (pg_temp al final), objetos
-- cualificados y sin EXECUTE para anon, authenticated ni service_role (no son
-- RPC). Un trigger se ejecuta con independencia de los privilegios de quien
-- escribe.

-- 4.1 Alta segura (BEFORE INSERT en cotizaciones).
-- Impone referencia, estado, versión y auditoría sin atender al valor recibido.
-- Exige sesión de administrador también a los roles que saltan RLS.
CREATE FUNCTION public.cotizacion_preparar_alta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR public.get_user_type() IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'COT:SIN_PERMISO';
  END IF;

  NEW.referencia_interna := 'BOR-' || nextval('public.cotizacion_borrador_seq')::text;
  NEW.estado             := 'borrador';
  NEW.row_version        := 1;
  NEW.creado_por         := v_uid;
  NEW.creado_at          := now();
  NEW.actualizado_por    := v_uid;
  NEW.actualizado_at     := now();
  RETURN NEW;
END;
$$;

-- 4.2 Control de cambios (BEFORE UPDATE en cotizaciones): matriz de estados,
-- inmutabilidad por lista blanca y versión. DISEÑADA PARA AMPLIARSE POR FASES:
-- cada fase la reemite con CREATE OR REPLACE FUNCTION.
CREATE FUNCTION public.cotizacion_controlar_cambio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- ÚNICO punto donde se declara qué columnas pueden cambiar cuando el estado
  -- anterior no es 'borrador'. Todo lo demás queda congelado, también una
  -- columna que una fase futura añada y nadie clasifique (falla cerrado).
  c_lista_blanca constant text[] :=
    ARRAY['estado', 'row_version', 'actualizado_por', 'actualizado_at'];
BEGIN
  -- Identidad: no cambia en ningún estado.
  IF NEW.id                 IS DISTINCT FROM OLD.id
  OR NEW.referencia_interna IS DISTINCT FROM OLD.referencia_interna
  OR NEW.creado_por         IS DISTINCT FROM OLD.creado_por
  OR NEW.creado_at          IS DISTINCT FROM OLD.creado_at THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'COT:INMUTABLE';
  END IF;

  -- Matriz de transiciones. Rechazada y Cancelada no tienen salida y nunca se
  -- vuelve a Borrador. Una sentencia que no cambia el estado no es transición.
  -- COALESCE: un estado NULL o desconocido también se rechaza aquí (falla cerrado).
  IF NEW.estado IS DISTINCT FROM OLD.estado AND NOT COALESCE((
       (OLD.estado = 'borrador'         AND NEW.estado IN ('emitida', 'cancelada'))
    OR (OLD.estado = 'emitida'          AND NEW.estado IN ('rechazada', 'cancelada', 'aceptada_firmada'))
    OR (OLD.estado = 'aceptada_firmada' AND NEW.estado = 'emitida')
  ), false) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'COT:ESTADO_INVALIDO';
  END IF;

  -- Inmutabilidad: fila completa menos la lista blanca.
  IF OLD.estado <> 'borrador'
     AND (to_jsonb(OLD) - c_lista_blanca) IS DISTINCT FROM (to_jsonb(NEW) - c_lista_blanca) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'COT:INMUTABLE';
  END IF;

  -- Versión y auditoría de la fila (valor propio, sin atender al recibido).
  -- actualizado_por queda NULL si el UPDATE no trae sesión.
  NEW.row_version     := OLD.row_version + 1;
  NEW.actualizado_por := auth.uid();
  NEW.actualizado_at  := now();
  RETURN NEW;
END;
$$;

-- 4.3 Evento 'creada' (AFTER INSERT en cotizaciones). detalle vacío y motivo
-- nulo: el nombre, el correo y el teléfono del prospecto no entran en la
-- auditoría. Sin sesión, actor (NOT NULL) hace fallar el alta.
CREATE FUNCTION public.cotizacion_registrar_creada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor, motivo, detalle)
  VALUES (NEW.id, 'creada', auth.uid(), NULL, '{}'::jsonb);
  RETURN NULL;
END;
$$;

-- 4.4 Autoría y esquema estricto del evento (BEFORE INSERT en cotizacion_eventos).
-- Para cualquier rol. Primero la autoría (permiso), después el esquema. Cada
-- fase que añade tipos de evento amplía el CASE (con las claves de su tipo, en
-- orden de bytes, el mismo COLLATE "C" del array_agg de abajo) y el CHECK de tipo.
CREATE FUNCTION public.cotizacion_evento_validar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_max_detalle constant integer := 256;
  v_claves_tipo text[];
  v_claves      text[];
BEGIN
  -- 0. Con sesión, el actor del evento es la sesión: nadie atribuye un evento a
  -- otra persona (tampoco postgres con una sesión simulada). Sin sesión
  -- (mantenimiento, restauraciones) la regla no se aplica.
  IF auth.uid() IS NOT NULL AND NEW.actor IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'COT:SIN_PERMISO';
  END IF;

  -- 1. detalle es un objeto JSON (ni arreglo, ni escalar, ni null).
  IF NEW.detalle IS NULL OR jsonb_typeof(NEW.detalle) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'COT:DETALLE_INVALIDO';
  END IF;

  -- 4. El texto de detalle no supera 256 caracteres.
  IF char_length(NEW.detalle::text) > c_max_detalle THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'COT:DETALLE_INVALIDO';
  END IF;

  -- 2 y 5. Claves exactas del tipo y motivo nulo donde el tipo no lo lleva.
  CASE NEW.tipo
    WHEN 'creada' THEN
      v_claves_tipo := ARRAY[]::text[];
      IF NEW.motivo IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'COT:DETALLE_INVALIDO';
      END IF;
    ELSE
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'COT:DETALLE_INVALIDO';
  END CASE;

  -- COLLATE "C": el orden de las claves no depende de la configuración regional.
  SELECT COALESCE(array_agg(k ORDER BY k COLLATE "C"), ARRAY[]::text[])
    INTO v_claves
    FROM jsonb_object_keys(NEW.detalle) AS k;

  IF v_claves IS DISTINCT FROM v_claves_tipo THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'COT:DETALLE_INVALIDO';
  END IF;

  RETURN NEW;
END;
$$;

-- 4.5 Eventos inmutables (BEFORE UPDATE OR DELETE en cotizacion_eventos) y
-- cotizaciones sin borrado (BEFORE DELETE en cotizaciones: la clave foránea
-- RESTRICT no basta, porque session_replication_role = replica la salta).
-- Rechaza SIEMPRE, también a postgres. Una fase que la reemita no puede relajarla.
CREATE FUNCTION public.cotizacion_evento_inmutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'COT:INMUTABLE';
END;
$$;

-- 4.6 Sin TRUNCATE (BEFORE TRUNCATE en ambas tablas). TRUNCATE no dispara los
-- triggers por fila, y un TRUNCATE de las dos tablas a la vez esquivaría la
-- clave foránea; este trigger lo cierra para cualquier rol.
CREATE FUNCTION public.cotizacion_bloquear_truncate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'COT:INMUTABLE';
END;
$$;

-- No son RPC: ningún rol de la API las ejecuta (ni siquiera por una concesión
-- por defecto del esquema). Tampoco se concede EXECUTE después.
REVOKE ALL ON FUNCTION public.cotizacion_preparar_alta()       FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.cotizacion_controlar_cambio()    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.cotizacion_registrar_creada()    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.cotizacion_evento_validar()      FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.cotizacion_evento_inmutable()    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.cotizacion_bloquear_truncate()   FROM PUBLIC, anon, authenticated, service_role;

-- ── 5. Triggers ──────────────────────────────────────────────────────────────
CREATE TRIGGER cotizaciones_preparar_alta
  BEFORE INSERT ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.cotizacion_preparar_alta();

CREATE TRIGGER cotizaciones_controlar_cambio
  BEFORE UPDATE ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.cotizacion_controlar_cambio();

CREATE TRIGGER cotizaciones_registrar_creada
  AFTER INSERT ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.cotizacion_registrar_creada();

CREATE TRIGGER cotizaciones_sin_truncate
  BEFORE TRUNCATE ON public.cotizaciones
  FOR EACH STATEMENT EXECUTE FUNCTION public.cotizacion_bloquear_truncate();

CREATE TRIGGER cotizaciones_sin_borrado
  BEFORE DELETE ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.cotizacion_evento_inmutable();

CREATE TRIGGER cotizacion_eventos_validar
  BEFORE INSERT ON public.cotizacion_eventos
  FOR EACH ROW EXECUTE FUNCTION public.cotizacion_evento_validar();

CREATE TRIGGER cotizacion_eventos_inmutable
  BEFORE UPDATE OR DELETE ON public.cotizacion_eventos
  FOR EACH ROW EXECUTE FUNCTION public.cotizacion_evento_inmutable();

CREATE TRIGGER cotizacion_eventos_sin_truncate
  BEFORE TRUNCATE ON public.cotizacion_eventos
  FOR EACH STATEMENT EXECUTE FUNCTION public.cotizacion_bloquear_truncate();

-- ENABLE ALWAYS: se ejecutan también con session_replication_role = replica
-- (replicación lógica, restauraciones que fijan el rol de réplica de la sesión).
ALTER TABLE public.cotizaciones       ENABLE ALWAYS TRIGGER cotizaciones_preparar_alta;
ALTER TABLE public.cotizaciones       ENABLE ALWAYS TRIGGER cotizaciones_controlar_cambio;
ALTER TABLE public.cotizaciones       ENABLE ALWAYS TRIGGER cotizaciones_registrar_creada;
ALTER TABLE public.cotizaciones       ENABLE ALWAYS TRIGGER cotizaciones_sin_truncate;
ALTER TABLE public.cotizaciones       ENABLE ALWAYS TRIGGER cotizaciones_sin_borrado;
ALTER TABLE public.cotizacion_eventos ENABLE ALWAYS TRIGGER cotizacion_eventos_validar;
ALTER TABLE public.cotizacion_eventos ENABLE ALWAYS TRIGGER cotizacion_eventos_inmutable;
ALTER TABLE public.cotizacion_eventos ENABLE ALWAYS TRIGGER cotizacion_eventos_sin_truncate;
