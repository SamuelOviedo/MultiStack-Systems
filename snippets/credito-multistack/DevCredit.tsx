// Crédito "Desarrollado por MultiStack Systems". Server Component: sin estado ni efectos, vale para Next (App Router) y Vite.
// Es el port de credito.css: mismo marcado, mismas custom properties --ms-credit-* (esas no se hashean). Ver docs/standards.
import styles from './DevCredit.module.css'

export type DevCreditProps = {
  /** Slug del cliente: va en utm_source del enlace. */
  clientSlug: string
  /** Alineación cuando el crédito ocupa su propia línea. Sin valor queda en línea, donde lo coloque el sitio. */
  align?: 'start' | 'center' | 'end'
  /** auto hereda el color del contenedor; dark = texto claro (pie oscuro); light = texto oscuro (pie claro). */
  tone?: 'auto' | 'light' | 'dark'
  /** Para ubicarlo en el layout del sitio. */
  className?: string
}

// Los ids son fijos porque <use> y el degradado los referencian: un solo crédito por página.
export function DevCredit({ clientSlug, align, tone = 'auto', className }: DevCreditProps) {
  const href = `https://www.multistacksystems.com/?utm_source=${encodeURIComponent(clientSlug)}&utm_medium=referral&utm_campaign=credito-footer`
  return (
    <a
      className={className ? `${styles.credit} ${className}` : styles.credit}
      href={href}
      target="_blank"
      rel="noopener nofollow"
      aria-label="Desarrollado por MultiStack Systems (se abre en una pestaña nueva)"
      data-align={align}
      data-tone={tone === 'auto' ? undefined : tone}
    >
      Desarrollado por
      <svg viewBox="0 0 888.5 703.2" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="ms-credit-g" x2="1" y2="1">
            <stop />
            <stop offset="1" />
          </linearGradient>
          <path id="ms-credit-m" d="m719.3 361.3-200.2-86.9.1-.1L718.5 64.6zM158.7 5.9Q171.6.2 185.1.2c16.4 0 32.6 6.3 44.8 18.2l269.8 263c9 8.8 9.8 23 1.8 32.7l-85.3 103.7c-8.8 10.6-24.6 11.8-34.9 2.6L0 77.5zm523.6-1.5Q688.8 0 695.7 0c11.8 0 22.8 9.3 22.8 22.8v200l-305 205.5c-7.9 5.3-18.4 4.6-25.5-1.7L261 312.2zM0 162.1c0-10 8.2-16.6 16.7-16.6 4 0 8.1 1.4 11.4 4.7l171.2 165.1v387.9L0 509.7v-68.1z" />
        </defs>
        <use href="#ms-credit-m" />
        <use href="#ms-credit-m" fill="url(#ms-credit-g)" />
        <path d="M719.3 497.1v46L550.7 608v-45.6L666 520.3l-115.3-42.5v-45.9z" />
        <path className={styles.cursor} d="M888.5 625.6H723.2v-38.3h165.3z" />
      </svg>
      <b>MultiStack Systems</b>
      <svg viewBox="0 0 8 8" aria-hidden="true" focusable="false">
        <path d="M1 7 7 1M2.5 1H7v4.5" />
      </svg>
    </a>
  )
}

export default DevCredit
