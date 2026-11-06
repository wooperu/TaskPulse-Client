import { DOCX_MIME_TYPE } from '../../core/config/google-drive.config';
import { WorkspaceDocument } from '../models/workspace-document.model';
import { buildGoogleDocumentPreviewUrl } from './google-document-preview-url';

const FILE_ID = 'AbCdEfGhIjKlMnOpQrStUvWxYz1234567890_-';
const DOCUMENT: WorkspaceDocument = {
  id: 'local',
  workspaceId: 'workspace-a',
  title: 'Notes',
  googleDocumentId: FILE_ID,
  sourceType: 'manual-link',
  addedAt: '2026-11-06T00:00:00.000Z',
};

describe('Google document preview URLs', () => {
  it('builds only the native Google Docs preview route', () => {
    expect(buildGoogleDocumentPreviewUrl(DOCUMENT)).toBe(
      `https://docs.google.com/document/d/${FILE_ID}/preview`,
    );
  });

  it.each([FILE_ID, undefined])('builds a DOCX Drive preview with file ID %s', (fileId) => {
    expect(
      buildGoogleDocumentPreviewUrl({
        ...DOCUMENT,
        sourceType: 'google-drive-upload',
        fileMimeType: DOCX_MIME_TYPE,
        googleDriveFileId: fileId,
      }),
    ).toBe(`https://drive.google.com/file/d/${FILE_ID}/preview`);
  });

  it.each([
    '',
    'short',
    '../document/edit',
    FILE_ID + '/edit',
    'https://evil.example/file',
    'javascript:alert(1)',
    FILE_ID + '?embedded=true',
  ])('rejects invalid identifiers rather than trusting %s', (googleDocumentId) => {
    expect(buildGoogleDocumentPreviewUrl({ ...DOCUMENT, googleDocumentId })).toBeNull();
  });

  it.each([
    'https://evil.example/preview',
    'javascript:alert(1)',
    `https://docs.google.com/document/d/${FILE_ID}/edit`,
  ])('ignores arbitrary saved URLs: %s', (googleDriveWebViewLink) => {
    expect(buildGoogleDocumentPreviewUrl({ ...DOCUMENT, googleDriveWebViewLink })).toBe(
      `https://docs.google.com/document/d/${FILE_ID}/preview`,
    );
  });

  it.each(['https://evil.example/file', 'ZyXwVuTsRqPoNmLkJiHgFeDcBa0987654321_-'])(
    'rejects invalid or inconsistent Drive IDs: %s',
    (googleDriveFileId) => {
      expect(
        buildGoogleDocumentPreviewUrl({
          ...DOCUMENT,
          sourceType: 'google-drive-upload',
          fileMimeType: DOCX_MIME_TYPE,
          googleDriveFileId,
        }),
      ).toBeNull();
    },
  );

  it('rejects unsupported uploaded file formats', () => {
    expect(
      buildGoogleDocumentPreviewUrl({
        ...DOCUMENT,
        sourceType: 'google-drive-upload',
        fileMimeType: 'application/pdf',
      }),
    ).toBeNull();
  });
});
