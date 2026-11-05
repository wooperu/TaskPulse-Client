import { signal, WritableSignal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { DOCX_MIME_TYPE } from '../../../core/config/google-drive.config';
import { DocumentWorkspaceService } from '../../../core/services/document-workspace.service';
import { GoogleDriveAuthService } from '../../../core/services/google-drive-auth.service';
import {
  GoogleDriveUploadError,
  GoogleDriveUploadService,
} from '../../../core/services/google-drive-upload.service';
import { Documents } from './documents';

const FILE_ID = 'AbCdEfGhIjKlMnOpQrStUvWxYz1234567890_-';

interface DocumentsUploadHarness {
  uploadFile: WritableSignal<File | null>;
  uploadDocx(): Promise<void>;
  disconnectGoogleDrive(): void;
  cancelUpload(): void;
  workspaceId: () => string;
  documents: () => readonly { googleDocumentId: string; workspaceId: string }[];
  selectedDocument: () => { googleDriveWebViewLink?: string } | undefined;
  statusMessage: () => string;
  uploading: () => boolean;
}

describe('Documents upload workflow', () => {
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const uploadDocx = vi.fn();
  const authState = signal<'connected'>('connected');
  const authService = {
    status: authState.asReadonly(),
    error: signal('').asReadonly(),
    configured: signal(true).asReadonly(),
    connected: signal(true).asReadonly(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    getValidAccessToken: vi.fn().mockReturnValue('memory-only-token'),
    markExpired: vi.fn(),
  };

  beforeEach(async () => {
    localStorage.clear();
    uploadDocx.mockReset();
    params = new BehaviorSubject(convertToParamMap({ workspaceId: 'ws-product' }));
    await TestBed.configureTestingModule({
      imports: [Documents],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: params.asObservable() },
        },
        { provide: GoogleDriveAuthService, useValue: authService },
        { provide: GoogleDriveUploadService, useValue: { uploadDocx } },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('registers metadata only after Drive confirms a successful upload', async () => {
    uploadDocx.mockResolvedValue({
      id: FILE_ID,
      name: 'Sprint plan.docx',
      mimeType: DOCX_MIME_TYPE,
      webViewLink: `https://drive.google.com/file/d/${FILE_ID}/view`,
    });
    const fixture = TestBed.createComponent(Documents);
    const component = fixture.componentInstance as unknown as DocumentsUploadHarness;
    component.uploadFile.set(new File(['content'], 'Sprint plan.docx', { type: DOCX_MIME_TYPE }));

    await component.uploadDocx();

    expect(TestBed.inject(DocumentWorkspaceService).documentsFor('ws-product')()).toEqual([
      expect.objectContaining({
        googleDriveFileId: FILE_ID,
        sourceType: 'google-drive-upload',
      }),
    ]);
  });

  it('does not register a document when the Drive upload fails', async () => {
    uploadDocx.mockRejectedValue(new GoogleDriveUploadError('Upload failed.'));
    const fixture = TestBed.createComponent(Documents);
    const component = fixture.componentInstance as unknown as DocumentsUploadHarness;
    component.uploadFile.set(new File(['content'], 'Sprint plan.docx', { type: DOCX_MIME_TYPE }));

    await component.uploadDocx();

    expect(TestBed.inject(DocumentWorkspaceService).documentsFor('ws-product')()).toEqual([]);
  });

  it('updates the library and selection when workspace parameters change on the same instance', () => {
    const service = TestBed.inject(DocumentWorkspaceService);
    service.add('ws-product', 'Product', FILE_ID);
    const other = service.add('ws-design', 'Design', 'ZyXwVuTsRqPoNmLkJiHgFeDcBa0987654321_-');
    const fixture = TestBed.createComponent(Documents);
    const component = fixture.componentInstance as unknown as DocumentsUploadHarness;
    expect(component.documents()[0].workspaceId).toBe('ws-product');
    params.next(convertToParamMap({ workspaceId: 'ws-design' }));
    expect(fixture.componentInstance).toBe(component);
    expect(component.workspaceId()).toBe('ws-design');
    expect(component.documents()).toEqual([other]);
    expect(component.selectedDocument()).toEqual(other);
    params.next(convertToParamMap({ workspaceId: 'ws-launch' }));
    expect(component.documents()).toEqual([]);
    expect(component.selectedDocument()).toBeUndefined();
  });

  it.each(['disconnect', 'destroy', 'navigate', 'cancel'] as const)(
    'ignores a late upload completion after %s',
    async (action) => {
      let finish!: (metadata: unknown) => void;
      uploadDocx.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      const fixture = TestBed.createComponent(Documents);
      const component = fixture.componentInstance as unknown as DocumentsUploadHarness;
      component.uploadFile.set(new File(['content'], 'plan.docx', { type: DOCX_MIME_TYPE }));
      const pending = component.uploadDocx();
      const abortSignal = uploadDocx.mock.calls[0][2] as AbortSignal;
      if (action === 'disconnect') component.disconnectGoogleDrive();
      if (action === 'destroy') fixture.destroy();
      if (action === 'navigate') params.next(convertToParamMap({ workspaceId: 'ws-design' }));
      if (action === 'cancel') component.cancelUpload();
      const message = component.statusMessage();
      finish({ id: FILE_ID, name: 'plan.docx', mimeType: DOCX_MIME_TYPE });
      await pending;
      expect(abortSignal.aborted).toBe(true);
      const documents = TestBed.inject(DocumentWorkspaceService);
      expect(documents.documentsFor('ws-product')()).toEqual([]);
      expect(documents.documentsFor('ws-design')()).toEqual([]);
      expect(component.statusMessage()).toBe(message);
      expect(component.uploading()).toBe(false);
    },
  );

  it('does not let an old upload clear a newer upload busy state', async () => {
    let finishOld!: (metadata: unknown) => void;
    let finishNew!: (metadata: unknown) => void;
    uploadDocx
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishOld = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishNew = resolve;
        }),
      );
    const fixture = TestBed.createComponent(Documents);
    const component = fixture.componentInstance as unknown as DocumentsUploadHarness;
    component.uploadFile.set(new File(['content'], 'plan.docx', { type: DOCX_MIME_TYPE }));
    const oldUpload = component.uploadDocx();
    component.cancelUpload();
    const newUpload = component.uploadDocx();
    finishOld({ id: FILE_ID, name: 'old.docx', mimeType: DOCX_MIME_TYPE });
    await oldUpload;
    expect(component.uploading()).toBe(true);
    finishNew({ id: FILE_ID, name: 'new.docx', mimeType: DOCX_MIME_TYPE });
    await newUpload;
    expect(component.uploading()).toBe(false);
    expect(component.documents()).toHaveLength(1);
  });

  it('reports Drive success and local persistence failure while retaining a safe open link', async () => {
    uploadDocx.mockResolvedValue({ id: FILE_ID, name: 'plan.docx', mimeType: DOCX_MIME_TYPE });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    const fixture = TestBed.createComponent(Documents);
    const component = fixture.componentInstance as unknown as DocumentsUploadHarness;
    component.uploadFile.set(new File(['content'], 'plan.docx', { type: DOCX_MIME_TYPE }));
    await component.uploadDocx();
    expect(component.statusMessage()).toContain('Uploaded to Google Drive, but could not save');
    expect(component.statusMessage()).not.toContain('added it to this workspace');
    expect(component.selectedDocument()?.googleDriveWebViewLink).toBe(
      `https://drive.google.com/file/d/${FILE_ID}/view`,
    );
    expect(localStorage.length).toBe(0);
  });
});

describe('Documents route reuse', () => {
  beforeEach(() => {
    localStorage.clear();
    // Keep iframe/network behavior out of the router integration test.
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('switches libraries when Angular reuses the Documents route instance', async () => {
    await TestBed.configureTestingModule({
      imports: [Documents],
      providers: [
        provideRouter([{ path: 'workspaces/:workspaceId/documents', component: Documents }]),
      ],
    }).compileComponents();
    const service = TestBed.inject(DocumentWorkspaceService);
    service.add('ws-product', 'Product notes', FILE_ID);
    service.add('ws-design', 'Design notes', 'ZyXwVuTsRqPoNmLkJiHgFeDcBa0987654321_-');
    const harness = await RouterTestingHarness.create();
    const first = await harness.navigateByUrl('/workspaces/ws-product/documents', Documents);
    expect(harness.routeNativeElement?.textContent).toContain('Product notes');
    const second = await harness.navigateByUrl('/workspaces/ws-design/documents', Documents);
    expect(second).toBe(first);
    expect(harness.routeNativeElement?.textContent).toContain('Design notes');
    expect(harness.routeNativeElement?.textContent).not.toContain('Product notes');
  });
});
