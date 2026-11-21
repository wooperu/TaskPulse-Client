import { taskDocumentLink } from './task-document-link';

describe('Task document provider boundary', () => {
  it('derives the canonical original from native Docs while preserving ID casing', () => {
    expect(
      taskDocumentLink(
        'https://docs.google.com/document/u/1/d/AbCdEfGhIjKl/edit?authuser=1#heading=h.x',
      ),
    ).toEqual({
      provider: 'Google Docs',
      canonical: 'https://docs.google.com/document/d/AbCdEfGhIjKl/edit#heading=h.x',
      original: 'https://docs.google.com/document/d/AbCdEfGhIjKl/edit#heading=h.x',
      googleDocumentId: 'AbCdEfGhIjKl',
    });
  });
  it('separates metadata preservation from the canonical edit action', () => {
    const link = taskDocumentLink(
      'https://docs.google.com/document/u/2/d/AbCdEfGhIjKl/view?authuser=2&resourcekey=synthetic&tab=t.1#heading=h.notes',
    )!;
    expect(link.canonical).toBe(
      'https://docs.google.com/document/d/AbCdEfGhIjKl/view?resourcekey=synthetic&tab=t.1#heading=h.notes',
    );
    expect(link.original).toBe(
      'https://docs.google.com/document/d/AbCdEfGhIjKl/edit?resourcekey=synthetic&tab=t.1#heading=h.notes',
    );
  });
  it('does not change a Sheets view link into an edit link', () => {
    const raw = 'https://docs.google.com/spreadsheets/d/AbCdEfGhIjKl/view?tab=t.1#gid=42';
    expect(taskDocumentLink(raw)).toMatchObject({ canonical: raw, original: raw });
  });
  it('removes repeated and encoded session selectors on Drive links without guessing their file type', () => {
    const link = taskDocumentLink(
      'https://drive.google.com/file/d/AbCdEfGhIjKl/view?authuser=1&AUTHUSER=2&%61uthuser=3&resourcekey=synthetic#authuser=1&heading=x',
    )!;
    expect(link.original.toLowerCase()).not.toContain('authuser');
    expect(link.original).toContain('resourcekey=synthetic');
    expect(link.original).toContain('AbCdEfGhIjKl');
    expect(link.googleDocumentId).toBeUndefined();
  });
  it.each([
    'javascript:alert(1)',
    'http://docs.google.com/document/d/AbCdEfGhIjKl/edit',
    'https://docs.google.com.evil.test/document/d/AbCdEfGhIjKl/edit',
    'https://user:password@docs.google.com/document/d/AbCdEfGhIjKl/edit',
    'https://docs.google.com:8080/document/d/AbCdEfGhIjKl/edit',
    'https://docs.google.com/document/d/AbCdEfGhIjKl/edit#access_token=synthetic',
    'https://docs.google.com/document/d/AbCdEfGhIjKl/edit?%69d_token=synthetic',
    'https://drive.google.com/folders/AbCdEfGhIjKl',
    'https://github.com/settings/profile',
    'https://office.com/',
    'not a URL',
  ])('blocks unsafe or unsupported input: %s', (url) => expect(taskDocumentLink(url)).toBeNull());
  it.each([
    ['https://drive.google.com/file/d/AbCdEfGhIjKl/view', 'Google Drive file (type unverified)'],
    ['https://docs.google.com/spreadsheets/u/1/d/AbCdEfGhIjKl/edit?authuser=1', 'Google Sheets'],
    ['https://docs.google.com/presentation/d/AbCdEfGhIjKl/edit', 'Google Slides'],
    ['https://word.cloud.microsoft/open/AbCdEfGhIjKl', 'Microsoft Office'],
    ['https://1drv.ms/w/AbCdEfGhIjKl', 'OneDrive'],
    ['https://github.com/example/repository/blob/main/Readme.md', 'GitHub'],
  ])('never fabricates a Docs document from another provider: %s', (url, provider) => {
    const target = taskDocumentLink(url)!;
    expect(target.provider).toBe(provider);
    expect(target.googleDocumentId).toBeUndefined();
    expect(target.original).not.toContain('/u/1/');
    expect(target.original).not.toContain('authuser');
  });
});
