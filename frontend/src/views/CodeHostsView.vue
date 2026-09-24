<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { AlertTriangle, CheckCircle2, GitFork, LoaderCircle, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, XCircle } from 'lucide-vue-next'
import { api } from '../api/client'
import ModalShell from '../components/ModalShell.vue'
import { useAuthStore } from '../stores/auth'
import type { CodeHostConnection } from '../types'

const auth = useAuthStore()
const connections = ref<CodeHostConnection[]>([])
const loading = ref(false)
const saving = ref(false)
const testingId = ref<number | null>(null)
const error = ref('')
const message = ref('')
const showModal = ref(false)
const editing = ref<CodeHostConnection | null>(null)
const deleteCandidate = ref<CodeHostConnection | null>(null)
const canManage = computed(() => auth.role === 'admin')
const isAdmin = computed(() => auth.role === 'admin')
const roleLabels: Record<string, string> = { admin: '平台管理员', release_manager: '发布管理员', developer: '开发人员', viewer: '只读用户' }
const form = reactive({ name: '', provider: 'github', base_url: 'https://github.com', username: '', token: '', visible_roles: ['admin'] as string[] })
const providers = {
  github: { name: 'GitHub', defaultUrl: 'https://github.com', hint: 'Token 建议具备 repo 读取权限' },
  gitlab: { name: 'GitLab', defaultUrl: 'https://gitlab.com', hint: 'Token 至少需要 read_api、read_repository' },
  gitee: { name: 'Gitee 码云', defaultUrl: 'https://gitee.com', hint: '私人令牌需要 projects 读取权限' },
} as const

function providerName(key: string) { return providers[key as keyof typeof providers]?.name || key }
function providerHint(key: string) { return providers[key as keyof typeof providers]?.hint || '' }
function setProvider() { form.base_url = providers[form.provider as keyof typeof providers].defaultUrl }
function formatDate(value: string | null) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '尚未测试' }
async function load() {
  loading.value = true
  error.value = ''
  try { connections.value = (await api.get('/code-hosts')).data }
  catch (exception: any) { error.value = exception.response?.data?.detail || '代码托管连接加载失败' }
  finally { loading.value = false }
}
function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', provider: 'github', base_url: 'https://github.com', username: '', token: '', visible_roles: ['admin'] })
  error.value = ''; message.value = ''; showModal.value = true
}
function openEdit(item: CodeHostConnection) {
  editing.value = item
  Object.assign(form, { name: item.name, provider: item.provider, base_url: item.base_url, username: item.username, token: '', visible_roles: [...item.visible_roles] })
  error.value = ''; message.value = ''; showModal.value = true
}
async function save() {
  error.value = ''
  if (!form.name.trim() || !form.base_url.trim()) { error.value = '请填写连接名称和平台地址'; return }
  if (!editing.value && !form.token) { error.value = '首次创建必须填写访问令牌'; return }
  saving.value = true
  try {
    const result = editing.value ? await api.put(`/code-hosts/${editing.value.id}`, form) : await api.post('/code-hosts', form)
    showModal.value = false
    message.value = `连接“${result.data.name}”已保存，请执行连接测试`
    await load()
  } catch (exception: any) { error.value = exception.response?.data?.detail || '连接保存失败' }
  finally { saving.value = false }
}
async function test(item: CodeHostConnection) {
  testingId.value = item.id; error.value = ''; message.value = ''
  try {
    const { data } = await api.post(`/code-hosts/${item.id}/test`)
    if (data.success) message.value = data.message
    else error.value = data.message
    await load()
  } catch (exception: any) { error.value = exception.response?.data?.detail || '连接测试失败' }
  finally { testingId.value = null }
}
async function remove() {
  if (!deleteCandidate.value) return
  saving.value = true; error.value = ''
  try { await api.delete(`/code-hosts/${deleteCandidate.value.id}`); message.value = '代码托管连接已删除'; deleteCandidate.value = null; await load() }
  catch (exception: any) { error.value = exception.response?.data?.detail || '删除失败' }
  finally { saving.value = false }
}
onMounted(load)
</script>

<template>
  <div class="content compact code-host-page">
    <div class="hero-row"><div><div class="eyebrow">Source integrations</div><h1>代码托管</h1><p>集中接入 GitHub、GitLab 和 Gitee，项目可直接选择仓库并复用加密凭证。</p></div><div class="hero-actions"><button class="secondary-button" :disabled="loading" @click="load"><RefreshCw :class="{spin:loading}" />刷新</button><button v-if="canManage" class="primary-button" @click="openCreate"><Plus />新建连接</button></div></div>
    <section class="code-host-guide"><ShieldCheck /><div><strong>令牌只在后端加密保存</strong><span>页面不会回显 Token；仓库列表、分支识别和发布拉取均由后端完成。</span></div><span>支持公有云与私有 GitLab / GitHub Enterprise</span></section>
    <div v-if="message" class="inline-notice"><CheckCircle2 />{{ message }}<button @click="message=''">×</button></div><div v-if="error" class="settings-error">{{ error }}<button @click="error=''">×</button></div>
    <div class="code-host-grid">
      <article v-for="item in connections" :key="item.id" class="code-host-card">
        <div class="code-host-card-head"><span class="provider-logo" :class="item.provider"><GitFork /></span><div><strong>{{ item.name }}</strong><span>{{ providerName(item.provider) }} · {{ item.base_url }}</span></div><span class="connection-pill" :class="item.status"><CheckCircle2 v-if="item.status==='connected'" /><XCircle v-else-if="item.status==='failed'" />{{ item.status === 'connected' ? '已连接' : item.status === 'failed' ? '连接失败' : '待测试' }}</span></div>
        <div class="code-host-meta"><div><span>授权账号</span><strong>{{ item.account_name || item.username || '--' }}</strong></div><div><span>关联项目</span><strong>{{ item.project_count }} 个</strong></div><div><span>最后测试</span><strong>{{ formatDate(item.last_tested_at) }}</strong></div></div>
        <div v-if="item.status==='failed' && item.last_error" class="code-host-error"><XCircle />{{ item.last_error }}</div>
        <div class="code-host-card-foot"><small>可见角色：{{ item.visible_roles.map((role) => roleLabels[role] || role).join('、') }}</small><div v-if="canManage"><button class="secondary-button" :disabled="testingId===item.id" @click="test(item)"><LoaderCircle v-if="testingId===item.id" class="spin" /><CheckCircle2 v-else />测试连接</button><button class="icon-button" title="编辑" @click="openEdit(item)"><Pencil /></button><button class="icon-button delete-icon-button" title="删除" @click="deleteCandidate=item"><Trash2 /></button></div></div>
      </article>
      <div v-if="!loading && !connections.length" class="code-host-empty"><GitFork /><strong>还没有代码托管连接</strong><span>新建 GitHub、GitLab 或 Gitee 连接后，可在项目中直接选择仓库。</span><button v-if="canManage" class="primary-button" @click="openCreate"><Plus />新建第一个连接</button></div>
    </div>
    <ModalShell v-if="showModal" :title="editing?'编辑代码托管连接':'新建代码托管连接'" subtitle="使用 Personal Access Token 读取仓库和执行发布" size="small" @close="showModal=false"><div class="modal-body settings-modal-body"><div class="form-grid"><div class="form-field full"><label>连接名称 *</label><input v-model="form.name" placeholder="例如 公司 GitLab" /></div><div class="form-field full"><label>平台类型 *</label><select v-model="form.provider" @change="setProvider"><option value="github">GitHub</option><option value="gitlab">GitLab</option><option value="gitee">Gitee 码云</option></select></div><div class="form-field full"><label>平台地址 *</label><input v-model="form.base_url" placeholder="https://gitlab.example.com" /><small>私有部署请填写站点根地址，不要填写 API 路径。</small></div><div class="form-field full"><label>Git 用户名</label><input v-model="form.username" placeholder="可留空，连接测试后自动识别" /></div><div class="form-field full"><label>Personal Access Token {{ editing?'':'*' }}</label><input v-model="form.token" type="password" :placeholder="editing?'留空表示继续使用已保存令牌':'请输入访问令牌'" /><small>{{ providerHint(form.provider) }}</small></div><div v-if="isAdmin" class="form-field full"><label>谁可以看到并使用此连接</label><div class="role-visibility-grid"><label v-for="role in Object.keys(roleLabels)" :key="role" class="role-visibility-option"><input v-model="form.visible_roles" type="checkbox" :value="role" :disabled="role==='admin'" /><span><strong>{{ roleLabels[role] }}</strong><small>{{ role==='admin' ? '始终保留' : '可查看仓库并用于项目接入' }}</small></span></label></div><small>未勾选的角色不会看到此连接，也无法读取它的仓库。</small></div></div><span v-if="error" class="error-text">{{ error }}</span></div><div class="modal-foot"><button class="ghost-button" @click="showModal=false">取消</button><button class="primary-button" :disabled="saving" @click="save">{{ saving?'保存中...':'保存连接' }}</button></div></ModalShell>
    <ModalShell v-if="deleteCandidate" title="删除代码托管连接" subtitle="已绑定项目的连接不能删除" size="small" @close="deleteCandidate=null"><div class="modal-body delete-confirm-body"><div class="delete-warning-icon"><AlertTriangle /></div><div><strong>确认删除 {{ deleteCandidate.name }}？</strong><p>该连接当前关联 <b>{{ deleteCandidate.project_count }}</b> 个项目。删除后已保存的访问令牌不可恢复。</p><span v-if="error" class="error-text">{{ error }}</span></div></div><div class="modal-foot"><button class="ghost-button" @click="deleteCandidate=null">取消</button><button class="danger-button" :disabled="saving || deleteCandidate.project_count>0" @click="remove"><Trash2 />确认删除</button></div></ModalShell>
  </div>
</template>
