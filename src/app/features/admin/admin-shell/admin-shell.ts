import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
    selector: 'app-admin-shell',
    imports: [RouterLink, RouterLinkActive, RouterOutlet],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateURL: './admin-shell.html',
})
export class AdminShell {
    protected readonly tabs = [{ label: 'Dashboard', path: '/admin' }];
}