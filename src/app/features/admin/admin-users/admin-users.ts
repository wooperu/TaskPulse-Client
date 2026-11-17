import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { AdminUserService } from '../../../core/services/admin-user.service';
import { USER_ROLE_LABELS } from '../../../shared/models/admin-user.model';
import { UserRole } from '../../../shared/models/current-user.model';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The API addresses users by id (a GUID). Ignores spaces so a pasted id with a trailing space still works. */
function userIdValidator(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value ?? '').trim();

    if (value === '') return { required: true };

    return GUID.test(value) ? null : { guid: true };
}

@Component({
    selector: 'app-admin-users',
    imports: [ReactiveFormsModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './admin-users.html',
})
export class AdminUsers {
    private readonly userService = inject(AdminUserService);

    protected readonly roleLabels = USER_ROLE_LABELS;
    protected readonly roles: UserRole[] = ['admin', 'manager', 'employee'];

    protected readonly busy = signal(false);
    protected readonly statusMessage = signal('');
    protected readonly formError = signal('');

    protected readonly form = new FormGroup({
        userId: new FormControl('', { nonNullable: true, validators: [userIdValidator] }),
        role: new FormControl<UserRole>('employee', { nonNullable: true }),
    });

    protected userIdError(): string | null {
        const control = this.form.controls.userId;

        if (!control.touched) return null;
        if (control.hasError('required')) return 'User ID is required.';
        if (control.hasError('guid')) return 'Enter a valid user ID, for example 3f2b8c1e-9a4d-4e7b-8c55-0d1f6a2b7e90.';

        return null;
    }

    protected async submit(): Promise<void> {
        if (this.busy()) return;

        this.statusMessage.set('');
        this.formError.set('');
        this.form.markAllAsTouched();

        if (this.form.invalid) return;

        const { userId, role } = this.form.getRawValue();
        const id = userId.trim();

        // The API allows it, but changing your own role can leave the system without an admin.
        if (id.toLowerCase() === this.userService.currentUserId.toLowerCase()) {
            this.formError.set('You cannot change your own role.');
            return;
        }

        this.busy.set(true);
        const result = await this.userService.changeRole(id, role);
        this.busy.set(false);

        if (!result.ok) {
            this.formError.set(result.error.message);
            return;
        }

        // Only said after the API confirmed it (204).
        this.statusMessage.set(`User ${id} is now ${this.roleLabels[role]}.`);
        this.form.controls.userId.reset('');
    }
}
