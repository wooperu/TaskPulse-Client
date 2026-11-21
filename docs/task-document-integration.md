# Task documents list and dedicated viewer

## Scope and baseline

- Frontend baseline: `4eaf530c3e2636d5e9100bfccdc1087c30088886` (`origin/master` at the initial fetch).
- Worktree: `TaskPulse-Client-TaskGoogleDocs`.
- Branch: `feature/task-google-docs-integration`.
- Backend contract inspected read-only: `38a9f4186b226790a9ea4a135378ffabdb2430ed`.
- No backend, database, original frontend checkout, prior workspace-document worktree, private runtime configuration, or PR is changed.

This feature is task-owned metadata, not the unused workspace-library API integration.

## API and task editing

`TaskDocumentApiService` uses `apiUrl()`, HttpClient and the existing TaskPulse JWT interceptor:

| Method | Route                                        | Success                        |
| ------ | -------------------------------------------- | ------------------------------ |
| GET    | `/api/tasks/{taskId}/documents`              | Document array, possibly empty |
| POST   | same collection                              | Created document DTO           |
| GET    | `/api/tasks/{taskId}/documents/{documentId}` | Document DTO                   |
| PATCH  | same item                                    | 204                            |
| DELETE | same item                                    | 204                            |

Writes serialize only `{url, label}`. PATCH always sends both fields. The DTO contains `id`,
`taskId`, `url`, `label`, `createdAtUtc`, `createdByUserId`, and nullable `updatedAtUtc`.
The optional task-details `documents` field describes the new backend while preserving older
task-detail fixtures/consumers. The displayed list comes from the collection GET, never a union
with `linkedDocument`. A backfilled compatibility slot therefore appears only once.

POST/PATCH/DELETE reload the authoritative collection after success; failures are not silently retried.
API errors use the existing safe error parser, including 400/401/403/404/409/network errors.
Removing a link never calls a provider's file-deletion API.

Task creation/editing retain their singular compatibility endpoint behavior. An untouched document
is not submitted during unrelated edits. A regression exposed the old validator's rejection of
supported Drive file links in that slot; it now narrowly accepts the backend's file paths, not folders.
Other collection documents are not managed or cleared by the old task form.

## Viewer and original links

Route: `/workspaces/:workspaceId/tasks/:taskId/documents/:documentId`, under the existing
authentication and workspace-readiness guards. A deep link first reads fresh workspace access/archive
metadata through the existing workspace GET, then loads the task and confirms its workspace, then
performs item GET and confirms both returned IDs. Router state is not the data source. A stale active
workspace cache cannot by itself select editable mode; unknown/failed metadata never mounts an editor.
Reloading the browser requires TaskPulse sign-in again because existing tokens are memory-only;
the existing auth guard retains the return URL.

Native Google Docs links get two Task Details actions:

- **View document** navigates within TaskPulse.
- **Open in Google Docs** uses a validated, reconstructed canonical Docs URL and `_blank` with
  `rel="noopener noreferrer"`. IDs retain exact casing. The original action remains available
  in archived workspaces: archiving does not revoke Google editing permissions.

Navigation and persistence URLs are separate: label-only PATCH preserves validated meaningful path,
query and fragment values instead of writing the simplified edit action URL back to the API. Native
Docs external actions retain these parameters/anchors while using the canonical edit path. Sheets/
Slides external actions retain view/preview paths rather than forcing edit mode. Session paths and
authuser selectors are still removed, and known OAuth credential parameters are still rejected.

The existing Docs editor is reused through a presentation-only WorkspaceDocument adapter. That
adapter is never written to the legacy localStorage library. Browser session selection and normal/
embedded URL modes remain inside the existing editor, independent of TaskPulse login. Session
indexes are not emails, and they are never submitted to the backend. No cross-origin DOM access,
Google cookie manipulation, editor proxying or browser-security bypass is introduced.

The shared provider boundary rejects unsupported hosts, non-HTTPS/userinfo/nondefault ports,
unsafe paths and known Google OAuth token query/fragment fields. Google session selectors are
removed. It is not a general secret scanner. Historical unsafe metadata is displayed as text
without a clickable URL or iframe.
The task viewer accepts a deliberately stricter subset of the backend's broad Google path prefixes:
the existing native Docs parser requires a plausible case-sensitive ID and recognized path suffix.
Unsupported historical shapes fail closed; accepting a link on the backend does not guarantee an embed.

Only native Docs currently have a supported embedded task viewer. Drive files (whose MIME type is
unknown), Sheets, Slides, Microsoft/OneDrive and GitHub use **Open original**, not fabricated Docs
URLs. Direct item routes for these providers show the same external fallback. No claim is made
that accepting a Drive URL proves DOCX type, file existence, sharing permission or embed support.

Archived native Docs use the existing sandboxed read-only preview component; no editable editor
component is mounted. Active-workspace phone-sized/touch-only devices retain the existing desktop
capability restriction: no editable iframe. Google controls actual preview behavior; browser checks
remain mandatory. TaskPulse UI restrictions cannot revoke editing in an external Google tab.
Fresh archive metadata is a point-in-time check, not real-time revocation: another user may archive
after the read. Subsequent workspace state changes/reloads select preview mode. There is no polling
or new cross-feature locking infrastructure. Existing ID-based iframe builders are unchanged and do
not forward every saved query/anchor; use the parameter-preserving external action if needed.

## Identity, requests and permissions

State is local to each list/viewer instance. Context changes include task/workspace/route and the
current user identity object. Context changes/destruction unsubscribe pending document HTTP calls,
reset forms and clear/hide previous data. Responses must match the captured context and token
snapshot. Token changes during a request produce a reload/sign-in message rather than displaying
the old response. Explicit reload uses the current credentials. Unsubscription cannot undo a
write already received by the backend; users should reload before repeating an uncertain write.

A narrowly scoped `NO_AUTH_RETRY` HttpContext option is honored by the existing interceptor.
Document requests still receive the TaskPulse JWT, but a 401 never refreshes/replays that request
or expires a newer login. Other API requests retain their existing behavior. An expired document
request asks the user to sign in/reload; it does not automatically retry a write. AuthService itself
is unchanged. Google OAuth tokens are never sent through this API.

Task creator/assignee or workspace Owner/Admin can mutate when the workspace is active. Global
Admin alone does not enable controls. The backend remains authoritative for current membership,
archive changes and all permissions. UI checks are not authorization-at-commit guarantees.

## DOCX upload and legacy tools

Task-context upload is deliberately deferred. The existing Google Drive authorization/uploader is
coupled to legacy browser-local registration. This implementation reuses neither its persistence
nor a second OAuth flow. Users can attach an already uploaded supported Drive file URL.

A future upload task must retain confirmed Drive ID/link after attachment failure, retry only the
attachment, never automatically delete the Drive file, and bind recovery to the original TaskPulse
user/task. This recovery workflow is not implemented or claimed tested here.
Reuse the existing authorization/uploader and POST the canonical Drive URL plus label to this same
task-document API; no second metadata table is needed. Cancel/invalidate work on navigation/logout,
and reconcile the collection before retrying an uncertain attachment outcome. Validate the returned
Drive ID/MIME, keep confirmed recovery details in the original context, and never infer MIME from a
saved URL after reopening. Re-query Drive where authorized or retain the external-file fallback.

The old workspace route remains available as **Browser-local document tools**, explicitly not a
shared authoritative library. No old localStorage records are deleted, moved, or automatically
attached to tasks. Existing Google Drive configuration/setup documentation remains applicable to
those legacy tools. Private `public/taskpulse-config.js` was not copied to this worktree.

## Verification and manual checks

Existing locked dependencies were installed in this new worktree with
`npm ci --ignore-scripts --no-audit --no-fund`; no package manifest/lock changes or new dependencies.

Commands:

```powershell
npx tsc -p tsconfig.app.json --noEmit
npx tsc -p tsconfig.spec.json --noEmit
npx ng test --watch=false
npx ng build --configuration production
# Prettier is run on the explicit changed/new file inventory only.
git diff --check
```

Final verification: both TypeScript checks passed; all **460 tests across 47 files** passed;
production build passed without warnings/errors (initial bundle 342.17 kB); changed-file
Prettier and `git diff --check` passed. The targeted Drive compatibility regression was first
observed failing before the validator correction, then passed in the final full run. Git's
LF-to-CRLF notices reflect the existing Windows checkout policy, not build failures.

Final file inventory: 10 modified tracked files and 14 new files, all unstaged. Existing-file
formatting follows the repository Prettier configuration; no unrelated files were formatted.

Tests use HttpTestingController, component fixtures, RouterTestingHarness, fake identities/media
capabilities and simulated responses. They cover contracts, errors, both native Docs actions,
protected new-tab attributes, provider labels/fallbacks, permissions, archives, mobile restrictions,
deep links, stale requests, logout/login changes, compatibility display and task-edit regressions.
Existing editor, preview, upload, localStorage, auth and task suites remain part of the full run.

Not verified by these tests: a live backend/database, real Google embedding/CSP/cookies/account
selection, Google autosave/reopening/collaboration, actual phone hardware or visual browser layout.
No backend or PostgreSQL process was started and no migration was applied.

Before release, use an approved backend containing the reviewed migration and complete its separate
PostgreSQL verification. Then test multiple task links across members/roles, deep links after sign-in,
two Google sessions in one browser profile, editing/save/reopen, archived preview and original-file
opening, narrow/touch-only screens, provider fallbacks, logout during pending requests, and Google
authentication/permission/CSP failures. A frame load event is not proof of successful editing/preview.

Ready for final code review with task-context upload and live/browser verification explicitly outstanding.
No commit, push or PR was created.

## Final review corrections

- Medium: metadata edits were persisting a navigation URL, stripping meaningful native Docs query/
  fragment information and changing Sheets view paths to edit paths. Persistence now uses its own
  validated URL; external native Docs links preserve meaningful parameters too.
- Medium: editor mode trusted cached archive status. Fresh workspace metadata is now required before
  task/item content can mount the editor; missing, mismatched or failed metadata blocks rendering.
- Regression tests reproduced both defects before correction. Additional tests verify mutation
  permission failures preserve rows/drafts. Ordinary authentication refresh behavior remains unchanged.

Review edits are confined to the task-link utility and spec, task-documents component and spec,
task-document API service and spec, task-document viewer component/template/spec, and this document.
