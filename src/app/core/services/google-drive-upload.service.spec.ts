import { DOCX_MIME_TYPE } from '../config/google-drive.config';
import { GoogleDriveUploadError, GoogleDriveUploadService } from './google-drive-upload.service';

const FILE_ID = 'AbCdEfGhIjKlMnOpQrStUvWxYz1234567890_-';

describe('GoogleDriveUploadService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses a resumable upload and returns confirmed Drive metadata', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { Location: 'https://upload.example/session' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: FILE_ID,
            name: 'notes.docx',
            mimeType: DOCX_MIME_TYPE,
            webViewLink: `https://drive.google.com/file/d/${FILE_ID}/view`,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const service = new GoogleDriveUploadService();
    const file = new File(['content'], 'notes.docx', { type: DOCX_MIME_TYPE });
    await expect(service.uploadDocx(file, 'memory-only-token')).resolves.toEqual(
      expect.objectContaining({ id: FILE_ID, name: 'notes.docx' }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('uploadType=resumable');
    expect(fetchMock.mock.calls[1][0]).toBe('https://upload.example/session');
  });

  it('rejects a failed upload without returning file metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    const service = new GoogleDriveUploadService();
    const file = new File(['content'], 'notes.docx', { type: DOCX_MIME_TYPE });

    await expect(service.uploadDocx(file, 'memory-only-token')).rejects.toBeInstanceOf(
      GoogleDriveUploadError,
    );
  });

  it('does not retry an ambiguous final response and advises checking Drive', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { headers: { Location: 'https://upload.example/session' } }),
      )
      .mockRejectedValueOnce(new TypeError('Connection lost'));
    vi.stubGlobal('fetch', fetchMock);
    const service = new GoogleDriveUploadService();
    await expect(
      service.uploadDocx(new File(['data'], 'notes.docx'), 'memory-only-token'),
    ).rejects.toThrow('Check Drive before uploading again');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports cancellation without claiming that Drive deleted the file', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')));
    const service = new GoogleDriveUploadService();
    await expect(
      service.uploadDocx(new File(['data'], 'notes.docx'), 'memory-only-token'),
    ).rejects.toMatchObject({
      cancelled: true,
      message: expect.stringContaining('no Drive file was deleted'),
    });
  });
});
