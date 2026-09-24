<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Check, Clock3, Folder, Rocket, Server, TrendingUp } from 'lucide-vue-next'
import { api } from '../api/client'
import StatusTrack from '../components/StatusTrack.vue'
import type { DashboardStats, DeploymentTarget, Project } from '../types'
import { parseApiDate } from '../utils/datetime'

const router = useRouter()
const stats = ref<DashboardStats | null>(null)
const targets = ref<DeploymentTarget[]>([])
const projects = ref<Project[]>([])
const loading = ref(true)
const currentTime = ref(new Date())
let greetingTimer: number | undefined
const duration = computed(() => {
  const value = stats.value?.average_duration_seconds || 0
  return `${Math.floor(value / 60)}m ${String(value % 60).padStart(2, '0')}s`
})
const projectsWithTargets = computed(() => new Set(targets.value.map((item) => item.project_id)).size)
const readyProjects = computed(() => new Set(targets.value.filter((item) => item.connection_type === 'ssh' && item.status === 'online' && item.credential_configured).map((item) => item.project_id)).size)
const greeting = computed(() => {
  const hour = currentTime.value.getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

onMounted(async () => {
  greetingTimer = window.setInterval(() => { currentTime.value = new Date() }, 60_000)
  try {
    const [statsResult, targetResult, projectResult] = await Promise.all([api.get('/dashboard'), api.get('/targets'), api.get('/projects')])
    stats.value = statsResult.data
    targets.value = targetResult.data
    projects.value = projectResult.data
  } finally { loading.value = false }
})
onUnmounted(() => {
  if (greetingTimer) window.clearInterval(greetingTimer)
})
</script>

<template>
  <div class="content">
    <div class="hero-row"><div><div class="eyebrow">Release window open</div><h1>{{ greeting }}，交付航线一切正常</h1><p>从代码提交到目标服务器，每一步都有状态、日志和回滚依据。</p></div><div class="hero-actions"><button class="secondary-button" @click="router.push('/projects')"><Folder />查看项目</button><button class="primary-button" @click="router.push('/releases?create=1')"><Rocket />发起发布</button></div></div>
    <section class="getting-started"><div class="getting-started-copy"><strong>最快发布路径</strong><span>按顺序完成 3 步即可真实发布</span></div><button :class="{done:projects.length}" @click="router.push('/projects')"><i><Check v-if="projects.length" /><span v-else>1</span></i><div><strong>接入项目</strong><small>{{ projects.length }} 个项目</small></div></button><button :class="{done:projectsWithTargets}" @click="router.push('/environments')"><i><Check v-if="projectsWithTargets" /><span v-else>2</span></i><div><strong>配置服务器</strong><small>{{ projectsWithTargets }} 个项目已配置</small></div></button><button :class="{done:readyProjects}" @click="router.push(readyProjects?'/releases?create=1':'/environments')"><i><Check v-if="readyProjects" /><span v-else>3</span></i><div><strong>测试并发布</strong><small>{{ readyProjects }} 个项目可发布</small></div></button></section>
    <div v-if="stats" class="metric-grid">
      <div class="metric-card" style="--tone:#168f52"><div class="metric-top"><span>今日发布</span><span class="metric-icon"><Rocket /></span></div><div class="metric-value">{{ stats.today_releases }}</div><div class="metric-foot">{{ stats.pending_releases }} 个任务正在执行或等待</div></div>
      <div class="metric-card" style="--tone:#4e72dd"><div class="metric-top"><span>发布成功率</span><span class="metric-icon"><TrendingUp /></span></div><div class="metric-value">{{ stats.success_rate }}%</div><div class="metric-foot">基于历史发布记录</div></div>
      <div class="metric-card" style="--tone:#d99724"><div class="metric-top"><span>平均交付时长</span><span class="metric-icon"><Clock3 /></span></div><div class="metric-value">{{ duration }}</div><div class="metric-foot">从任务启动到健康检查</div></div>
      <div class="metric-card" style="--tone:#845aa7"><div class="metric-top"><span>在线目标</span><span class="metric-icon"><Server /></span></div><div class="metric-value">{{ stats.online_targets }} / {{ stats.total_targets }}</div><div class="metric-foot">Agent、SSH 与 Kubernetes</div></div>
    </div>
    <div v-if="stats" class="dashboard-grid">
      <section class="panel"><div class="panel-head"><div><div class="panel-title">最近发布</div><div class="panel-subtitle">真实读取后端发布单与执行状态</div></div><button class="panel-link" @click="router.push('/releases')">全部记录</button></div>
        <div class="pipeline-list"><div v-for="release in stats.recent_releases" :key="release.id" class="pipeline-row" @click="router.push('/releases')"><div class="project-cell"><div class="project-glyph" :class="release.project_type">{{ release.project_type.slice(0,4).toUpperCase() }}</div><div><strong>{{ release.project_name }}</strong><span>v{{ release.version }} · {{ release.release_no }}</span></div></div><div><span class="env-pill" :class="{prod:release.environment_name==='生产环境'}">{{ release.environment_name }}</span></div><StatusTrack :stage="release.current_stage" :status="release.status" /><div class="duration">{{ release.created_by }}<span>{{ parseApiDate(release.created_at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) }}</span></div><span>›</span></div><div v-if="!stats.recent_releases.length" class="list-empty">还没有发布记录，发起第一次发布吧。</div></div>
      </section>
      <section class="panel"><div class="panel-head"><div><div class="panel-title">部署目标</div><div class="panel-subtitle">最近连接状态</div></div><button class="panel-link" @click="router.push('/environments')">管理</button></div><div class="env-stack"><div v-for="target in targets.slice(0,4)" :key="target.id" class="env-card"><div class="env-card-head"><div class="env-name"><i class="health-dot" :class="{warn:target.status!=='online'}" />{{ target.name }}</div><span class="tiny-pill">{{ target.status === 'online' ? '已连接' : '离线' }}</span></div><div class="env-version">{{ target.address }}</div><div class="env-meta"><span>{{ target.environment_name }}</span><span>{{ target.connection_type.toUpperCase() }}</span></div></div></div></section>
    </div>
    <div v-if="loading" class="loading-state">正在读取平台状态...</div>
  </div>
</template>
