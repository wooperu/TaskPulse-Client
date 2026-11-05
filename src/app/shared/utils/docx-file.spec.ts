import { DOCX_MIME_TYPE, MAX_DOCX_UPLOAD_BYTES } from '../../core/config/google-drive.config';
import { validateDocxFile } from './docx-file';

function docx(name = 'notes.docx', size = 4): File {
  return new File([new Uint8Array(size)], name, { type: DOCX_MIME_TYPE });
}

describe('DOCX file validation', () => {
  it('accepts a DOCX file within the upload limit', () => {
    expect(validateDocxFile(docx())).toBeNull();
  });

  it('rejects unsupported extensions and MIME types', () => {
    expect(validateDocxFile(docx('notes.pdf'))).toBe('extension');
    expect(validateDocxFile(new File(['content'], 'notes.docx', { type: 'application/pdf' }))).toBe(
      'mime-type',
    );
  });

  it('enforces the configured 10 MB limit', () => {
    expect(validateDocxFile(docx('large.docx', MAX_DOCX_UPLOAD_BYTES + 1))).toBe('too-large');
  });
});
