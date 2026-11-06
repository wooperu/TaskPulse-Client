# Google Drive development setup

TaskPulse uses the Google Identity Services token model and requests only the
`https://www.googleapis.com/auth/drive.file` scope. The browser receives a short-lived access
token. TaskPulse keeps that token in memory and does not put it in browser storage, URLs, or the
document library.

## Google Cloud configuration

1. Create or select a project in the [Google Cloud console](https://console.cloud.google.com/).
2. Open **APIs & Services > Library**, find **Google Drive API**, and enable it.
3. Open **Google Auth Platform** (or **APIs & Services > OAuth consent screen**), configure the app
   name and support contact, and choose the appropriate audience. While the app is in testing,
   add each developer Google account as a test user.
4. Add the non-sensitive `drive.file` scope. TaskPulse does not need full Drive access.
5. Open **Clients**, create an **OAuth client ID**, and choose **Web application**.
6. Add each exact development origin under **Authorized JavaScript origins**. For the normal
   Angular development server, add `http://localhost:4200`. Add separate HTTPS origins for preview
   and production deployments. Do not add paths or trailing route segments.
7. Copy `public/taskpulse-config.example.js` to `public/taskpulse-config.js` and set the Web Client
   ID:

   ```js
   window.taskPulseConfig = {
     googleDriveOAuthClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
   };
   ```

`public/taskpulse-config.js` is Git-ignored. Never put a client secret, API key, access token, or
refresh token in this file. An OAuth Web Client ID is public browser configuration, not a secret.
For a deployed build, generate this file from the deployment platform's public configuration before
serving the Angular assets.

The app displays **Google Drive is not configured** when the runtime file is absent or the Client ID
is blank. A missing local runtime file can also appear as a harmless 404 in the browser's Network
panel.

## Manual verification

1. Start Angular and open `http://localhost:4200` in an allowed browser profile.
2. Open a workspace's **Documents** page and select **Connect Google Drive**.
3. Choose a test user and approve the `drive.file` permission. Cancelling or refusing consent should
   leave the app disconnected with a friendly error.
4. Select a valid DOCX file no larger than 10 MB and upload it. Wait for Google Drive to confirm the
   upload before expecting it in the local library.
5. Confirm the file exists in the OAuth-selected account's Drive and remains a DOCX rather than a
   native Google document.
6. Open the selected document in the embedded editor. The editor's Automatic/Session 0-3 selector
   refers to browser Google sessions and may not be the same account used for the Drive upload.
7. If the expected Docs editor URL does not work for that account or browser, use **Open in Google
   Drive**. Confirm the relevant browser session has permission to the uploaded file.
8. Edit, wait for Google Docs to save, reload, and reopen the document. Repeat on a narrow phone-sized
   viewport and confirm no iframe is mounted.
9. Disconnect and confirm another upload requires authorization again.

## Production limitations

### Milestone 2.1 stability behavior

Workspace parameter changes switch the local library and selected document immediately. Pending
uploads are aborted and invalidated on workspace changes, disconnect, cancellation, and component
destruction. A late completion cannot register metadata or overwrite a newer page message.

Aborting a request does not delete a file or prove that Drive did not receive it. Before retrying a
stopped or interrupted upload, check the uploading account's Drive for the file. This implementation
uses a resumable session with one full-file PUT, but does not retain/query that session after a lost
response or retry automatically. A lost final response can therefore leave a completed file without a
local record, and a manual retry can create a duplicate. Full status-query recovery or pre-generated
Drive IDs belongs in a separate tested milestone.

If browser storage fails after Drive confirms an upload, TaskPulse reports partial success and keeps
the document in memory for the current visit. Copy its Docs or Drive link before leaving; the library
entry may disappear after reload. Removing an entry while storage is blocked likewise affects only
the current visit. Saved fallback destinations are rebuilt from validated document IDs instead of
trusting stored URLs.

Embedded editing requires a viewport of at least 768 CSS pixels, a fine pointer, and a hover-capable
input. This excludes typical touch-only landscape phones while allowing laptops with touchscreens
and mice. It may also exclude touch-only tablets/laptops; a phone with an attached mouse can qualify.
Browser capabilities are a UI restriction, not device identification or a way to revoke Google edit
permissions. Direct Google links remain available in active workspaces only.

### Milestone 2.1 manual regression checklist

1. Open two workspaces with different saved documents. Navigate directly between their Documents
   routes and confirm the heading, library, and selected editor all match the destination workspace.
2. On a throttled network, start a DOCX upload and disconnect. Confirm the stopped/uncertain message
   remains and no late result appears in the library. Check Drive separately before any retry.
3. Repeat with a workspace change and with navigation away from Documents. Return and confirm no
   late registration appeared in either workspace.
4. Temporarily simulate a throwing `Storage.prototype.setItem` in DevTools, keeping its original
   function so it can be restored. Upload once: expect Drive success but a local-save warning, with
   working Docs/Drive links. Restore storage before continuing. Use a disposable test document.
5. Reopen a legacy saved link and an uploaded DOCX. Confirm both still open, session 0-3 and both URL
   modes work, formatting saves, and reopening preserves changes.
6. Block the GIS script once, then unblock it and retry Connect without reloading the page. Confirm
   authorization succeeds and only one GIS script remains.
7. Check a normal desktop with mouse, resize below 768px and back, and use a real touch-only phone in
   portrait and wide landscape. Confirm the phone never mounts the editor iframe.
8. Open an archived workspace and confirm the library remains selectable, the separate Google
   preview replaces the editor, no `/edit` frame or TaskPulse Google editing links are present,
   details remain available, and add/upload/remove remain blocked.

Restore any temporary DevTools overrides and network throttling when finished.

### Milestone 2.7 archived read-only documents

The current workspace's `isArchived` status controls document mode. Active workspaces retain the
existing Google Docs editor, Google sessions, upload flow, and library actions. Archived workspaces
show an **Archived — Read-only** notice and a separate content viewer with a document-details
fallback. The document library stays visible and selectable. Connection/upload/add controls and
removal actions are hidden, with corresponding mutation handlers still guarded. The editable editor
component is completely unmounted, including its iframe, session selector, URL modes, reload button,
and external Docs/Drive links. No CSS overlay or disabled iframe is used.

### Archived content preview follow-up

The dedicated archived viewer requests these candidate content URLs:

- Native Google Docs links: `https://docs.google.com/document/d/VALIDATED_ID/preview`
- Uploaded DOCX files: `https://drive.google.com/file/d/VALIDATED_ID/preview`

The URL utility accepts only strictly validated IDs and supported source metadata, uses fixed HTTPS
hosts and paths, and ignores stored fallback URLs. Uploaded records with an absent Drive ID can use
the validated document ID; inconsistent IDs or unsupported MIME types fail closed to details. No
regular `/edit` URL is used, no account/editing-mode selector is exposed, and no TaskPulse link opens
an editable Google interface. A new iframe is mounted for each selection or explicit retry, and old
frame events cannot change the new document's state.

These are browser-verification candidates, not an official preview SDK or a verified permission
boundary. Actual private-document rendering and absence of editing controls remain unverified until
tested with the user's accounts in Chrome. The preview uses existing Google **browser sessions**,
not the in-memory Drive OAuth token. Sign into an account with document access in the same Chrome
profile first; signing into Drive through OAuth alone does not select the iframe account. With
multiple accounts, Google's default session may lack access even if another account has permission.
The archived viewer intentionally does not infer session-index-to-email mappings.

The sandbox permits scripts and same-origin operation needed by Google's viewer but does not permit
popups, top-level navigation, forms, or downloads. These restrictions may prevent Google's sign-in or
pop-out UI from working. They **do not** prohibit same-frame navigation, prove absence of an editing
path, or revoke existing Google editing access. If any in-frame editing control, editable surface,
or route to editing is observed, stop using that preview and select **Use document details**. That
closes the iframe and keeps that document in details-only mode while this viewer stays mounted;
**Retry preview** is an explicit user action. This is a manual fallback, not automatic inspection of
Google's UI, and the preview must not be treated as verified safe before the checks below.

No cross-origin DOM inspection is attempted. An iframe `load` event may be a sign-in, permission,
CSP/X-Frame-Options error, or blank page; it does not establish that content loaded or is read-only.
Reported frame errors and a 20-second no-load timeout remove the iframe automatically. Some browser
blocks still fire `load`, so **Use document details** remains available whenever a frame is mounted.
The title/source details remain visible even during a successful preview. No automatic retry or
fallback to the editable editor occurs.

Private content is expected to display only if the selected browser session has access and Google
allows the candidate viewer in the embedding context. CSP/frame policy, account policy, cookies,
viewer support, file availability, DOCX conversion/rendering delays, and browser/device behavior may
prevent it. No file is published or shared publicly to work around these failures. Google's official
[embedding/cookie announcement](https://workspaceupdates.googleblog.com/2023/10/upcoming-changes-to-third-party-cookies-in-google-drive.html)
describes a publishing flow for Workspace files and an Embed item flow for other files; it does not
establish this private native Docs candidate as a guaranteed integration. Chrome's
[cookie help](https://support.google.com/chrome/answer/95647) also describes browser-session limits.

An authenticated PDF viewer is a possible future alternative: authorized native Google Workspace
documents can be exported to PDF with Drive `files.export`, then viewed through an in-memory blob
URL with proper cleanup. Browser access to a manually registered link does not itself grant API
access through `drive.file`; existing files may need a Google Picker grant, and download/export
capabilities must be checked. Original binary DOCX files cannot be passed to `files.export` as if
they were native Docs: they require a separate approved conversion pipeline, an approved temporary
native copy, or a PDF supplied by the owner. No conversion, content download, new OAuth scope,
server component, or permission changes are implemented here. Google's
[download/export guide](https://developers.google.com/workspace/drive/api/guides/manage-downloads)
describes the distinction and the native-export size limit.

Google's [file metadata reference](https://developers.google.com/workspace/drive/api/reference/rest/v3/files)
defines `webViewLink` as opening a relevant editor **or** viewer, so it is not used as a read-only
guarantee. Google's [document embedding help](https://support.google.com/docs/answer/183965) describes
publishing to the web; TaskPulse does not publish documents or change sharing to enable a preview.

Archiving is reactive: navigating between workspaces changes document mode, and archiving the current
workspace through the mock service unmounts the editor without a route change. Pending uploads are
aborted and invalidated. Completion also checks the current archive status before registration,
including responses that arrive before the archive effect renders. An abort cannot prove Drive did
not receive the file; check Drive before retrying. Selection of existing documents is preserved.
The mock service has no unarchive operation; returning to an active workspace restores its editor.

This read-only mode applies to TaskPulse's UI, not edits made directly at docs.google.com or in other
already-open tabs. Existing Google Drive permissions are unchanged. Enforcing Drive-level editing
restrictions would require an explicit ownership/sharing policy, authorized server-side coordination
of direct and inherited permissions, and consideration of owner/editor capabilities and documents
referenced by multiple workspaces. Such changes need separate consent and testing; this milestone
makes no Drive permission or file-content-restriction requests. See Google's
[sharing guidance](https://developers.google.com/workspace/drive/api/guides/manage-sharing).

Manual checks before committing this change:

1. In an active desktop workspace, verify add/remove, DOCX upload, editing, formatting, saving,
   reopening, Automatic/Session 0-3, URL mode selection, and direct-open links still work.
2. Use a disposable workspace containing a Google Docs link and an uploaded DOCX, then archive it
   through Settings. Open Documents and select both entries. Inspect the actual first and last
   pages, not just the iframe element: content should be readable, with no typing, formatting,
   editing toolbar, or path to an editable interface. Verify URLs end in `/preview`, never `/edit`.
   If editing appears, select **Use document details** immediately and report which file type/browser
   failed. Confirm no add/upload/remove actions or TaskPulse editing links are present.
3. Switch directly between active and archived Documents routes; verify selection, headings, and
   mode follow the destination. Confirm the active editor returns without an archived-mode residue.
4. In the Angular development server, while a disposable upload is pending on a throttled network,
   archive the current workspace without navigating away. In DevTools Console, run:

   ```js
   const documentsPage = ng.getComponent(document.querySelector('app-documents'));
   documentsPage.workspaceService.archive(documentsPage.workspaceId());
   ```

   This invokes the existing in-memory mock service; the Angular `ng` debugging API is unavailable
   in production builds. Confirm abort/invalidation, accurate uncertain-outcome feedback, and no
   late library registration. Separate browser tabs do not share mock service state. Check Drive
   before retrying.

5. On a real phone and a desktop resized across the breakpoint, verify archived content remains
   readable or offers the details fallback, while active editing keeps its desktop restriction.
6. Confirm archived workspace navigation still includes Documents/Members/Settings and hides New
   task. Restore network throttling when finished.
7. Test a private native document and a private uploaded DOCX in normal Chrome tabs using their
   candidate `/preview` URLs first. Repeat inside TaskPulse with one signed-in account, then two
   accounts where only one has access. Do not change sharing permissions or publish either file.
8. Test signed-out/no-permission cases, third-party-cookie blocking, and a blocked preview request
   in DevTools. Check Console/Network for CSP, `frame-ancestors`, X-Frame-Options, sandbox, and auth
   failures. Verify **Use document details** always unmounts a blocked or unsafe frame, and **Retry
   preview** creates only a preview frame after signing in/restoring access. Restore browser settings.

This milestone is a frontend-only development integration. Google Identity Services does not issue
refresh tokens to this browser token flow, so authorization must be renewed after expiry. The local
document metadata is device-specific and is not a shared or access-controlled TaskPulse record.

Before production, move durable Google account linking to the backend with an authorization-code
flow, encrypted refresh-token storage, CSRF/state protections, audited token revocation, and a
server-owned document record. The backend should also enforce workspace authorization and upload
policy. The iframe's Google browser session remains independent even after backend OAuth is added.

Official references:

- [Google Identity Services token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Drive API JavaScript quickstart](https://developers.google.com/workspace/drive/api/quickstart/js)
- [Drive upload guide](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Drive files.create](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create)
