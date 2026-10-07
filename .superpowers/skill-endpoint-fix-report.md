# Skill endpoint fix report

## Verified in DIAL Core (ai-dial-core)

- `server/.../controller/ComplexResourceController.java:282-320`: `GET /v2/skills/{bucket}/{path}`
  is `operationId = "downloadSkillFolder"`, `contentTypes = {"application/zip"}`, body
  `byte[].class` — confirmed it streams a ZIP, not JSON.
- `server/.../controller/ComplexResourceMetadataController.java:52-80`: `GET
  /v2/metadata/skills/{bucket}/{path}` is `operationId = "listSkillMetadata"`, responds `200` with
  `oneOf {ResourceFolderMetadata, ComplexResourceItemMetadata}` — plain JSON, no ZIP content type
  override.
- `storage/.../data/ComplexResourceItemMetadata.java`: extends `ResourceItemMetadata`, adds
  `attributes: Map<String, Object>`, documented as carrying "name/description/version parsed from
  a skill's manifest" — exactly what `mapSkill` in `servers/entity-mcp/src/mapping/entity.ts`
  reads (`attributes.name`, `attributes.description`). Confirmed the metadata endpoint returns
  `attributes` for a single skill path; no second wrong endpoint found.

## Changes (ai-dial-entity-mcp-app, branch feat/entity-mcp-server)

- `servers/entity-mcp/src/core/routing.ts`: skill branch now builds
  `/v2/metadata/{SKILL_PREFIX}/{bucket}/{path}` instead of `/v2/{SKILL_PREFIX}/...`. The
  `skills/` prefix check, traversal rejection, empty-segment rejection, and per-segment
  `encodeURIComponent` are all unchanged. The agent branch (`/openai/applications/{id}`) is
  untouched. JSDoc updated to explain why the metadata endpoint is used instead of the
  folder-download endpoint.
- `servers/entity-mcp/src/core/routing.spec.ts`: updated the two existing assertions that expected
  `/v2/skills/...` to expect `/v2/metadata/skills/...`; added a new dedicated test,
  `routes a skill read through the metadata endpoint, not the ZIP download endpoint`, asserting the
  skill URL is the metadata path so this cannot silently regress. All other security tests
  (traversal, empty segment, trailing slash, percent-encoding, scheme-like ids, userMessage
  leak-safety) left unchanged in intent.
- `servers/entity-mcp/src/core/client.spec.ts`: updated the one assertion that hardcoded
  `https://core.example.com/v2/skills/b/s` to `.../v2/metadata/skills/b/s`.
- `servers/entity-mcp/src/mapping/entity.ts`: updated the `mapSkill` JSDoc `@param` comment that
  named the old endpoint (`GET /v2/skills/{bucket}/{path}`) to the new one.
- `grep -rn "v2/skills" servers/ apps/ libs/ .` (repo-wide, excluding node_modules/.git) returns no
  remaining hits after the above changes. `servers/entity-mcp/README.md` does not describe the
  endpoint path itself (only the entity id shape, `skills/{bucket}/{path}`), so it needed no
  change.

## Agent-side check

`ai-dial-core/server/.../controller/ApplicationController.java:85-101`: `GET
/openai/applications/{application_name}` is `operationId = "getApplication"`, response body
`ApplicationData.class`, no `contentTypes` override (defaults to JSON). Confirmed this really does
return plain JSON `ApplicationData`, not a different content type — the agent branch in
`routing.ts` was already correct and required no change.

## Test output

`npm run verify` (lint, format:check, typecheck, test, build): all green.
`Test Files 32 passed (32)`, `Tests 361 passed (361)`.

## Commit

Committed locally on `feat/entity-mcp-server`, no push, no PR, no Co-Authored-By trailer.
