/**
 * Renders a 24×24 stroke icon from a raw SVG-path string, matching the
 * Claude Design `icon()` helper exactly (fill:none, currentColor stroke,
 * width 2, round caps/joins). Color is inherited from the parent.
 */
const MsIcon = ({ path, size = 22 }: { path: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    dangerouslySetInnerHTML={{ __html: path }}
  />
);

export default MsIcon;
