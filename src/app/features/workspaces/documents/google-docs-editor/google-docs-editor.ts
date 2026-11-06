import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { WorkspaceDocument } from '../../../../shared/models/workspace-document.model';
import {
  buildGoogleDocsEditorUrls,
  GoogleDocsEditorMode,
  GoogleDocsSession,
} from '../../../../shared/utils/google-docs-url';

// Input capability keeps typical wide landscape phones out without device fingerprinting.
// This is a UI policy, not a Google document permission boundary.
const DESKTOP_MEDIA_QUERY = '(min-width: 768px) and (any-hover: hover) and (any-pointer: fine)';

@Component({
  selector: 'app-google-docs-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './google-docs-editor.css',
  templateUrl: './google-docs-editor.html',
})
export class GoogleDocsEditor {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly desktopQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
  private readonly editorFrame = viewChild<ElementRef<HTMLIFrameElement>>('editorFrame');
  private readonly reloadVersion = signal(0);

  readonly document = input.required<WorkspaceDocument>();

  protected readonly isDesktop = signal(this.desktopQuery.matches);
  protected readonly session = signal<GoogleDocsSession>('automatic');
  protected readonly mode = signal<GoogleDocsEditorMode>('embedded');

  protected readonly urls = computed(() => {
    this.reloadVersion();
    return buildGoogleDocsEditorUrls(this.document().googleDocumentId, this.session(), this.mode());
  });

  protected readonly trustedEditorUrl = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.urls().editor),
  );

  constructor() {
    const onDesktopChange = (event: MediaQueryListEvent): void => {
      this.isDesktop.set(event.matches);
    };

    this.desktopQuery.addEventListener('change', onDesktopChange);
    this.destroyRef.onDestroy(() => {
      this.desktopQuery.removeEventListener('change', onDesktopChange);
      const iframe = this.editorFrame()?.nativeElement;
      if (iframe) iframe.src = 'about:blank';
    });
  }

  protected changeSession(event: Event): void {
    this.session.set((event.target as HTMLSelectElement).value as GoogleDocsSession);
  }

  protected changeMode(event: Event): void {
    this.mode.set((event.target as HTMLSelectElement).value as GoogleDocsEditorMode);
  }

  protected reload(): void {
    this.reloadVersion.update((version) => version + 1);
  }
}
