// Delete once the back-end is finished
import { AdminUser } from '../../shared/models/admin-user.model';

export const MOCK_ADMIN_USERS: readonly AdminUser[] = [
    { id: 'user-me', firstName: 'Kurt', lastName: 'Basilio', email: 'kurtbasiliojakolero123@gmail.com', role: 'admin', isActive: true, isEmailVerified: true, createdAt: '2026-01-12T08:00:00Z' },
    { id: 'u2', firstName: 'Gabriel Cyrist', lastName: 'Lacsina', email: 'lacsinaacunity@gmail.com', role: 'admin', isActive: true, isEmailVerified: true, createdAt: '2026-01-15T08:00:00Z' },
    { id: 'u3', firstName: 'Shammel', lastName: 'Sese', email: 'shammeltheyearner13@gmail.com', role: 'manager', isActive: true, isEmailVerified: true, createdAt: '2026-02-03T08:00:00Z' },
    { id: 'u4', firstName: 'Super', lastName: 'Creek', email: 'googoobaby@gmail.com', role: 'manager', isActive: true, isEmailVerified: false, createdAt: '2026-03-21T08:00:00Z' },
    { id: 'u5', firstName: 'Daiwa', lastName: 'Scarlett', email: 'shegotallthat@gmail.com', role: 'employee', isActive: false, isEmailVerified: true, createdAt: '2026-03-28T08:00:00Z' },
    { id: 'u6', firstName: 'Aston', lastName: 'Machan', email: 'astonmartin@gmail.com', role: 'employee', isActive: true, isEmailVerified: true, createdAt: '2026-05-09T08:00:00Z' },
    { id: 'u7', firstName: 'Mejiro', lastName: 'Ramonu', email: 'plscomehomewithfreepulls@gmail.com', role: 'employee', isActive: true, isEmailVerified: true, createdAt: '2026-06-17T08:00:00Z' },
    { id: 'u8', firstName: 'Rice', lastName: 'Shower', email: 'fixurmood@gmail.com', role: 'employee', isActive: true, isEmailVerified: false, createdAt: '2026-10-30T08:00:00Z' },
];