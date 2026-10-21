/**
 * Shared by the console sidebar and the server layout that renders it. Kept out
 * of the client sidebar module so the layout imports real values rather than
 * client references.
 */

/** Remembers whether the sidebar is collapsed on wide screens. */
export const CONSOLE_NAV_COOKIE = "console-nav";

/**
 * Text that fades with the sidebar. It fades out before the sidebar narrows and
 * back in only once it has finished widening, so it is never visible while the
 * edge is cutting across it.
 */
export const SIDEBAR_FADE =
  "shrink-0 whitespace-nowrap transition-opacity duration-100 ease-out nav-collapsed:opacity-0 nav-expanded:delay-200 motion-reduce:transition-none";
