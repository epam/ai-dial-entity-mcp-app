---
paths: ['**/*.ts', '**/*.tsx']
globs: ['**/*.ts', '**/*.tsx']
applyTo: '**/*.ts,**/*.tsx'
---

# TypeScript

- Arrow-function constants only (`const fn = () => …`); no `function` declarations.
- String enums for closed sets (`enum X { A = 'a' }`); no numeric or const enums.
- Never nest ternaries; use early returns, `switch`, or a lookup object.
- `async`/`await` over `.then` chains in app code.
- JSDoc on every exported non-component function and hook: description plus
  `@param` per parameter. React components get JSDoc only when their behaviour
  isn't obvious from the name and props; never restate the code.
  No inline `//` comments unless they record a non-obvious constraint.
- No `any`. Validate unknown input with type guards (see `apps/entity-card/src/contract.ts`).
