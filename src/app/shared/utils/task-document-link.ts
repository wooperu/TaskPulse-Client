import { FormControl } from '@angular/forms';
import { documentUrlValidator } from '../validators/document-link';
import { extractGoogleDocumentId, buildGoogleDocsEditorUrls } from './google-docs-url';

export interface TaskDocumentLink {
  provider: string;
  /** Validated metadata URL: preserve meaningful path/query/fragment during PATCH. */
  canonical: string;
  original: string;
  googleDocumentId?: string;
}

/** Fail closed on historical unsafe links. Only native Docs get a TaskPulse editor route. */
export function taskDocumentLink(raw: string): TaskDocumentLink | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (url.hostname === 'docs.google.com' || url.hostname === 'drive.google.com') {
      for (const params of [url.searchParams, new URLSearchParams(url.hash.slice(1))]) {
        if ([...params.keys()].some((key) => /^(access_token|refresh_token|id_token)$/i.test(key)))
          return null;
      }
      for (const key of [...url.searchParams.keys()])
        if (key.toLowerCase() === 'authuser') url.searchParams.delete(key);
      const fragment = new URLSearchParams(url.hash.slice(1));
      if ([...fragment.keys()].some((key) => key.toLowerCase() === 'authuser')) {
        for (const key of [...fragment.keys()])
          if (key.toLowerCase() === 'authuser') fragment.delete(key);
        url.hash = fragment.toString();
      }
      url.pathname = url.pathname.replace(
        /^\/(document|spreadsheets|presentation)\/u\/\d+\/d\//,
        '/$1/d/',
      );
    }
    if (url.hostname === 'docs.google.com') {
      try {
        const id = extractGoogleDocumentId(url.href);
        return {
          provider: 'Google Docs',
          canonical: url.href,
          original:
            buildGoogleDocsEditorUrls(id, 'automatic', 'normal').direct + url.search + url.hash,
          googleDocumentId: id,
        };
      } catch {
        const match = url.pathname.match(
          /^\/(spreadsheets|presentation)\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)(?:\/(?:edit|view|preview|copy))?\/?$/,
        );
        if (!match) return null;
        return {
          provider: match[1] === 'spreadsheets' ? 'Google Sheets' : 'Google Slides',
          canonical: url.href,
          original: url.href,
        };
      }
    }
    if (url.hostname === 'drive.google.com') {
      if (!/^\/file\/d\/[A-Za-z0-9_-]+(?:\/(?:view|edit|preview))?\/?$/.test(url.pathname))
        return null;
      return {
        provider: 'Google Drive file (type unverified)',
        canonical: url.href,
        original: url.href,
      };
    }
    if (documentUrlValidator(new FormControl(url.href)) || url.pathname.length <= 1) return null;
    if (url.hostname === 'github.com') {
      const segments = url.pathname.split('/').filter(Boolean);
      const reserved =
        /^(login|logout|signup|join|settings|explore|orgs|organizations|marketplace|features|notifications|sponsors|topics|pricing|search|new|apps|enterprise|collections|trending|about|security|codespaces|pulls|issues|dashboard)$/i;
      if (
        segments.length < 2 ||
        reserved.test(segments[0]) ||
        (segments.length > 2 &&
          !/^(blob|tree|issues|pull|pulls|wiki|discussions|releases|commit)$/i.test(segments[2]))
      )
        return null;
    }
    return {
      canonical: url.href,
      provider:
        url.hostname === 'github.com'
          ? 'GitHub'
          : url.hostname === '1drv.ms'
            ? 'OneDrive'
            : 'Microsoft Office',
      original: url.href,
    };
  } catch {
    return null;
  }
}
