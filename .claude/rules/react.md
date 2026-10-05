---
paths: ['**/*.tsx']
globs: ['**/*.tsx']
applyTo: '**/*.tsx'
---

# React

- Components: `const Name: FC<NameProps> = (…) => …; export default memo(Name);`
- Handlers named `handleX`; state booleans named `isX` / `hasX`.
- Host state only through kit hooks (`useMcpApp`, `useToolResult`,
  `useHostContext`, `useOpenLink`); never subscribe to `window` messages.
- Accessibility: native interactive elements, `aria-expanded`/`aria-controls`
  on disclosure toggles, decorative icons `aria-hidden="true"` with an
  `sr-only` text alternative when they carry meaning.
- Styling: ui-kit 2.0 components first; Tailwind classes from the kit preset for
  local markup; no inline colour values.
