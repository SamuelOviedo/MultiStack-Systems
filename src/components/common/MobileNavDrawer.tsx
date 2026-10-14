import type { CSSProperties, ReactNode, RefObject } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

interface MobileNavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hamburger button: receives focus back on close (there is no SheetTrigger). */
  returnFocusRef: RefObject<HTMLButtonElement>;
  /** MS token variables of the current theme, applied to the inner panel. */
  vars: CSSProperties;
  children: ReactNode;
}

const MONO = "'JetBrains Mono', monospace";

/**
 * Mobile/tablet navigation drawer (< 1024px), lazy-loaded by Navbar on the
 * first intent over the hamburger: shadcn Sheet brings focus trap, Esc,
 * overlay and scroll lock, but also react-remove-scroll & co., which must not
 * weigh on the entry chunk shared with /dashboard.
 */
const MobileNavDrawer = ({ open, onOpenChange, returnFocusRef, vars, children }: MobileNavDrawerProps) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent
      side="right"
      closeLabel="Cerrar menú"
      overlayClassName="bg-black/50 backdrop-blur-[2px]"
      className="w-[85vw] max-w-[340px] border-l-0 bg-transparent p-0 sm:max-w-[340px]"
      onCloseAutoFocus={(e) => {
        e.preventDefault();
        returnFocusRef.current?.focus({ preventScroll: true });
      }}
    >
      {/* MS tokens on an inner wrapper: on SheetContent they would break
          shadcn's HSL tokens (close button, focus rings). */}
      <div
        id="ms-mobile-nav"
        style={{
          ...vars,
          height: "100%",
          overflowY: "auto",
          background: "var(--bg)",
          color: "var(--text)",
          borderLeft: "1px solid var(--border-soft)",
          padding: "22px 20px 28px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        <SheetTitle
          style={{
            fontFamily: MONO,
            fontSize: "11.5px",
            fontWeight: 500,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--muted)",
            margin: "6px 0 18px",
          }}
        >
          Menú
        </SheetTitle>
        <SheetDescription className="sr-only">Navegación del sitio y acceso a tu cuenta.</SheetDescription>
        {children}
      </div>
    </SheetContent>
  </Sheet>
);

export default MobileNavDrawer;
