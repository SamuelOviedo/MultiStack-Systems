import { STATUS_CONFIG, type Project, type ProjectStatus } from "@/types/projects";

/**
 * Estado a dibujar. Si la base trae un valor que el código no conoce (deriva de esquema), se muestra como
 * «En análisis» —lo que ya hacía la tarjeta— en vez de romper la pantalla.
 */
export function safeProjectStatus(estado: Project["estado"]): ProjectStatus {
  return estado in STATUS_CONFIG ? estado : "en_analisis";
}
