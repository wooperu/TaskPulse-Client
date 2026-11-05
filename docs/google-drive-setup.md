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
permissions. Direct Google links remain available.

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
8. Open an archived workspace and confirm add/upload/remove remain blocked.

Restore any temporary DevTools overrides and network throttling when finished.

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
