    import { DatePipe } from '@angular/common';
    import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
    import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
    import { AdminTeamService } from '../../../core/services/admin-team.service';
    import { AdminUserService } from '../../../core/services/admin-user.service';
    import { AdminTeam } from '../../../shared/models/admin-team.model';

    type FormMode = { kind: 'create' } | { kind: 'edit'; id: string };

    @Component({
    selector: 'app-admin-teams',
    imports: [DatePipe, ReactiveFormsModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './admin-teams.html',
    })
    export class AdminTeams {
    private readonly teamService = inject(AdminTeamService);
    private readonly userService = inject(AdminUserService);

    protected readonly isSampleData = this.teamService.isSampleData;

    protected readonly search = signal('');
    protected readonly mode = signal<FormMode | null>(null);
    protected readonly statusMessage = signal('');
    protected readonly formError = signal('');

    protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    /** Empty string means "no manager yet". */
    managerId: new FormControl('', { nonNullable: true }),
    });

    /** Only active users with the Manager role can lead a team. */
    protected readonly eligibleManagers = computed(() =>
    this.userService.users().filter((user) => user.isActive && user.role === 'manager'),
    );

    protected readonly rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    const users = this.userService.users();
    const eligible = this.eligibleManagers();

    return this.teamService
        .teams()
        .filter(
        (team) =>
            !term ||
            team.name.toLowerCase().includes(term) ||
            team.description.toLowerCase().includes(term),
        )
        .map((team) => {
        const manager = eligible.find((user) => user.id === team.managerId) ?? null;
        // Set, but the user was since deactivated or no longer a manager.
        const managerInvalid =
            team.managerId !== null && manager === null && users.some((u) => u.id === team.managerId);
        return { team, manager, managerInvalid };
        });
    });

    protected readonly total = computed(() => this.teamService.teams().length);
    protected readonly unassigned = computed(
    () => this.rows().filter((row) => row.manager === null).length,
    );

    protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    }

    protected openCreate(): void {
    this.statusMessage.set('');
    this.formError.set('');
    this.form.reset({ name: '', description: '', managerId: '' });
    this.mode.set({ kind: 'create' });
    }

    protected openEdit(team: AdminTeam): void {
    this.statusMessage.set('');
    this.formError.set('');
    this.form.reset({
        name: team.name,
        description: team.description,
        managerId: team.managerId ?? '',
    });
    this.mode.set({ kind: 'edit', id: team.id });
    }

    protected closeForm(): void {
    this.mode.set(null);
    this.formError.set('');
    }

    protected nameError(): string | null {
    const control = this.form.controls.name;
    if (!control.touched) return null;
    if (control.hasError('required')) return 'Team name is required.';
    if (control.hasError('maxlength')) return 'Team name must be 100 characters or fewer.';
    return null;
    }

    protected descriptionError(): string | null {
    const control = this.form.controls.description;
    if (!control.touched) return null;
    if (control.hasError('maxlength')) return 'Description must be 500 characters or fewer.';
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
        ? this.teamService.create({
            name: value.name,
            description: value.description,
            managerId: value.managerId || null,
            })
        : this.teamService.update(mode.id, { name: value.name, description: value.description });

    if (!result.ok) {
        this.formError.set(result.reason);
        return;
    }

    const name = value.name.trim();
    this.statusMessage.set(mode.kind === 'create' ? `${name} was created.` : `${name} was updated.`);
    this.closeForm();
    }

    protected onManagerChange(team: AdminTeam, event: Event): void {
    this.statusMessage.set('');
    const select = event.target as HTMLSelectElement;
    const managerId = select.value || null;
    const result = this.teamService.assignManager(team.id, managerId);

    if (!result.ok) {
        select.value = team.managerId ?? '';
        this.statusMessage.set(result.reason);
        return;
    }

    const manager = this.eligibleManagers().find((user) => user.id === managerId);
    this.statusMessage.set(
        manager
        ? `${manager.firstName} ${manager.lastName} now manages ${team.name}.`
        : `${team.name} no longer has a manager.`,
    );
    }
    }