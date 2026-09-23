import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import DashboardView from '../views/DashboardView.vue'
import EnvironmentsView from '../views/EnvironmentsView.vue'
import LoginView from '../views/LoginView.vue'
import ProjectsView from '../views/ProjectsView.vue'
import ReleasesView from '../views/ReleasesView.vue'
import ServicesView from '../views/ServicesView.vue'
import SettingsView from '../views/SettingsView.vue'
import ComingSoonView from '../views/ComingSoonView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView },
    {
      path: '/',
      component: AppLayout,
      children: [
        { path: '', name: 'dashboard', component: DashboardView },
        { path: 'projects', name: 'projects', component: ProjectsView },
        { path: 'releases', name: 'releases', component: ReleasesView },
        { path: 'environments', name: 'environments', component: EnvironmentsView },
        { path: 'services', name: 'services', component: ServicesView },
        { path: 'settings', name: 'settings', component: SettingsView },
        { path: 'artifacts', name: 'artifacts', component: ComingSoonView },
        { path: 'audit', name: 'audit', component: ComingSoonView },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const loggedIn = Boolean(localStorage.getItem('lightship_token'))
  if (to.path !== '/login' && !loggedIn) return '/login'
  if (to.path === '/login' && loggedIn) return '/'
})

export default router
