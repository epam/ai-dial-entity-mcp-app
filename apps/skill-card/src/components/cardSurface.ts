/** Card corner radius from the host's `--border-radius-xl` (ui-kit's 20px without it). */
export const CARD_RADIUS_CLASS = 'rounded-[var(--mcp-card-radius,20px)]';

/**
 * Turns ui-kit's `CardShell` into a static surface: the card is not
 * clickable, so no hover lift and no shadow. ui-kit merges classes with
 * tailwind-merge, so these replace its built-in ones.
 */
export const STATIC_CARD_CLASS = `${CARD_RADIUS_CLASS} shadow-none transition-none hover:translate-y-0 hover:shadow-none`;
