<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertTriangle, Check, Maximize2, Plus, RefreshCw, Rocket, Server, Trash2, X } from 'lucide-vue-next'
import { api } from '../api/client'
import ModalShell from '../components/ModalShell.vue'
import StatusTrack from '../components/StatusTrack.vue'
import type { DeploymentTarget, Environment, Project, Release } from '../types'
import { parseApiDate } from '../utils/datetime'
import { useAuthStore } from '../stores/auth'

const releases = ref<Release[]>([])
const projects = ref<Project[]>([])
const environments = ref<Environment[]>([])
const targets = ref<DeploymentTarget[]>([])
const filter = ref('all')
const showCreate = ref(false)
const selected = ref<Release | null>(null)
const logExpanded = ref(false)
const deleteCandidate = ref<Release | null>(null)
const deleting = ref(false)
const deleteError = ref('')
const refreshingLogs = ref(false)
const saving = ref(false)
const error = ref('')
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const canOperate = computed(() => ['admin', 'release_manager', 'developer'].includes(auth.role))
const canManage = computed(() => ['admin', 'release_manager'].includes(auth.role))
let timer: number | undefined
const form = reactive({ project_id: 0, environment_id: 0, version: '1.0.0', branch: 'main', strategy: 'rolling', artifact_url: '', notes: '' })
const visible = computed(() => releases.value.filter((item) => filter.value === 'all' || item.status === filter.value))
const selectedProject = computed(() => projects.value.find((item) => item.id === form.project_id))
const selectedTargets = computed(() => targets.value.filter((item) => item.project_id === form.project_id && item.environment_id === form.environment_id))
const readyTargets = computed(() => selectedTargets.value.filter((item) => item.connection_type === 'ssh' && item.status === 'online' && item.credential_configured))

async function load() {
  const [releaseResult, projectResult, environmentResult, targetResult] = await Promise.all([api.get('/releases'), api.get('/projects'), api.get('/environments'), api.get('/targets')])
  releases.value = releaseResult.data
  projects.value = projectResult.data
  environments.value = environmentResult.data
  targets.value = targetResult.data
  if (!form.project_id && projects.value.length) selectProject(projects.value[0].id)
  if (!form.environment_id && environments.value.length) form.environment_id = environments.value.at(-1)!.id
  if (selected.value) selected.value = releases.value.find((item) => item.id === selected.value?.id) || selected.value
}
function selectProject(projectId: number) {
  form.project_id = projectId
  const project = projects.value.find((item) => item.id === projectId)
  if (project) form.branch = project.default_branch
  const preferred = environments.value.find((environment) => targets.value.some((item) => item.project_id === projectId && item.environment_id === environment.id && item.status === 'online' && item.credential_configured))
  if (preferred) form.environment_id = preferred.id
}
function targetCount(environmentId: number) { return targets.value.filter((item) => item.project_id === form.project_id && item.environment_id === environmentId).length }
function readyTargetCount(environmentId: number) { return targets.value.filter((item) => item.project_id === form.project_id && item.environment_id === environmentId && item.connection_type === 'ssh' && item.status === 'online' && item.credential_configured).length }
function openCreate() { if (!canOperate.value) return; error.value = ''; showCreate.value = true }
function configureTargets() { router.push(`/environments?project_id=${form.project_id}&create=1`) }
async function createRelease() {
  error.value = ''
  if (!form.version || !form.branch) { error.value = '请填写版本号和分支'; return }
  if (!readyTargets.value.length) { error.value = '所选环境没有连接正常且已配置凭证的 SSH 服务器'; return }
  saving.value = true
  try { const { data } = await api.post('/releases', form); showCreate.value = false; selected.value = data; await router.replace('/releases'); await load() }
  catch (exception:any) { error.value = exception.response?.data?.detail || '发布任务创建失败' }
  finally { saving.value = false }
}
function duration(item: Release) {
  if (!item.started_at) return '--'
  const end = item.finished_at ? parseApiDate(item.finished_at).getTime() : Date.now()
  const seconds = Math.max(0, Math.floor((end - parseApiDate(item.started_at).getTime()) / 1000))
  return `${Math.floor(seconds/60)}m ${String(seconds%60).padStart(2,'0')}s`
}
function activeStep(item: Release) { return item.steps.find((step) => step.status === 'running') || item.steps.find((step) => step.status === 'failed') || item.steps.at(-1) }
function lastLog(item: Release) { return item.logs.at(-1) }
function waitingMinutes(item: Release) {
  if (!item.started_at || item.status !== 'running') return 0
  return Math.floor(Math.max(0, Date.now() - parseApiDate(item.started_at).getTime()) / 60000)
}
function stepLabel(status: string) { return ({ running: '执行中', success: '已完成', failed: '失败', simulated: '仅模拟' } as Record<string, string>)[status] || '等待中' }
function closeRelease() { logExpanded.value = false; selected.value = null }
function requestDelete(release: Release) {
  if (!canManage.value) return
  if (['pending', 'running'].includes(release.status)) return
  deleteError.value = ''
  deleteCandidate.value = release
}
async function deleteRelease() {
  if (!deleteCandidate.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await api.delete(`/releases/${deleteCandidate.value.id}`)
    if (selected.value?.id === deleteCandidate.value.id) closeRelease()
    deleteCandidate.value = null
    await load()
  } catch (exception:any) {
    deleteError.value = exception.response?.data?.detail || '发布记录删除失败'
  } finally {
    deleting.value = false
  }
}
async function refreshSelectedRelease() {
  if (!selected.value || refreshingLogs.value) return
  refreshingLogs.value = true
  try {
    const { data } = await api.get(`/releases/${selected.value.id}`)
    const index = releases.value.findIndex((item) => item.id === data.id)
    if (index >= 0) releases.value[index] = data
    selected.value = data
  } finally {
    refreshingLogs.value = false
  }
}
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && logExpanded.value) logExpanded.value = false
}
function applyRouteIntent() {
  const projectId = Number(route.query.project_id || 0)
  if (projects.value.some((item) => item.id === projectId)) selectProject(projectId)
  if (route.query.create) openCreate()
  const releaseId = Number(route.query.release_id || 0)
  if (releaseId) selected.value = releases.value.find((item) => item.id === releaseId) || null
}
watch(() => route.query, () => { if (projects.value.length) applyRouteIntent() })
watch(selected, (value) => { if (!value) logExpanded.value = false })
onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  await load()
  applyRouteIntent()
  timer = window.setInterval(() => { if (releases.value.some((item) => ['pending','running'].includes(item.status))) load() }, 1500)
})
onBeforeUnmount(() => {
  window.clearInterval(timer)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="content compact releases-page" :class="`role-${auth.role}`">
    <div class="hero-row"><div><div class="eyebrow">Delivery history</div><h1>发布记录</h1><p>真实拉取仓库，并通过 SSH 将文件、Docker 或 Docker Compose 工程发布到目标服务器。</p></div><button class="primary-button" @click="openCreate"><Plus />发起发布</button></div>
    <div class="toolbar"><div class="filter-tabs"><button v-for="item in [{k:'all',n:'全部'},{k:'success',n:'成功'},{k:'running',n:'进行中'},{k:'failed',n:'失败'},{k:'simulated',n:'仅模拟'}]" :key="item.k" class="filter-tab" :class="{active:filter===item.k}" @click="filter=item.k">{{ item.n }}</button></div><div class="toolbar-spacer" /><button class="secondary-button" @click="load"><RefreshCw />刷新</button></div>
    <section class="panel"><div class="pipeline-list"><div v-for="release in visible" :key="release.id" class="pipeline-row" @click="selected=release"><div class="project-cell"><div class="project-glyph" :class="release.project_type">{{ release.project_type.slice(0,4).toUpperCase() }}</div><div><strong>{{ release.project_name }}</strong><span>v{{ release.version }} · {{ release.release_no }}</span></div></div><div><span class="env-pill" :class="{prod:release.environment_name==='生产环境'}">{{ release.environment_name }}</span></div><StatusTrack :stage="release.current_stage" :status="release.status" /><div class="duration">{{ duration(release) }}<span>{{ release.created_by }}</span></div><div class="pipeline-row-actions"><button class="row-delete-button" :disabled="['pending','running'].includes(release.status)" :title="['pending','running'].includes(release.status)?'进行中的发布不能删除':'删除发布记录'" aria-label="删除发布记录" @click.stop="requestDelete(release)"><Trash2 /></button><span>›</span></div></div><div v-if="!visible.length" class="list-empty">当前筛选条件下没有发布记录。</div></div></section>

    <ModalShell v-if="showCreate" title="发起发布" subtitle="创建一条可追踪、可回滚的标准发布" @close="showCreate=false">
      <div class="modal-body"><div class="form-grid"><div class="form-field full"><label>项目 *</label><select :value="form.project_id" @change="selectProject(Number(($event.target as HTMLSelectElement).value))"><option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }} · {{ project.deployment_mode==='docker'?'Docker 部署':project.project_type }}</option></select></div><div class="form-field"><label>Git 分支 *</label><input v-model="form.branch" /></div><div class="form-field"><label>版本号 *</label><input v-model="form.version" /></div><div class="form-field"><label>发布到哪个环境</label><select v-model="form.environment_id"><option v-for="environment in environments" :key="environment.id" :value="environment.id">{{ environment.name }}（{{ readyTargetCount(environment.id) }}/{{ targetCount(environment.id) }} 台可用）</option></select></div><div class="form-field"><label>部署策略</label><select v-model="form.strategy"><option value="rolling">逐台发布</option><option value="blue_green" disabled>蓝绿发布（待支持）</option><option value="canary" disabled>灰度发布（待支持）</option></select></div><section class="release-target-preview full" :class="{blocked:!readyTargets.length}"><div class="release-target-head"><div><strong>发布目标预览</strong><span>{{ selectedProject?.name }} · {{ environments.find(item=>item.id===form.environment_id)?.name }}</span></div><b>{{ readyTargets.length }} / {{ selectedTargets.length }} 台可发布</b></div><div v-if="selectedTargets.length" class="release-target-list"><div v-for="target in selectedTargets" :key="target.id"><Server /><div><strong>{{ target.name }}</strong><span>{{ target.address }}:{{ target.port }}</span></div><em :class="{ready:readyTargets.some(item=>item.id===target.id)}">{{ readyTargets.some(item=>item.id===target.id)?'就绪':target.status==='offline'?'连接失败':!target.credential_configured?'未配置凭证':'未测试' }}</em></div></div><div v-else class="release-target-empty"><AlertTriangle /><span>这个项目在所选环境还没有服务器。</span><button class="secondary-button" @click="configureTargets">立即配置服务器</button></div></section><div class="form-field full"><label>发布说明（可选）</label><textarea v-model="form.notes" placeholder="例如：修复登录问题，发布后观察 10 分钟" /></div><div class="security-note full"><Rocket /><div><strong>{{ selectedProject?.deployment_mode==='docker'?'将执行真实 Docker 发布':'将执行真实文件发布' }}</strong><span>{{ selectedProject?.deployment_mode==='docker'?'平台会上传代码到目标服务器，构建镜像、更新容器并检查健康状态。':'平台会构建制品，并只部署到上方显示为“就绪”的目标服务器。' }}</span></div></div><span v-if="error" class="error-text">{{ error }}</span></div></div>
      <div class="modal-foot"><button class="ghost-button" @click="showCreate=false">取消</button><button class="primary-button" :disabled="saving||!readyTargets.length" @click="createRelease"><Rocket />{{ saving?'正在创建...':readyTargets.length?`确认发布到 ${readyTargets.length} 台服务器`:'请先配置可用服务器' }}</button></div>
    </ModalShell>

    <ModalShell v-if="deleteCandidate" title="删除发布记录" subtitle="此操作不可恢复" size="small" @close="deleteCandidate=null">
      <div class="modal-body delete-confirm-body"><div class="delete-warning-icon"><AlertTriangle /></div><div><strong>确认删除 {{ deleteCandidate.release_no }}？</strong><p>将删除 {{ deleteCandidate.project_name }} v{{ deleteCandidate.version }} 的发布步骤、服务器结果和全部实时日志，不会操作目标服务器上已经运行的服务。</p><span v-if="deleteError" class="error-text">{{ deleteError }}</span></div></div>
      <div class="modal-foot"><button class="ghost-button" :disabled="deleting" @click="deleteCandidate=null">取消</button><button class="danger-button" :disabled="deleting" @click="deleteRelease"><Trash2 />{{ deleting?'正在删除...':'确认删除记录' }}</button></div>
    </ModalShell>

    <div v-if="selected" class="drawer-wrap" @mousedown.self="closeRelease">
      <aside class="drawer release-drawer">
        <div class="drawer-head">
          <div class="drawer-title">
            <div class="project-glyph" :class="selected.project_type">{{ selected.project_type.slice(0,4).toUpperCase() }}</div>
            <div><h2>{{ selected.release_no }}</h2><p>{{ selected.project_name }} · v{{ selected.version }}</p></div>
          </div>
          <button class="icon-button" aria-label="关闭发布详情" @click="closeRelease"><X /></button>
        </div>
        <div class="drawer-body">
          <div class="detail-status" :class="selected.status"><component :is="selected.status==='success'?Check:RefreshCw" /><div><strong>{{ selected.status==='success'?'真实发布成功':selected.status==='simulated'?'仅模拟完成，未操作服务器':selected.status==='failed'?'发布失败':'发布正在执行' }}</strong><span v-if="selected.status==='running'">当前：{{ activeStep(selected)?.name || '准备执行' }} · 已等待 {{ waitingMinutes(selected) }} 分钟</span></div></div>
          <div v-if="selected.status==='running'" class="release-live-summary"><strong>正在执行：{{ activeStep(selected)?.name || '准备中' }}</strong><span>最后日志：{{ lastLog(selected) ? parseApiDate(lastLog(selected)!.created_at).toLocaleTimeString('zh-CN') : '暂无' }}</span><span>执行器会持续写入远程命令输出，页面每 1.5 秒自动刷新。</span></div>
          <div class="detail-section"><h4>发布步骤</h4><div class="detail-stage-list"><div v-for="stepItem in selected.steps" :key="stepItem.id" class="detail-stage" :class="stepItem.status"><span>{{ stepItem.sequence }}</span><div><strong>{{ stepItem.name }}</strong><small>{{ stepLabel(stepItem.status) }}{{ stepItem.status==='running' ? ` · ${duration({ ...selected, started_at: stepItem.started_at })}` : '' }}</small></div></div></div></div>
          <div v-if="selected.deployments.length" class="detail-section"><h4>目标发布结果</h4><div class="deployment-results"><div v-for="item in selected.deployments" :key="item.id" class="deployment-result" :class="item.status"><div><strong>{{ item.target_name }}</strong><span>{{ item.status==='success'?'部署成功':item.status==='skipped'?'已跳过':item.status==='running'?'部署中':'部署失败' }}</span></div><p>{{ item.message || (item.status==='running' ? '已连接目标服务器，正在执行远程命令...' : '') }}</p><code v-if="item.deployed_path">{{ item.deployed_path }}</code></div></div></div>
          <div class="detail-section">
            <h4>实时日志 <small v-if="selected.logs.length">（{{ selected.logs.length }} 条，最新自动置底）</small></h4>
            <div class="terminal detail-terminal">
              <div class="terminal-head">
                <span>{{ selected.release_no }} / live logs</span>
                <div class="terminal-head-actions">
                  <span>{{ lastLog(selected) ? parseApiDate(lastLog(selected)!.created_at).toLocaleTimeString('zh-CN') : '--' }}</span>
                  <button class="terminal-refresh-button" :class="{spinning:refreshingLogs}" :disabled="refreshingLogs" title="刷新日志" aria-label="刷新日志" @click="refreshSelectedRelease"><RefreshCw /></button>
                  <button class="terminal-expand-button" title="放大查看日志" aria-label="放大查看日志" @click="logExpanded=true"><Maximize2 /></button>
                </div>
              </div>
              <div class="terminal-body"><div v-for="log in selected.logs" :key="log.id" class="log-line"><span class="log-time">{{ parseApiDate(log.created_at).toLocaleTimeString('zh-CN') }}</span><span :class="{'log-ok':log.level==='SUCCESS','log-warn':['ERROR','WARNING'].includes(log.level)}">{{ log.level.padEnd(7) }} {{ log.message }}</span></div><span v-if="!selected.logs.length">等待执行器输出...</span></div>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <Teleport to="body">
      <div v-if="logExpanded && selected" class="log-viewer-backdrop" @mousedown.self="logExpanded=false">
        <section class="log-viewer" role="dialog" aria-modal="true" aria-label="发布实时日志">
          <header class="log-viewer-head">
            <div><h3>{{ selected.release_no }} 实时日志</h3><p>{{ selected.project_name }} · v{{ selected.version }} · {{ selected.logs.length }} 条</p></div>
            <div class="log-viewer-meta"><button class="log-refresh-button" :class="{spinning:refreshingLogs}" :disabled="refreshingLogs" aria-label="刷新日志" title="刷新日志" @click="refreshSelectedRelease"><RefreshCw /></button><span>最后更新 {{ lastLog(selected) ? parseApiDate(lastLog(selected)!.created_at).toLocaleTimeString('zh-CN') : '--' }}</span><button aria-label="退出放大查看" title="退出放大查看" @click="logExpanded=false"><X /></button></div>
          </header>
          <div class="terminal log-viewer-terminal">
            <div class="terminal-body"><div v-for="log in selected.logs" :key="log.id" class="log-line"><span class="log-time">{{ parseApiDate(log.created_at).toLocaleTimeString('zh-CN') }}</span><span :class="{'log-ok':log.level==='SUCCESS','log-warn':['ERROR','WARNING'].includes(log.level)}">{{ log.level.padEnd(7) }} {{ log.message }}</span></div><span v-if="!selected.logs.length">等待执行器输出...</span></div>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>
