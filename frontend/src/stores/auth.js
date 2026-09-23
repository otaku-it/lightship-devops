import { defineStore } from 'pinia';
import { api } from '../api/client';
export const useAuthStore = defineStore('auth', {
    state: () => ({
        token: localStorage.getItem('lightship_token') || '',
        displayName: localStorage.getItem('lightship_display_name') || '管理员',
        role: localStorage.getItem('lightship_role') || 'admin',
    }),
    getters: {
        loggedIn: (state) => Boolean(state.token),
    },
    actions: {
        async login(username, password) {
            const { data } = await api.post('/auth/login', { username, password });
            this.token = data.access_token;
            this.displayName = data.display_name;
            this.role = data.role;
            localStorage.setItem('lightship_token', this.token);
            localStorage.setItem('lightship_display_name', this.displayName);
            localStorage.setItem('lightship_role', this.role);
        },
        async syncMe() {
            if (!this.token)
                return;
            const { data } = await api.get('/auth/me');
            this.displayName = data.display_name;
            this.role = data.role;
            localStorage.setItem('lightship_display_name', this.displayName);
            localStorage.setItem('lightship_role', this.role);
        },
        logout() {
            this.token = '';
            localStorage.removeItem('lightship_token');
            location.href = '/login';
        },
    },
});
