import { DocumentPersistenceError, DocumentWorkspaceService } from './document-workspace.service';
import { DOCX_MIME_TYPE } from '../config/google-drive.config';

const DOCUMENT_A = 'AbCdEfGhIjKlMnOpQrStUvWxYz1234567890_-';
const DOCUMENT_B = 'ZyXwVuTsRqPoNmLkJiHgFeDcBa0987654321_-';

describe('DocumentWorkspaceService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it.each(['QuotaExceededError', 'SecurityError'])(
    'surfaces %s while retaining session metadata',
    (name) => {
      const service = new DocumentWorkspaceService();
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Storage unavailable', name);
      });
      expect(() => service.add('workspace-a', 'Temporary', DOCUMENT_A)).toThrow(
        DocumentPersistenceError,
      );
      expect(service.storageAvailable()).toBe(false);
      expect(service.documentsFor('workspace-a')()).toHaveLength(1);
      expect(service.documentsFor('workspace-b')()).toEqual([]);
    },
  );

  it('loads safely when browser storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    const service = new DocumentWorkspaceService();
    expect(service.documentsFor('workspace-a')()).toEqual([]);
    expect(service.storageAvailable()).toBe(false);
  });

  it('reports a removal write failure without claiming it was persisted', () => {
    const service = new DocumentWorkspaceService();
    const added = service.add('workspace-a', 'Temporary', DOCUMENT_A);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Blocked');
    });
    expect(() => service.remove('workspace-a', added.id)).toThrow(DocumentPersistenceError);
    expect(service.documentsFor('workspace-a')()).toEqual([]);
    vi.restoreAllMocks();
    expect(new DocumentWorkspaceService().documentsFor('workspace-a')()).toHaveLength(1);
  });

  it.each([
    'https://drive.google.com/file/d/' + DOCUMENT_A + '/view',
    'https://docs.google.com/document/d/' + DOCUMENT_A + '/edit',
    'https://evil.example/phishing',
    'https://drive.google.com.evil.example/file/d/' + DOCUMENT_A + '/view',
    'javascript:alert(1)',
    'not a URL',
  ])('derives a safe fallback instead of trusting saved destination %s', (savedUrl) => {
    localStorage.setItem(
      'taskpulse.documents.v1.workspace-a',
      JSON.stringify([
        {
          id: 'saved',
          workspaceId: 'workspace-a',
          title: 'Saved DOCX',
          googleDocumentId: DOCUMENT_A,
          googleDriveFileId: DOCUMENT_A,
          sourceType: 'google-drive-upload',
          fileMimeType: DOCX_MIME_TYPE,
          googleDriveWebViewLink: savedUrl,
          addedAt: '2026-11-05T00:00:00.000Z',
        },
      ]),
    );
    const saved = new DocumentWorkspaceService().documentsFor('workspace-a')()[0];
    expect(saved.googleDriveWebViewLink).toBe(`https://drive.google.com/file/d/${DOCUMENT_A}/view`);
    expect(saved.title).toBe('Saved DOCX');
    expect(saved.googleDriveFileId).toBe(DOCUMENT_A);
  });

  it('keeps document lists separated by workspace', () => {
    const service = new DocumentWorkspaceService();
    service.add('workspace-a', 'A document', DOCUMENT_A);
    service.add('workspace-b', 'B document', DOCUMENT_B);

    expect(
      service
        .documentsFor('workspace-a')()
        .map((document) => document.googleDocumentId),
    ).toEqual([DOCUMENT_A]);
    expect(
      service
        .documentsFor('workspace-b')()
        .map((document) => document.googleDocumentId),
    ).toEqual([DOCUMENT_B]);
  });

  it('restores persisted metadata in a new service instance', () => {
    const first = new DocumentWorkspaceService();
    first.add('workspace-a', 'Persistent document', DOCUMENT_A);

    const second = new DocumentWorkspaceService();
    expect(second.documentsFor('workspace-a')()).toEqual([
      expect.objectContaining({
        workspaceId: 'workspace-a',
        title: 'Persistent document',
        googleDocumentId: DOCUMENT_A,
        sourceType: 'manual-link',
      }),
    ]);
  });

  it('keeps legacy Milestone 1 entries and normalizes them as manual links', () => {
    localStorage.setItem(
      'taskpulse.documents.v1.workspace-a',
      JSON.stringify([
        {
          id: 'legacy-document',
          workspaceId: 'workspace-a',
          title: 'Legacy document',
          googleDocumentId: DOCUMENT_A,
          addedAt: '2026-11-05T00:00:00.000Z',
        },
      ]),
    );

    const service = new DocumentWorkspaceService();
    expect(service.documentsFor('workspace-a')()[0]).toEqual(
      expect.objectContaining({ id: 'legacy-document', sourceType: 'manual-link' }),
    );
  });

  it('registers returned Google Drive metadata only in the selected workspace', () => {
    const service = new DocumentWorkspaceService();
    const document = service.addUploadedDocx('workspace-a', {
      id: DOCUMENT_B,
      name: 'Uploaded notes.docx',
      mimeType: DOCX_MIME_TYPE,
      webViewLink: `https://drive.google.com/file/d/${DOCUMENT_B}/view`,
    });

    expect(document).toEqual(
      expect.objectContaining({
        title: 'Uploaded notes',
        sourceType: 'google-drive-upload',
        googleDriveFileId: DOCUMENT_B,
        fileMimeType: DOCX_MIME_TYPE,
      }),
    );
    expect(service.documentsFor('workspace-b')()).toEqual([]);
  });

  it('removes only local metadata from the selected workspace', () => {
    const service = new DocumentWorkspaceService();
    const document = service.add('workspace-a', 'A document', DOCUMENT_A);

    expect(service.remove('workspace-a', document.id)).toBe(true);
    expect(service.documentsFor('workspace-a')()).toEqual([]);
  });
});
