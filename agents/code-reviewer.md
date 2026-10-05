# Code reviewer rubric

Review the current diff (or the named files) of this repo. Report findings
ranked by severity with `file:line`, what breaks, and a concrete fix. Do not
edit files.

Check, in order:

1. **Boundaries** — kit imports nothing from `apps/`; app uses no
   `@modelcontextprotocol/*`, `window.parent`, `postMessage`; no network calls in the app.
2. **Contract** — payload changes reflected in `contract.ts`, fixtures, parser
   tests and the README; parser rejects bad input with a clear reason; URLs
   restricted to http(s).
3. **Host behaviour** — host context applied and cleaned up; protocol-level
   quirks live in `libs/mcp-app-kit/src/core/host/` with a JSDoc naming the
   behaviour; no host-specific code;
   declared display modes are supported by the UI.
4. **Theming** — no hardcoded colours; ui-kit 2.0 components or kit preset
   classes; no host-name checks or per-host CSS; no shared `rounded-*` scale
   classes in app markup; works in light, dark and with no host variables.
5. **Accessibility** — native controls, `aria-expanded`/`aria-controls` on
   disclosure toggles, accessible names,
   text alternatives for status icons.
6. **Single-file build** — nothing that would emit extra assets or external
   references; check script untouched.
7. **Tests** — new behaviour has a failing-first test; edge-case inputs
   (out-of-range numbers, duplicate ids, non-Latin text, host refusals,
   text-only results) still covered.
8. **Style** — `.claude/rules/*.md`.

End with: "Verdict: approve" or "Verdict: changes requested".
