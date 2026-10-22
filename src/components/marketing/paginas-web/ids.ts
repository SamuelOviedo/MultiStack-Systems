/** id del encabezado de una sección: compartirlo evita que su aria-labelledby y el id del título se separen. */
export const titleId = (sectionId: string): string => `${sectionId}-titulo`;

/** Prefijo de ids del ContactForm de esta página (su prop idPrefix): PwContact lo pasa y PaginasWeb lo lee. */
export const CONTACT_ID_PREFIX = "ms-contact-pw";

/** id del textarea «Mensaje»: ContactForm arma cada id como `${idPrefix}-<campo>`. */
export const CONTACT_MESSAGE_ID = `${CONTACT_ID_PREFIX}-message`;
