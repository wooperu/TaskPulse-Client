import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminUserService } from '../../../core/services/admin-user.service';
import { AdminUser, USER_ROLE_LABELS } from '../../../shared/models/admin-user.model';
import { UserRole } from '../../../shared/models/current-user.model';
import { emailValidators } from '../../../shared/validators/email';

type FormMode = { kind: 'create' } | { kind: 'edit'; id: string };

@Component({
    selector: 'app-admin-users',
    imports: [DatePipe, ReactiveFormsModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './admin-users.html',
})
export class AdminUsers {
    private readonly userService = inject(AdminUserService);

    protected readonly isSampleData = this.userService.isSampleData;
    protected readonly roleLabels = USER_ROLE_LABELS;
    protected readonly roles: UserRole[] = ['admin', 'manager', 'employee'];

    protected readonly search = signal('');
    protected readonly roleFilter = signal<'all' | UserRole>('all');
    protected readonly statusFilter = signal<'all' | 'active' | 'inactive'>('all');
    protected readonly mode = signal<FormMode | null>(null);
    protected readonly confirmingId = signal<string | null>(null);
    protected readonly statusMessage = signal('');
    protected readonly formError = signal('');

    protected readonly form = new FormGroup({
        firstName: new FormControl('', { nonNullable: true, validators:[Validators.required, Validators.maxLength(100)] }),
        lastName: new FormControl('', { nonNullable: true, validators:[Validators.required, Validators.maxLength(100)] }),
        email: new FormControl('', { nonNullable: true, validators: emailValidators() }),
        role: new FormControl<UserRole>('employee', { nonNullable: true }),
    });

    protected readonly rows = computed(() => {
        const term = this.search().trim().toLowerCase();
        const role = this.roleFilter();
        const status = this.statusFilter();

        return this.userService
            .users()
            .filter((user) => role === 'all' || user.role === role)
            .filter((user) => status === 'all' || (status === 'active') === user.isActive)
            .filter(
                (user) => 
                    !term ||
                    `${user.firstName} ${user.lastName}` .toLowerCase().includes(term) ||
                    user.email.toLowerCase().includes(term),
            )
            .map((user) => ({ user, isMe: user.id === this.userService.currentUserId }));
    });

    protected readonly total = computed(() => this.userService.users().length);
    
    protected onSearch(event: Event): void {
        this.search.set((event.target as HTMLInputElement).value);
    }

    protected onRoleFilter(event: Event): void {
        this.roleFilter.set((event.target as HTMLSelectElement).value as 'all' | UserRole);
    }

    protected onStatusFilter(event: Event): void {
        this.statusFilter.set((event.target as HTMLSelectElement).value as 'all' | 'active' | 'inactive');
    }

    protected openCreate(): void {
        this.reset();
        this.form.reset({ firstName: '', lastName: '', email: '', role: 'employee' });
        this.mode.set({ kind: 'create' });
    }

    protected openEdit(user: AdminUser): void {
        this.reset();
        this.form.reset({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
        });
        this.mode.set({ kind: 'edit', id: user.id });
    }

    protected closeForm(): void {
        this.mode.set(null);
        this.formError.set('');
    }

    protected fieldError(name: 'firstName' | 'lastName' | 'email'): string | null {
        const control = this.form.controls[name];
        if (!control.touched) return null;
        if (control.hasError('required')) {
            return name === 'email' ? 'Email is required.' : `${name === 'firstName' ? 'First' : 'Last'} name is required.`;
        }
        if (control.hasError('email')) return 'Enter a valid email address.';
        if (control.hasError('emailDomain')) return 'Enter an email address with a domain such as gmail.com';
        if (control.hasError('maxlength')) return 'That is too long.';
        return null;
    }

    protected submit(): void {
        this.statusMessage.set('');
        this.formError.set('');
        this.form.markAllAsTouched();

        const mode = this.mode();
        if (this.form.invalid || !mode) return;

        const value = this.form.getRawValue();
        const result = 
            mode.kind === 'create'
            ? this.userService.create(value)
            : this.userService.update(mode.id, value);

        if (!result.ok) {
            this.formError.set(result.reason);
            return;
        }

        const name = `${value.firstName.trim()} ${value.lastName.trim()}`;
        this.statusMessage.set(
            mode.kind === 'create'
                ? `${name} was created.` // sample data, remove when reload
                : `${name} was updated.`
        );
        this.closeForm();
    }

    protected onRoleChange(user: AdminUser, event: Event): void {
        this.reset();
        const select = event.target as HTMLSelectElement;
        const role = select.value as UserRole;
        const result = this.userService.changeRole(user.id, role);

        if (!result.ok) select.value = user.role;
        this.statusMessage.set(
            result.ok ? `${user.firstName} ${user.lastName} is now ${this.roleLabels[role]}.` : result.reason, 
        );
    }

    protected askToDeactivate(id: string): void {
        this.statusMessage.set('');
        this.confirmingId.set(id);
    }

    protected cancelConfirm(): void {
        this.confirmingId.set(null);
    }

    protected deactivate(user: AdminUser): void {
        const result = this.userService.setActive(user.id, false);
        this.confirmingId.set(null);
        this.statusMessage.set(
            result.ok ? `${user.firstName} ${user.lastName} was deactivated.` : result.reason,
        );
    }

        protected reactivate(user: AdminUser): void {
        this.reset();
        const result = this.userService.setActive(user.id, true);
        this.statusMessage.set(
            result.ok ? `${user.firstName} ${user.lastName} was reactivated.` : result.reason,
        );
    }

    private reset(): void {
        this.statusMessage.set('');
        this.confirmingId.set(null);
    }
}