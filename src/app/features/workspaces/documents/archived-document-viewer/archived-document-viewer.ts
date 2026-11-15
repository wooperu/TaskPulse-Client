import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { WorkspaceDocument } from '../../../../shared/models/workspace-document.model';
import { buildGoogleDocumentPreviewUrl } from '../../../../shared/utils/google-document-preview-url';

export const PREVIEW_LOAD_TIMEOUT_MS = 20_000;
type PreviewState = 'loading' | 'frame-loaded' | 'failed' | 'timed-out' | 'details' | 'unsupported';

interface PreviewRequest {
  key: string;
  version: number;
  url: SafeResourceUrl;
}

@Component({
  selector: 'app-archived-document-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './archived-document-viewer.html',
})
export class ArchivedDocumentViewer {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly retryVersion = signal(0);
  private readonly detailsOnlyDocuments = new Set<string>();

  readonly document = input.required<WorkspaceDocument>();
  protected readonly state = signal<PreviewState>('loading');
  protected readonly request = computed<PreviewRequest | null>(() => {
    const document = this.document();
    const url = buildGoogleDocumentPreviewUrl(document);
    if (!url) return null;
    return {
      key: `${document.workspaceId}:${document.id}:${url}`,
      version: this.retryVersion(),
      // Only the fixed Google /preview URL builder can reach this trust boundary.
      url: this.sanitizer.bypassSecurityTrustResourceUrl(url),
    };
  });
  protected readonly frameVisible = computed(
    () =>
      this.request() !== null && (this.state() === 'loading' || this.state() === 'frame-loaded'),
  );

  constructor() {
    effect((onCleanup) => {
      const request = this.request();
      if (!request) {
        this.state.set('unsupported');
        return;
      }
      if (this.detailsOnlyDocuments.has(request.key)) {
        this.state.set('details');
        return;
      }
      this.state.set('loading');
      const timeout = window.setTimeout(() => {
        if (this.request() === request && this.state() === 'loading') {
          this.state.set('timed-out');
        }
      }, PREVIEW_LOAD_TIMEOUT_MS);
      onCleanup(() => window.clearTimeout(timeout));
    });
  }

  protected frameLoaded(request: PreviewRequest): void {
    if (this.request() === request && this.state() === 'loading') {
      // Cross-origin load events can also mean a Google sign-in/access/error page loaded.
      this.state.set('frame-loaded');
    }
  }

  protected frameFailed(request: PreviewRequest): void {
    if (this.request() === request && this.frameVisible()) this.state.set('failed');
  }

  protected useDetails(): void {
    const request = this.request();
    if (request) this.detailsOnlyDocuments.add(request.key);
    this.state.set('details');
  }

  protected retry(): void {
    const request = this.request();
    if (request) this.detailsOnlyDocuments.delete(request.key);
    this.retryVersion.update((version) => version + 1);
  }
}
