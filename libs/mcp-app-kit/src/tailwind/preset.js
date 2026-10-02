/**
 * Tailwind preset exposing @epam/ai-dial-ui-kit colour tokens (CSS-variable
 * backed, with ui-kit's dark fallbacks) so app-local markup themes the same
 * way as ui-kit components. Fallbacks mirror ui-kit's tailwind.config.js.
 * @type {import('tailwindcss').Config}
 */
export default {
  content: [],
  theme: {
    extend: {
      backgroundColor: {
        'layer-0': 'var(--bg-layer-0, #000000)',
        'layer-1': 'var(--bg-layer-1, #0C101D)',
        'layer-2': 'var(--bg-layer-2, #161B2D)',
        'layer-3': 'var(--bg-layer-3, #1D2439)',
        'layer-4': 'var(--bg-layer-4, #242C42)',
        'accent-primary-alpha': 'var(--bg-accent-primary-alpha, #7DA4FF26)',
        success: 'var(--bg-success, #1D3841)',
        warning: 'var(--bg-warning, #3F3D25)',
        error: 'var(--bg-error, #402027)',
      },
      textColor: {
        primary: 'var(--text-primary, #EEF1F7)',
        secondary: 'var(--text-secondary, #9FA6BD)',
        'accent-primary': 'var(--text-accent-primary, #7DA4FF)',
        success: 'var(--text-success, #37BABC)',
        warning: 'var(--text-warning, #EEC840)',
        error: 'var(--text-error, #F76464)',
      },
      borderColor: {
        primary: 'var(--stroke-primary, #696E7C)',
        secondary: 'var(--stroke-secondary, #242C42)',
        tertiary: 'var(--stroke-tertiary, #0C101D)',
      },
      fontFamily: {
        sans: ['var(--theme-font, var(--font-inter, system-ui))', 'sans-serif'],
      },
    },
  },
};
