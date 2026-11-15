import {
  buildGoogleDocsEditorUrls,
  extractGoogleDocumentId,
  GoogleDocsUrlValidationError,
} from './google-docs-url';

const DOCUMENT_ID = 'AbCdEfGhIjKlMnOpQrStUvWxYz1234567890_-';

describe('Google Docs URL utilities', () => {
  it('extracts an ID from a normal document URL', () => {
    expect(
      extractGoogleDocumentId(`https://docs.google.com/document/d/${DOCUMENT_ID}/edit?tab=t.0`),
    ).toBe(DOCUMENT_ID);
  });

  it('extracts an ID from a session-specific document URL', () => {
    expect(
      extractGoogleDocumentId(`https://docs.google.com/document/u/3/d/${DOCUMENT_ID}/edit`),
    ).toBe(DOCUMENT_ID);
  });

  it.each([
    ['http://docs.google.com/document/d/' + DOCUMENT_ID + '/edit', 'https'],
    ['https://evil.example/document/d/' + DOCUMENT_ID + '/edit', 'host'],
    ['https://docs.google.com/spreadsheets/d/' + DOCUMENT_ID + '/edit', 'path'],
  ])('rejects unsupported URL %s', (url, reason) => {
    expect(() => extractGoogleDocumentId(url)).toThrowError(GoogleDocsUrlValidationError);
    try {
      extractGoogleDocumentId(url);
    } catch (error) {
      expect((error as GoogleDocsUrlValidationError).reason).toBe(reason);
    }
  });

  it('builds the default embedded editor URL', () => {
    expect(buildGoogleDocsEditorUrls(DOCUMENT_ID, 'automatic', 'embedded')).toEqual({
      direct: `https://docs.google.com/document/d/${DOCUMENT_ID}/edit`,
      editor: `https://docs.google.com/document/d/${DOCUMENT_ID}/edit?embedded=true`,
    });
  });

  it('builds a session-specific normal editor URL', () => {
    expect(buildGoogleDocsEditorUrls(DOCUMENT_ID, '1', 'normal')).toEqual({
      direct: `https://docs.google.com/document/u/1/d/${DOCUMENT_ID}/edit`,
      editor: `https://docs.google.com/document/u/1/d/${DOCUMENT_ID}/edit`,
    });
  });
});
