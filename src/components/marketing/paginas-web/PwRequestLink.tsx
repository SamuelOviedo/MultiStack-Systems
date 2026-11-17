import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { rememberPackageIntent, type PackageIntentId } from "@/lib/packageIntent";

interface PwRequestLinkProps {
  /** Paquete que se pide: se guarda como intención antes de navegar. */
  packageId: PackageIntentId;
  /** Destino del flujo de solicitudes: `/solicitudes?paquete=<id>`. */
  to: string;
  className: string;
  children: ReactNode;
}

/**
 * CTA «Solicitar …» de un paquete. Es un enlace normal (<a href>) de la SPA: con clic navega sin recargar y con
 * clic medio (auxclick, botón 1) abre otra pestaña; en los dos casos guarda antes la intención de paquete. El
 * destino lleva `?paquete=<id>`, pero la URL solo basta si ya hay sesión: sin sesión, ProtectedRoute manda a /login
 * sin ella, y lo que sobrevive al login o al registro es la intención guardada en localStorage. Si el almacenamiento
 * falla, solo queda la URL. «Abrir en pestaña nueva» desde el menú contextual no dispara ningún evento de clic: ahí
 * el paquete viaja solo en la URL.
 */
const PwRequestLink = ({ packageId, to, className, children }: PwRequestLinkProps) => (
  <Link
    to={to}
    className={className}
    onClick={() => rememberPackageIntent(packageId)}
    onAuxClick={(e) => {
      if (e.button === 1) rememberPackageIntent(packageId);
    }}
  >
    {children}
  </Link>
);

export default PwRequestLink;
