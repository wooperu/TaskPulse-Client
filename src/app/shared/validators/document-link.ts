import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Frontend copy of the backend DocumentLink host allow-list (as of backend
 * commit 38a9f41). Drive file paths are checked here; the backend also applies other per-host path rules (for example
 * Google links must be documents, spreadsheets or presentations, and GitHub
 * links need owner/repo); only the backend enforces those. Keep this list in
 * sync with the backend and confirm any change with the backend team.
 */
const ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  'docs.google.com',
  'word.cloud.microsoft',
  'excel.cloud.microsoft',
  'powerpoint.cloud.microsoft',
  'word.office.com',
  'excel.office.com',
  'powerpoint.office.com',
  'office.com',
  'microsoft365.com',
  '1drv.ms',
  'github.com',
]);

/** Optional field: empty is valid. Error values: 'invalid' | 'https' | 'host'. */
export function documentUrlValidator(control: AbstractControl): ValidationErrors | null {
  const raw = typeof control.value === 'string' ? control.value.trim() : '';

  if (!raw) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { documentUrl: 'invalid' };
  }

  if (url.protocol !== 'https:') {
    return { documentUrl: 'https' };
  }

  if (url.username || url.password || url.port) {
    return { documentUrl: 'invalid' };
  }

  // The multi-document backend also permits Drive file links. Do not accept folders/site pages.
  if (url.hostname === 'drive.google.com') {
    return /^\/file\/d\/[A-Za-z0-9_-]+(?:\/(?:view|edit|preview))?\/?$/.test(url.pathname)
      ? null
      : { documentUrl: 'invalid' };
  }

  return ALLOWED_HOSTS.has(url.hostname.toLowerCase()) ? null : { documentUrl: 'host' };
}

/** Group validator for { url, label }: the backend needs both or neither. */
export function documentLinkGroupValidator(group: AbstractControl): ValidationErrors | null {
  const url = String(group.get('url')?.value ?? '').trim();
  const label = String(group.get('label')?.value ?? '').trim();

  if (url && !label) return { documentLabelRequired: true };
  if (label && !url) return { documentUrlRequired: true };
  return null;
}
