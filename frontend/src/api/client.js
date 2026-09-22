import axios from 'axios';
export const api = axios.create({
    baseURL: '/api/v1',
    timeout: 15000,
});
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('lightship_token');
    if (token)
        config.headers.Authorization = `Bearer ${token}`;
    return config;
});
api.interceptors.response.use((response) => response, (error) => {
    if (error.response?.status === 401 && !location.pathname.includes('/login')) {
        localStorage.removeItem('lightship_token');
        location.href = '/login';
    }
    return Promise.reject(error);
});
