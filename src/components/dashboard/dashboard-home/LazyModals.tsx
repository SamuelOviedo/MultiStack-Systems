import { lazy, Suspense, type ComponentProps } from "react";
import { loadNewProjectModal, loadProjectScopingModal } from "./modalLoaders";

const NewProjectModal = lazy(loadNewProjectModal);
const ProjectScopingModal = lazy(loadProjectScopingModal);

/** Alta de proyecto: no se descarga ni se monta hasta que `armed` (la primera vez que se abre). */
export function LazyNewProjectModal({ armed, ...props }: ComponentProps<typeof NewProjectModal> & { armed: boolean }) {
  if (!armed) return null;
  return (
    <Suspense fallback={null}>
      <NewProjectModal {...props} />
    </Suspense>
  );
}

/** Alcance de una solicitud (convertir en proyecto): igual, bajo demanda. */
export function LazyProjectScopingModal({
  armed,
  ...props
}: ComponentProps<typeof ProjectScopingModal> & { armed: boolean }) {
  if (!armed) return null;
  return (
    <Suspense fallback={null}>
      <ProjectScopingModal {...props} />
    </Suspense>
  );
}
