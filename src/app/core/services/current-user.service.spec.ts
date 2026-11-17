import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiUrl } from '../config/api.config';
import { CurrentUserService } from './current-user.service';

const USER = {
  id: 'u-1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  role: 'Employee',
  isEmailVerified: true,
};

describe('CurrentUserService', () => {
  let http: HttpTestingController;
  let service: CurrentUserService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(CurrentUserService);
  });

  const tick = () => new Promise<void>((resolve) => setTimeout(resolve));

  async function signIn(): Promise<void> {
    const loading = service.load();
    await tick();
    http.expectOne(apiUrl('/api/users/get-user')).flush(USER);
    await loading;
  }

  it('loads the signed-in user and maps the role', async () => {
    await signIn();

    expect(service.user()).toMatchObject({ id: 'u-1', firstName: 'Ada', role: 'employee' });
    expect(service.isSignedIn()).toBe(true);
  });

  it('saves the profile and then shows what the API returned', async () => {
    await signIn();

    const saving = service.updateProfile('  Augusta ', ' King ');
    await tick();
    const request = http.expectOne(apiUrl('/api/users/update-profile'));
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ firstName: 'Augusta', lastName: 'King' });

    // The name must not change before the API has confirmed it.
    expect(service.user().firstName).toBe('Ada');
    request.flush({ ...USER, firstName: 'Augusta', lastName: 'King' });

    const result = await saving;
    expect(result.ok).toBe(true);
    expect(service.user()).toMatchObject({ firstName: 'Augusta', lastName: 'King' });
  });

  it('leaves the user unchanged when saving the profile fails', async () => {
    await signIn();

    const saving = service.updateProfile('Augusta', 'King');
    await tick();
    http.expectOne(apiUrl('/api/users/update-profile')).flush(
      { title: 'One or more validation errors occurred.', errors: { FirstName: ['First name is required.'] } },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(await saving).toMatchObject({ ok: false, error: { kind: 'validation', message: 'First name is required.' } });
    expect(service.user().firstName).toBe('Ada');
  });
});
