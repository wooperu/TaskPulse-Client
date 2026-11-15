import { signal, WritableSignal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { DOCX_MIME_TYPE } from '../../../core/config/google-drive.config';
import { DocumentWorkspaceService } from '../../../core/services/document-workspace.service';
import { GoogleDriveAuthService } from '../../../core/services/google-drive-auth.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { WorkspaceDocument } from '../../../shared/models/workspace-document.model';
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

interface ArchivedDocumentsHarness extends DocumentsUploadHarness {
  addDocument(): void;
  removeDocument(document: WorkspaceDocument): void;
  form: { setValue(value: { title: string; url: string }): void };
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
    service.add('ws-launch', 'Archived notes', FILE_ID);
    const archived = await harness.navigateByUrl('/workspaces/ws-launch/documents', Documents);
    expect(archived).toBe(first);
    expect(harness.routeNativeElement?.querySelector('app-google-docs-editor')).toBeNull();
    expect(
      harness.routeNativeElement?.querySelector('#archived-document-heading')?.textContent,
    ).toContain('Archived notes');
    const restored = await harness.navigateByUrl('/workspaces/ws-product/documents', Documents);
    expect(restored).toBe(first);
    expect(harness.routeNativeElement?.querySelector('app-google-docs-editor')).not.toBeNull();
  });
});

describe('Archived document mode', () => {
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const uploadDocx = vi.fn();
  const connect = vi.fn();
  let onMediaChange: ((event: MediaQueryListEvent) => void) | undefined;
  const removeMediaListener = vi.fn();

  beforeEach(async () => {
    localStorage.clear();
    uploadDocx.mockReset();
    connect.mockClear();
    removeMediaListener.mockClear();
    onMediaChange = undefined;
    params = new BehaviorSubject(convertToParamMap({ workspaceId: 'ws-product' }));
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
          onMediaChange = listener;
        },
        removeEventListener: removeMediaListener,
      })),
    });
    await TestBed.configureTestingModule({
      imports: [Documents],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } },
        { provide: GoogleDriveUploadService, useValue: { uploadDocx } },
        {
          provide: GoogleDriveAuthService,
          useValue: {
            status: signal('connected'),
            error: signal(''),
            configured: signal(true),
            connected: signal(true),
            connect,
            getValidAccessToken: () => 'memory-only-token',
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  function createPage() {
    const fixture = TestBed.createComponent(Documents);
    fixture.detectChanges();
    return {
      fixture,
      page: fixture.nativeElement as HTMLElement,
      component: fixture.componentInstance as unknown as ArchivedDocumentsHarness,
    };
  }

  function expectReadOnly(page: HTMLElement): void {
    expect(page.textContent).toContain('Archived — Read-only');
    expect(page.querySelector('app-google-docs-editor')).toBeNull();
    for (const frame of page.querySelectorAll('iframe')) {
      expect(frame.closest('app-archived-document-viewer')).not.toBeNull();
      expect(new URL(frame.src).pathname).toMatch(/\/preview$/);
      expect(frame.src).not.toContain('/edit');
    }
    expect(page.querySelector('#google-session')).toBeNull();
    expect(page.querySelector('#editor-mode')).toBeNull();
    expect(page.querySelector('form')).toBeNull();
    expect(page.querySelector('input[type="file"]')).toBeNull();
    expect(
      page.querySelector('a[href*="docs.google.com"], a[href*="drive.google.com"]'),
    ).toBeNull();
    expect(
      Array.from(page.querySelectorAll('button')).some((b) => b.textContent?.trim() === 'Remove'),
    ).toBe(false);
  }

  it('keeps the existing editor and session controls for active workspaces', () => {
    TestBed.inject(DocumentWorkspaceService).add('ws-product', 'Active notes', FILE_ID);
    const { page } = createPage();
    expect(page.querySelector('iframe')?.src).toContain(
      `/document/d/${FILE_ID}/edit?embedded=true`,
    );
    expect(page.querySelector('#google-session')).not.toBeNull();
    expect(page.querySelector('#editor-mode')).not.toBeNull();
    expect(page.querySelector('form')).not.toBeNull();
    expect(page.querySelector('input[type="file"]')).not.toBeNull();
  });

  it('keeps archived documents selectable with previews and details for both Docs and DOCX', () => {
    const service = TestBed.inject(DocumentWorkspaceService);
    service.add('ws-launch', 'Native notes', FILE_ID);
    service.addUploadedDocx('ws-launch', {
      id: 'ZyXwVuTsRqPoNmLkJiHgFeDcBa0987654321_-',
      name: 'Word notes.docx',
      mimeType: DOCX_MIME_TYPE,
    });
    params.next(convertToParamMap({ workspaceId: 'ws-launch' }));
    const { fixture, page } = createPage();
    expectReadOnly(page);
    expect(page.querySelector('app-archived-document-viewer')).not.toBeNull();
    expect(page.querySelector('iframe')?.src).toBe(
      'https://drive.google.com/file/d/ZyXwVuTsRqPoNmLkJiHgFeDcBa0987654321_-/preview',
    );
    expect(page.querySelector('#document-library-heading')).not.toBeNull();
    expect(page.querySelector('#archived-document-heading')?.textContent).toContain('Word notes');
    const buttons = page.querySelectorAll<HTMLButtonElement>(
      'ul[aria-label="Registered Google documents"] button',
    );
    expect(buttons).toHaveLength(2);
    expect(buttons[1].textContent).toContain('View document');
    buttons[1].click();
    fixture.detectChanges();
    expect(page.querySelector('#archived-document-heading')?.textContent).toContain('Native notes');
    expect(page.querySelector('iframe')?.src).toBe(
      `https://docs.google.com/document/d/${FILE_ID}/preview`,
    );
    expectReadOnly(page);
    expect(window.matchMedia).not.toHaveBeenCalled();
  });

  it('blocks add, upload, and remove handlers even when invoked directly', async () => {
    const service = TestBed.inject(DocumentWorkspaceService);
    const existing = service.add('ws-launch', 'Archived notes', FILE_ID);
    params.next(convertToParamMap({ workspaceId: 'ws-launch' }));
    const { component } = createPage();
    component.form.setValue({
      title: 'Attempted addition',
      url: 'https://docs.google.com/document/d/ZyXwVuTsRqPoNmLkJiHgFeDcBa0987654321_-/edit',
    });
    component.addDocument();
    component.uploadFile.set(new File(['content'], 'attempt.docx', { type: DOCX_MIME_TYPE }));
    await component.uploadDocx();
    component.removeDocument(existing);
    expect(service.documentsFor('ws-launch')()).toEqual([existing]);
    expect(uploadDocx).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it('unmounts on active-to-archived navigation and restores editing on return', () => {
    const service = TestBed.inject(DocumentWorkspaceService);
    service.add('ws-product', 'Active notes', FILE_ID);
    service.add('ws-launch', 'Archived notes', FILE_ID);
    const { fixture, page } = createPage();
    const activeFrame = page.querySelector('iframe');
    expect(activeFrame).not.toBeNull();
    params.next(convertToParamMap({ workspaceId: 'ws-launch' }));
    fixture.detectChanges();
    expectReadOnly(page);
    expect(activeFrame?.isConnected).toBe(false);
    expect(removeMediaListener).toHaveBeenCalled();
    params.next(convertToParamMap({ workspaceId: 'ws-product' }));
    fixture.detectChanges();
    expect(page.querySelector('app-google-docs-editor')).not.toBeNull();
    expect(page.querySelector('iframe')).not.toBeNull();
    expect(page.querySelector('#archived-document-heading')).toBeNull();
  });

  it('reacts to the actual workspace becoming archived while the page stays mounted', () => {
    TestBed.inject(DocumentWorkspaceService).add('ws-product', 'Selected notes', FILE_ID);
    const { fixture, page, component } = createPage();
    const selection = component.selectedDocument();
    expect(page.querySelector('iframe')).not.toBeNull();
    TestBed.inject(WorkspaceService).archive('ws-product');
    fixture.detectChanges();
    expectReadOnly(page);
    expect(component.selectedDocument()).toBe(selection);
    expect(page.querySelector('#archived-document-heading')?.textContent).toContain(
      'Selected notes',
    );
  });

  it.each([true, false])(
    'blocks an upload completed after archiving (render first: %s)',
    async (renderFirst) => {
      let finish!: (metadata: unknown) => void;
      uploadDocx.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      const { fixture, page, component } = createPage();
      component.uploadFile.set(new File(['content'], 'pending.docx', { type: DOCX_MIME_TYPE }));
      const pending = component.uploadDocx();
      const abortSignal = uploadDocx.mock.calls[0][2] as AbortSignal;
      TestBed.inject(WorkspaceService).archive('ws-product');
      if (renderFirst) fixture.detectChanges();
      finish({ id: FILE_ID, name: 'pending.docx', mimeType: DOCX_MIME_TYPE });
      await pending;
      fixture.detectChanges();
      expect(abortSignal.aborted).toBe(true);
      expectReadOnly(page);
      expect(component.uploading()).toBe(false);
      expect(component.statusMessage()).toContain('Workspace archived.');
      expect(component.statusMessage()).toContain('may already have received the file');
      expect(TestBed.inject(DocumentWorkspaceService).documentsFor('ws-product')()).toEqual([]);
    },
  );

  it('keeps archived mode closed after resizing from a desktop editor', () => {
    TestBed.inject(DocumentWorkspaceService).add('ws-product', 'Notes', FILE_ID);
    const { fixture, page } = createPage();
    const listener = onMediaChange!;
    TestBed.inject(WorkspaceService).archive('ws-product');
    fixture.detectChanges();
    listener({ matches: false } as MediaQueryListEvent);
    listener({ matches: true } as MediaQueryListEvent);
    fixture.detectChanges();
    expectReadOnly(page);
  });

  it.each([
    'https://evil.example/preview',
    'javascript:alert(1)',
    'https://docs.google.com/document/d/' + FILE_ID + '/edit',
  ])('ignores saved fallback destinations when constructing archived previews: %s', (savedUrl) => {
    localStorage.setItem(
      'taskpulse.documents.v1.ws-launch',
      JSON.stringify([
        {
          id: 'saved',
          workspaceId: 'ws-launch',
          title: 'Saved DOCX',
          googleDocumentId: FILE_ID,
          sourceType: 'google-drive-upload',
          fileMimeType: DOCX_MIME_TYPE,
          googleDriveWebViewLink: savedUrl,
          addedAt: '2026-11-05T00:00:00.000Z',
        },
      ]),
    );
    params.next(convertToParamMap({ workspaceId: 'ws-launch' }));
    const { page } = createPage();
    expectReadOnly(page);
    expect(page.querySelector('iframe')?.src).toBe(
      `https://drive.google.com/file/d/${FILE_ID}/preview`,
    );
    expect(page.querySelector('#archived-document-heading')?.textContent).toContain('Saved DOCX');
  });
});
