/**
 * Builds a Tailwind font size backed by MCP host type tokens.
 * @param {string} token - MCP token stem, e.g. `text-xs` or `heading-md`
 * @param {string} size - fallback font size (DIAL D18 / ui-kit literal)
 * @param {string} lineHeight - fallback line height
 */
const fontSize = (token, size, lineHeight) => [
  `var(--font-${token}-size, ${size})`,
  { lineHeight: `var(--font-${token}-line-height, ${lineHeight})` },
];

/**
 * Tailwind preset exposing ui-kit 2.0 colour variables and MCP host
 * typography, radius and border-width tokens as utilities, so app markup
 * themes like ui-kit components. Colour fallbacks are the `:root` literals of
 * `styles/host-tokens.css`; typography and radius fallbacks are the D18 /
 * Tailwind literals, so without host tokens nothing changes.
 * @type {import('tailwindcss').Config}
 */
export default {
  content: [],
  theme: {
    extend: {
      backgroundColor: {
        'layer-raised': 'var(--bg-layer-raised, #fcfcfc)',
        'layer-base': 'var(--bg-layer-base, #f5f7fa)',
        'layer-sunken': 'var(--bg-layer-sunken, #eef1f7)',
        info: 'var(--bg-info, #d6e2f9)',
        success: 'var(--bg-success, #d9f0f1)',
        warning: 'var(--bg-warning, #faf0cf)',
        error: 'var(--bg-error, #f3d6d8)',
      },
      textColor: {
        primary: 'var(--text-primary, #161b2d)',
        secondary: 'var(--text-secondary, #57647a)',
        tertiary: 'var(--text-tertiary, #848e9c)',
        info: 'var(--text-info, #1d4ed8)',
        success: 'var(--text-success, #007274)',
        warning: 'var(--text-warning, #7f6300)',
        error: 'var(--text-error, #ae2f2f)',
      },
      borderColor: {
        primary: 'var(--stroke-primary, #57647a)',
        secondary: 'var(--stroke-secondary, #d1dbea)',
        tertiary: 'var(--stroke-tertiary, #e0e6f0)',
      },
      fontFamily: {
        sans: ['var(--theme-font, Inter, system-ui)', 'sans-serif'],
      },
      fontWeight: {
        normal: 'var(--font-weight-normal, 400)',
        medium: 'var(--font-weight-medium, 500)',
        semibold: 'var(--font-weight-semibold, 600)',
        bold: 'var(--font-weight-bold, 700)',
      },
      fontSize: {
        xs: fontSize('text-xs', '12px', '16px'),
        sm: fontSize('text-sm', '14px', '20px'),
        base: fontSize('text-md', '16px', '24px'),
        md: fontSize('text-md', '16px', '24px'),
        lg: fontSize('text-lg', '16px', '26px'),
        'heading-xs': fontSize('heading-xs', '16px', '24px'),
        'heading-sm': fontSize('heading-sm', '18px', '26px'),
        'heading-md': fontSize('heading-md', '20px', '28px'),
        'heading-lg': fontSize('heading-lg', '22px', '32px'),
        'heading-xl': fontSize('heading-xl', '28px', '40px'),
        'heading-2xl': fontSize('heading-2xl', '32px', '48px'),
        'heading-3xl': fontSize('heading-3xl', '32px', '48px'),
      },
      borderRadius: {
        sm: 'var(--border-radius-xs, 0.125rem)',
        DEFAULT: 'var(--border-radius-sm, 0.25rem)',
        md: 'var(--border-radius-md, 0.375rem)',
        lg: 'var(--border-radius-lg, 0.5rem)',
        xl: 'var(--border-radius-xl, 0.75rem)',
        full: 'var(--border-radius-full, 9999px)',
      },
      borderWidth: {
        DEFAULT: 'var(--border-width-regular, 1px)',
      },
    },
  },
};
