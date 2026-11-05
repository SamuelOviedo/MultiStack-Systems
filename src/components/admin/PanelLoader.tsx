/**
 * Indicador de carga de las pantallas del panel que usan `AdminShell` (Resumen y lista de proyectos) mientras llegan
 * su armazón y su página. Es texto y vive en el chunk de entrada: se pinta en cuanto React monta, sin esperar a que
 * lleguen los logotipos del indicador general (116 kB) ni los chunks del panel.
 */
export default function PanelLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p role="status" className="text-sm text-muted-foreground">
        Cargando el panel…
      </p>
    </div>
  );
}
