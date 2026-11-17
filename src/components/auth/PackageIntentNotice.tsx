import { useState } from "react";
import { readPackageIntent } from "@/lib/packageIntent";
import { PACKAGES, lempiras, lempirasSpoken } from "@/lib/webPackages";

interface PackageIntentNoticeProps {
  /** Login: «Inicia sesión para enviar tu solicitud.» Signup: «Crea tu cuenta y confirma tu correo…» */
  variant: "login" | "signup";
}

const CONTINUATION: Record<PackageIntentNoticeProps["variant"], string> = {
  login: "Inicia sesión para enviar tu solicitud.",
  signup: "Crea tu cuenta y confirma tu correo; después podrás enviar tu solicitud.",
};

/**
 * Aviso sobre el formulario de Login y Signup cuando hay un paquete guardado (lo dejó el CTA de /paginas-web).
 * Solo lee la intención: no la borra, porque la usa MisSolicitudes después de iniciar sesión. Sin intención no
 * pinta nada. El monto se ve como «L 3,950» y un lector de pantalla oye «3950 lempiras».
 */
const PackageIntentNotice = ({ variant }: PackageIntentNoticeProps) => {
  const [id] = useState(() => readPackageIntent());
  const pkg = id ? PACKAGES.find((p) => p.id === id) : undefined;
  if (!pkg) return null;

  return (
    <div role="note" className="mb-6 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
      Estás solicitando el {pkg.name} (<span aria-hidden="true">{lempiras(pkg.priceLempiras)}</span>
      <span className="sr-only">{lempirasSpoken(pkg.priceLempiras)}</span>). {CONTINUATION[variant]}
    </div>
  );
};

export default PackageIntentNotice;
