<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { CheckCircle2, ChevronDown, History, RefreshCw, Search, XCircle } from 'lucide-vue-next'
import { api } from '../api/client'

interface AuditLog {
  id: number
  actor_username: string
  actor_display_name: string
  action: string
  resource_type: string
  resource_id: string
  summary: string
  detail: string
  result: string
  created_at: string
}

const logs = ref<AuditLog[]>([])
const loading = ref(false)
const error = ref('')
const expandedId = ref<number | null>(null)
const filters = reactive({ actor: '', action: '', result: '' })
const actionLabels: Record<string, string> = {
  'auth.login': '登录平台',
  'auth.password.change': '修改密码',
  'user.create': '创建用户',
  'user.update': '更新用户',
  'user.password.reset': '重置用户密码',
  'project.create': '创建项目',
  'project.update': '更新项目',
  'project.delete': '删除项目',
  'environment.create': '创建环境',
  'target.create': '创建服务器',
  'target.update': '更新服务器',
  'target.delete': '删除服务器',
  'release.create': '发起发布',
  'release.delete': '删除发布记录',
  'service.stop': '暂停服务',
  'service.start': '启用服务',
  'service.restart': '重启服务',
  'platform.settings.update': '更新平台设置',
  'code_host.create': '创建托管连接',
  'code_host.update': '更新托管连接',
  'code_host.test': '测试托管连接',
  'code_host.delete': '删除托管连接',
}
const actionOptions = computed(() => Object.entries(actionLabels))

function actionLabel(action: string) { return actionLabels[action] || action }
function formatDate(value: string) { return new Date(value).toLocaleString('zh-CN', { hour12: false }) }
function formatDetail(value: string) {
  if (!value) return '无补充详情'
  try { return JSON.stringify(JSON.parse(value), null, 2) } catch { return value }
}
async function loadLogs() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/audit-logs', { params: { ...filters, limit: 300 } })
    logs.value = data
  } catch (exception: any) {
    error.value = exception.response?.data?.detail || '审计日志加载失败'
  } finally { loading.value = false }
}
function resetFilters() {
  Object.assign(filters, { actor: '', action: '', result: '' })
  loadLogs()
}
onMounted(loadLogs)
</script>

<template>
  <div class="content compact audit-page">
    <div class="hero-row">
      <div><div class="eyebrow">Operation trace</div><h1>审计日志</h1><p>记录平台关键变更和服务操作，便于追溯是谁、在什么时间、对什么资源执行了操作。</p></div>
      <button class="secondary-button" :disabled="loading" @click="loadLogs"><RefreshCw :class="{spin:loading}" />刷新日志</button>
    </div>
    <section class="audit-toolbar">
      <label><span>操作人</span><div><Search /><input v-model="filters.actor" placeholder="用户名或显示名称" @keyup.enter="loadLogs" /></div></label>
      <label><span>操作类型</span><select v-model="filters.action"><option value="">全部操作</option><option v-for="item in actionOptions" :key="item[0]" :value="item[0]">{{ item[1] }}</option></select></label>
      <label><span>执行结果</span><select v-model="filters.result"><option value="">全部结果</option><option value="success">成功</option><option value="failed">失败</option></select></label>
      <div class="audit-toolbar-actions"><button class="primary-button" @click="loadLogs"><Search />查询</button><button class="ghost-button" @click="resetFilters">重置</button></div>
    </section>
    <div v-if="error" class="settings-error">{{ error }}<button @click="error=''">×</button></div>
    <section class="audit-table-panel">
      <div class="audit-table-head"><span>时间</span><span>操作人</span><span>操作</span><span>资源</span><span>结果</span><span></span></div>
      <button v-for="item in logs" :key="item.id" class="audit-row" @click="expandedId=expandedId===item.id?null:item.id">
        <span class="audit-time">{{ formatDate(item.created_at) }}</span>
        <span class="audit-actor"><strong>{{ item.actor_display_name }}</strong><small>{{ item.actor_username }}</small></span>
        <span class="audit-action"><strong>{{ actionLabel(item.action) }}</strong><small>{{ item.summary }}</small></span>
        <span class="audit-resource">{{ item.resource_type }}<small v-if="item.resource_id">#{{ item.resource_id }}</small></span>
        <span class="audit-result" :class="item.result"><CheckCircle2 v-if="item.result==='success'" /><XCircle v-else />{{ item.result === 'success' ? '成功' : '失败' }}</span>
        <ChevronDown class="audit-expand" :class="{open:expandedId===item.id}" />
        <pre v-if="expandedId===item.id" class="audit-detail">{{ formatDetail(item.detail) }}</pre>
      </button>
      <div v-if="loading" class="list-empty"><RefreshCw class="spin" />正在加载审计日志...</div>
      <div v-else-if="!logs.length" class="list-empty"><History />没有符合条件的审计记录</div>
    </section>
  </div>
</template>
