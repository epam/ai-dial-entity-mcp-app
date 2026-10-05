import kitPreset from '@epam/ai-dial-mcp-app-kit/tailwind';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [kitPreset],
  content: {
    relative: true,
    files: ['./index.html', './src/**/*.{ts,tsx}'],
  },
  corePlugins: { preflight: false },
};
