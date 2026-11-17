import { ApiLoginOutcome } from './api/login-audit.api';

export const LOGIN_OUTCOME_LABELS: Record<ApiLoginOutcome, string> = {
    Succeeded: 'Signed in',
    InvalidCredentials: 'Wrong email or password',
    EmailNotVerified: 'Email not verified',
};

export const LOGIN_OUTCOME_CHIP: Record<ApiLoginOutcome, string> = {
    Succeeded: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    InvalidCredentials: 'border-red-200 bg-red-50 text-red-800',
    EmailNotVerified: 'border-amber-200 bg-amber-50 text-amber-800',
};
