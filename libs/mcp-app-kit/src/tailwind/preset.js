/**
 * Tailwind preset exposing @epam/ai-dial-ui-kit colour tokens as utilities
 * backed by the ui-kit CSS variables, so app-local markup themes the same way
 * as ui-kit components. Fallbacks are the light defaults matching ui-kit ≥0.15
 * dist and the `:root` block of `styles/host-tokens.css`, which sets every
 * variable below in both themes.
 * @type {import('tailwindcss').Config}
 */
export default {
  content: [],
  theme: {
    extend: {
      backgroundColor: {
        'layer-0': 'var(--bg-layer-0, #ffffff)',
        'layer-1': 'var(--bg-layer-1, #ffffff)',
        'layer-2': 'var(--bg-layer-2, #f3f4f6)',
        'layer-3': 'var(--bg-layer-3, #fcfcfc)',
        'layer-4': 'var(--bg-layer-4, #fcfcfc)',
        'layer-raised': 'var(--bg-layer-raised, #eef1f7)',
        'accent-primary-alpha': 'var(--bg-accent-primary-alpha, #2764d91a)',
        success: 'var(--bg-success, #e5f6f4)',
        warning: 'var(--bg-warning, #fbf6e5)',
        error: 'var(--bg-error, #fbeaec)',
      },
      textColor: {
        primary: 'var(--text-primary, #141a23)',
        secondary: 'var(--text-secondary, #6c7380)',
        'accent-primary': 'var(--text-accent-primary, #2764d9)',
        success: 'var(--text-success, #1a7f5e)',
        warning: 'var(--text-warning, #a15c07)',
        error: 'var(--text-error, #c22d2d)',
      },
      borderColor: {
        primary: 'var(--stroke-primary, #c3c7cf)',
        secondary: 'var(--stroke-secondary, #dde1e6)',
        tertiary: 'var(--stroke-tertiary, #eceef1)',
      },
      fontFamily: {
        sans: ['var(--theme-font, var(--font-inter, system-ui))', 'sans-serif'],
      },
    },
  },
};
