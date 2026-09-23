<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CheckCircle2, CircleAlert, Container, Pause, Play, RefreshCw, RotateCw, Server, TriangleAlert, XCircle } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api/client'
import type { DeploymentTarget, Project, ServiceStatus } from '../types'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const projects = ref<Project[]>([])
const targets = ref<DeploymentTarget[]>([])
const statuses = ref<Record<number, ServiceStatus>>({})
const checking = ref<Record<number, boolean>>({})
const loading = ref(true)
const selectedProjectId = ref(Number(route.query.project_id || 0))
const notice = ref('')
const controlling = ref<Record<number, boolean>>({})

const selectedProject = computed(() => projects.value.find((item) => item.id === selectedProjectId.value))
const visibleTargets = computed(() => selectedProjectId.value ? targets.value.filter((item) => item.project_id === selectedProjectId.value) : targets.value)
const runningCount = computed(() => visibleTargets.value.filter((item) => statuses.value[item.id]?.status === 'running').length)
const problemCount = computed(() => visibleTargets.value.filter((item) => ['unhealthy', 'stopped', 'unreachable'].includes(statuses.value[item.id]?.status || '')).length)
const pendingCount = computed(() => visibleTargets.value.filter((item) => !statuses.value[item.id]).length)

function statusLabel(status?: string) {
  return ({ running: '运行中', unhealthy: '健康异常', stopped: '已停止', unreachable: '无法连接', unknown: '待检查' } as Record<string, string>)[status || ''] || '检查中'
}
function statusIcon(status?: string) {
  return status === 'running' ? CheckCircle2 : ['unhealthy', 'stopped', 'unreachable'].includes(status || '') ? XCircle : CircleAlert
}
function statusClass(status?: string) { return status || 'checking' }
async function load() {
  loading.value = true
  try {
    const [projectResult, targetResult] = await Promise.all([api.get('/projects'), api.get('/targets')])
    projects.value = projectResult.data
    targets.value = targetResult.data
    if (selectedProjectId.value && !projects.value.some((item) => item.id === selectedProjectId.value)) selectedProjectId.value = 0
    await checkAll()
  } finally { loading.value = false }
}
async function checkOne(target: DeploymentTarget) {
  checking.value[target.id] = true
  try {
    const { data } = await api.post(`/targets/${target.id}/service-status`, {})
    statuses.value[target.id] = data
  } catch (exception: any) {
    statuses.value[target.id] = { target_id: target.id, project_id: target.project_id, status: 'unreachable', healthy: false, message: exception.response?.data?.detail || '服务状态检查失败', detail: '', version: '', release_no: '', runtime: '', latency_ms: 0, checked_at: new Date().toISOString() }
  } finally { checking.value[target.id] = false }
}
async function checkAll() {
  const list = visibleTargets.value
  if (!list.length) return
  await Promise.all(list.map((target) => checkOne(target)))
  notice.value = `已完成 ${list.length} 台目标服务器的真实服务状态检查`
}
async function controlService(target: DeploymentTarget, action: 'stop' | 'start' | 'restart') {
  const labels = { stop: '暂停', start: '启用', restart: '重启' }
  if (!window.confirm(`确认${labels[action]} ${target.name} 上的服务？这会在目标服务器执行真实操作。`)) return
  controlling.value[target.id] = true
  try {
    const { data } = await api.post(`/targets/${target.id}/service-control`, { action })
    notice.value = data.success ? `${target.name}：${data.message}` : `${target.name}：${data.message}（${data.detail || '无更多信息'}）`
    await checkOne(target)
  } catch (exception: any) {
    notice.value = `${target.name}：${exception.response?.data?.detail || '服务操作失败'}`
  } finally { controlling.value[target.id] = false }
}
async function changeProject() {
  await router.replace(selectedProjectId.value ? `/services?project_id=${selectedProjectId.value}` : '/services')
  await checkAll()
}
onMounted(load)
</script>

<template>
  <div class="content compact services-page" :class="`role-${auth.role}`">
    <div class="hero-row"><div><div class="eyebrow">Runtime observability</div><h1>服务运行状态</h1><p>这里展示目标服务器上应用的真实运行状态，不等同于 SSH 连接状态。点击刷新会登录服务器执行实际检查。</p></div><div class="hero-actions"><button class="secondary-button" @click="router.push('/environments')"><Server />管理服务器</button><button class="primary-button" :disabled="loading || !visibleTargets.length" @click="checkAll"><RefreshCw :class="{spin:loading}" />刷新全部状态</button></div></div>
    <div class="service-scope"><div><strong>查看项目服务</strong><span>按项目查看生产、预发、测试环境的运行情况</span></div><select v-model.number="selectedProjectId" @change="changeProject"><option :value="0">所有项目</option><option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option></select><span v-if="selectedProject" class="scope-result">当前项目：{{ selectedProject.name }}</span></div>
    <div class="service-summary"><div class="service-summary-card good"><span>运行中</span><strong>{{ runningCount }}</strong><small>真实检查通过</small></div><div class="service-summary-card danger"><span>异常</span><strong>{{ problemCount }}</strong><small>停止、健康异常或不可达</small></div><div class="service-summary-card pending"><span>待检查</span><strong>{{ pendingCount }}</strong><small>尚未返回状态</small></div><div class="service-summary-card"><span>目标服务器</span><strong>{{ visibleTargets.length }}</strong><small>当前项目范围</small></div></div>
    <div v-if="notice" class="inline-notice"><CheckCircle2 />{{ notice }}<button @click="notice=''">×</button></div>
    <section class="service-grid"><article v-for="target in visibleTargets" :key="target.id" class="service-card"><div class="service-card-head"><div class="service-target"><span class="service-target-icon"><Container v-if="target.connection_type !== 'ssh' || selectedProject?.deployment_mode !== 'file'" /><Server v-else /></span><div><strong>{{ target.name }}</strong><span>{{ target.project_name }} · {{ target.environment_name }}</span></div></div><span class="service-status-pill" :class="statusClass(statuses[target.id]?.status)"><i />{{ checking[target.id] ? '检查中' : statusLabel(statuses[target.id]?.status) }}</span></div><div v-if="statuses[target.id]" class="service-result"><div class="service-result-message"><component :is="statusIcon(statuses[target.id]?.status)" /><div><strong>{{ statuses[target.id].message }}</strong><span>{{ statuses[target.id].detail || '暂无更多诊断信息' }}</span></div></div><div class="service-meta"><span>版本 {{ statuses[target.id].version || '暂无成功发布' }}</span><span>{{ statuses[target.id].runtime || (selectedProject?.deployment_mode || '未设置') }}</span><span>{{ statuses[target.id].latency_ms ? `${statuses[target.id].latency_ms} ms` : '--' }}</span></div></div><div v-else class="service-pending"><CircleAlert />等待执行真实服务检查</div><div class="service-card-foot"><span>{{ target.address }}:{{ target.service_port }}</span><div class="service-actions"><button class="service-action-button" :disabled="controlling[target.id] || checking[target.id]" title="暂停服务" @click="controlService(target, 'stop')"><Pause /></button><button class="service-action-button" :disabled="controlling[target.id] || checking[target.id]" title="启用服务" @click="controlService(target, 'start')"><Play /></button><button class="service-action-button" :disabled="controlling[target.id] || checking[target.id]" title="重启服务" @click="controlService(target, 'restart')"><RotateCw :class="{spin:controlling[target.id]}" /></button><button class="secondary-button" :disabled="checking[target.id] || controlling[target.id]" @click="checkOne(target)"><RefreshCw :class="{spin:checking[target.id]}" />{{ checking[target.id] ? '检查中' : '检查服务' }}</button></div></div></article><div v-if="!visibleTargets.length" class="list-empty"><TriangleAlert />当前项目还没有配置目标服务器，请先接入服务器。</div></section>
  </div>
</template>
