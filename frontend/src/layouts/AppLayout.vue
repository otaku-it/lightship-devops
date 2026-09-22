<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Bell, Box, ChevronRight, Folder, Gauge, History, Layers3, Plus, Search,
  Server, Settings, ShipWheel, SlidersHorizontal,
} from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const search = ref('')

const nav = [
  { to: '/', name: 'dashboard', label: '总览', icon: Gauge },
  { to: '/projects', name: 'projects', label: '项目', icon: Folder },
  { to: '/releases', name: 'releases', label: '发布记录', icon: History },
  { to: '/environments', name: 'environments', label: '发布环境', icon: Server },
]
const titles: Record<string, string> = { dashboard: '发布总览', projects: '项目管理', releases: '发布记录', environments: '发布环境' }
const title = computed(() => titles[String(route.name)] || '轻舟')
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
        <button class="nav-item" @click="router.push('/environments')"><Box /><span>制品库</span></button>
        <button class="nav-item" @click="router.push('/releases')"><Layers3 /><span>审计日志</span></button>
      </nav>
      <div class="nav-label">系统</div>
      <nav class="nav-list"><button class="nav-item"><Settings /><span>平台设置</span></button></nav>
      <div class="sidebar-foot">
        <div class="runner-health"><div class="runner-health-head"><span>构建节点</span><span class="runner-health-value">5 / 6 在线</span></div><div class="runner-bars"><i v-for="(h,i) in [9,14,20,13,23,18,25,11,20,16,22,18]" :key="i" class="on" :style="{height:`${h}px`}" /></div></div>
        <button class="user-row user-button" @click="auth.logout"><div class="avatar">{{ auth.displayName.slice(0,2).toUpperCase() }}</div><div><strong>{{ auth.displayName }}</strong><span>{{ auth.role }} · 点击退出</span></div></button>
      </div>
    </aside>
    <main class="main">
      <header class="topbar">
        <div><div class="page-title">{{ title }}</div><div class="breadcrumb">Sunny Tech / {{ title }}</div></div>
        <div class="search-box"><Search /><input v-model="search" placeholder="搜索项目、版本或发布单" /><span class="shortcut">⌘ K</span></div>
        <button class="icon-button"><Bell /></button>
        <button class="primary-button" @click="router.push('/releases?create=1')"><Plus />发起发布</button>
      </header>
      <router-view />
    </main>
  </div>
</template>
