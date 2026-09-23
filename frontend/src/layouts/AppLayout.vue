<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Bell, Box, ChevronRight, Folder, Gauge, History, Layers3, Plus, Search,
  Server, Settings, ShipWheel, SlidersHorizontal, Activity,
} from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { api } from '../api/client'
import type { Project, Release } from '../types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const search = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const searchProjects = ref<Project[]>([])
const searchReleases = ref<Release[]>([])
const searchLoading = ref(false)

const nav = [
  { to: '/', name: 'dashboard', label: '总览', icon: Gauge },
  { to: '/projects', name: 'projects', label: '项目', icon: Folder },
  { to: '/releases', name: 'releases', label: '发布记录', icon: History },
  { to: '/environments', name: 'environments', label: '发布环境', icon: Server },
  { to: '/services', name: 'services', label: '服务状态', icon: Activity },
]
const canOperate = computed(() => ['admin', 'release_manager', 'developer'].includes(auth.role))
const titles: Record<string, string> = { dashboard: '发布总览', projects: '项目管理', releases: '发布记录', environments: '发布环境', services: '服务状态', settings: '平台设置', artifacts: '制品库', audit: '审计日志' }
const title = computed(() => titles[String(route.name)] || '轻舟')
const searchResults = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return []
  const projects = searchProjects.value
    .filter((item) => `${item.name} ${item.description} ${item.repository_url}`.toLowerCase().includes(keyword))
    .slice(0, 5)
    .map((item) => ({ kind: 'project', id: item.id, title: item.name, detail: item.description || item.repository_url, to: `/projects?search=${encodeURIComponent(item.name)}` }))
  const releases = searchReleases.value
    .filter((item) => `${item.release_no} ${item.version} ${item.project_name} ${item.environment_name} ${item.status}`.toLowerCase().includes(keyword))
    .slice(0, 8)
    .map((item) => ({ kind: 'release', id: item.id, title: item.release_no, detail: `${item.project_name} · v${item.version} · ${item.environment_name}`, to: `/releases?release_id=${item.id}` }))
  return [...projects, ...releases]
})
async function loadSearchData() {
  searchLoading.value = true
  try {
    const [projects, releases] = await Promise.all([api.get('/projects'), api.get('/releases')])
    searchProjects.value = projects.data
    searchReleases.value = releases.data
  } catch {
    searchProjects.value = []
    searchReleases.value = []
  } finally {
    searchLoading.value = false
  }
}
function selectSearchResult(to: string) {
  search.value = ''
  router.push(to)
}
function handleSearchShortcut(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    searchInput.value?.focus()
  } else if (event.key === 'Escape' && document.activeElement === searchInput.value) {
    search.value = ''
    searchInput.value?.blur()
  } else if (event.key === 'Enter' && document.activeElement === searchInput.value && searchResults.value[0]) {
    selectSearchResult(searchResults.value[0].to)
  }
}
onMounted(() => {
  auth.syncMe().catch(() => undefined)
  loadSearchData()
  window.addEventListener('keydown', handleSearchShortcut)
})
onBeforeUnmount(() => window.removeEventListener('keydown', handleSearchShortcut))
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark"><ShipWheel /></div><div><div class="brand-title">轻舟</div><div class="brand-sub">Deploy console</div></div></div>
      <div class="workspace-switch"><div><strong>Sunny Tech</strong><span>研发效能空间</span></div><button><ChevronRight /></button></div>
      <div class="nav-label">工作台</div>
      <nav class="nav-list">
        <router-link v-for="item in nav" :key="item.name" :to="item.to" class="nav-item" :class="{ active: route.name === item.name }">
          <component :is="item.icon" /><span>{{ item.label }}</span>
        </router-link>
        <button class="nav-item" :class="{active: route.name === 'artifacts'}" @click="router.push('/artifacts')"><Box /><span>制品库</span></button>
        <button class="nav-item" :class="{active: route.name === 'audit'}" @click="router.push('/audit')"><Layers3 /><span>审计日志</span></button>
      </nav>
      <div class="nav-label">系统</div>
      <nav class="nav-list"><button class="nav-item" :class="{active: route.name === 'settings'}" @click="router.push('/settings')"><Settings /><span>平台设置</span></button></nav>
      <div class="sidebar-foot">
        <div class="runner-health"><div class="runner-health-head"><span>构建节点</span><span class="runner-health-value">5 / 6 在线</span></div><div class="runner-bars"><i v-for="(h,i) in [9,14,20,13,23,18,25,11,20,16,22,18]" :key="i" class="on" :style="{height:`${h}px`}" /></div></div>
        <button class="user-row user-button" @click="auth.logout"><div class="avatar">{{ auth.displayName.slice(0,2).toUpperCase() }}</div><div><strong>{{ auth.displayName }}</strong><span>{{ auth.role }} · 点击退出</span></div></button>
      </div>
    </aside>
    <main class="main">
      <header class="topbar">
        <div><div class="page-title">{{ title }}</div><div class="breadcrumb">Sunny Tech / {{ title }}</div></div>
        <div class="search-box"><Search /><input ref="searchInput" v-model="search" placeholder="搜索项目、版本或发布单" @focus="loadSearchData" /><span class="shortcut">⌘ K</span><div v-if="search.trim()" class="global-search-results"><div v-if="searchLoading" class="global-search-empty">正在搜索...</div><template v-else-if="searchResults.length"><button v-for="item in searchResults" :key="`${item.kind}-${item.id}`" class="global-search-result" @click="selectSearchResult(item.to)"><span class="global-search-kind" :class="item.kind">{{ item.kind === 'project' ? '项目' : '发布' }}</span><span><strong>{{ item.title }}</strong><small>{{ item.detail }}</small></span><span class="global-search-arrow">›</span></button></template><div v-else class="global-search-empty">没有找到匹配的项目、版本或发布单</div></div></div>
        <button class="icon-button"><Bell /></button>
        <button v-if="canOperate" class="primary-button" @click="router.push('/releases?create=1')"><Plus />发起发布</button>
      </header>
      <router-view />
    </main>
  </div>
</template>
