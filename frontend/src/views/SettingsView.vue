<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { KeyRound, LockKeyhole, Pencil, RefreshCw, Save, ShieldCheck, UserPlus, Users } from 'lucide-vue-next'
import { api } from '../api/client'
import { useAuthStore } from '../stores/auth'
import ModalShell from '../components/ModalShell.vue'

interface UserRecord { id: number; username: string; display_name: string; role: string; is_active: boolean; created_at: string }
interface PlatformSettings { executor_mode: string; build_timeout_seconds: number; ssh_command_timeout_seconds: number; health_check_retries: number; auto_rollback: boolean; max_build_log_lines: number }
const auth = useAuthStore()
const users = ref<UserRecord[]>([])
const activeTab = ref<'account' | 'users' | 'release'>('account')
const loading = ref(false)
const saving = ref(false)
const message = ref('')
const error = ref('')
const showUserModal = ref(false)
const editingUser = ref<UserRecord | null>(null)
const showResetModal = ref(false)
const resetUser = ref<UserRecord | null>(null)
const passwordForm = reactive({ current_password: '', new_password: '', confirm_password: '' })
const userForm = reactive({ username: '', display_name: '', password: '', role: 'developer' })
const resetForm = reactive({ new_password: '', confirm_password: '' })
const platformForm = reactive<PlatformSettings>({ executor_mode: 'real', build_timeout_seconds: 900, ssh_command_timeout_seconds: 120, health_check_retries: 10, auto_rollback: true, max_build_log_lines: 500 })
const isAdmin = computed(() => auth.role === 'admin')
const roleLabels: Record<string, string> = { admin: '平台管理员', release_manager: '发布管理员', developer: '开发人员', viewer: '只读用户' }

function clearFeedback() { message.value = ''; error.value = '' }
function roleLabel(role: string) { return roleLabels[role] || role }
function formatDate(value: string) { return new Date(value).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }) }
async function loadUsers() {
  if (!isAdmin.value) return
  loading.value = true
  try { users.value = (await api.get('/auth/users')).data } catch (exception: any) { error.value = exception.response?.data?.detail || '用户列表加载失败' } finally { loading.value = false }
}
async function loadPlatformSettings() {
  try { Object.assign(platformForm, (await api.get('/platform/settings')).data) }
  catch (exception: any) { error.value = exception.response?.data?.detail || '发布设置加载失败' }
}
async function savePlatformSettings() {
  clearFeedback()
  saving.value = true
  try {
    Object.assign(platformForm, (await api.put('/platform/settings', platformForm)).data)
    message.value = '发布设置已保存，将对之后创建的发布任务生效'
  } catch (exception: any) { error.value = exception.response?.data?.detail || '发布设置保存失败' }
  finally { saving.value = false }
}
async function changePassword() {
  clearFeedback()
  if (passwordForm.new_password.length < 8) { error.value = '新密码至少需要 8 位'; return }
  if (passwordForm.new_password !== passwordForm.confirm_password) { error.value = '两次输入的新密码不一致'; return }
  saving.value = true
  try {
    const { data } = await api.post('/auth/change-password', { current_password: passwordForm.current_password, new_password: passwordForm.new_password })
    message.value = data.message
    Object.assign(passwordForm, { current_password: '', new_password: '', confirm_password: '' })
  } catch (exception: any) { error.value = exception.response?.data?.detail || '密码修改失败' } finally { saving.value = false }
}
function openCreateUser() {
  editingUser.value = null
  Object.assign(userForm, { username: '', display_name: '', password: '', role: 'developer' })
  clearFeedback(); showUserModal.value = true
}
function openEditUser(user: UserRecord) {
  editingUser.value = user
  Object.assign(userForm, { username: user.username, display_name: user.display_name, password: '', role: user.role })
  clearFeedback(); showUserModal.value = true
}
async function saveUser() {
  clearFeedback()
  if (!userForm.display_name.trim()) { error.value = '请填写显示名称'; return }
  if (!editingUser.value && userForm.password.length < 8) { error.value = '初始密码至少需要 8 位'; return }
  saving.value = true
  try {
    if (editingUser.value) await api.patch(`/auth/users/${editingUser.value.id}`, { display_name: userForm.display_name, role: userForm.role, is_active: editingUser.value.is_active })
    else await api.post('/auth/users', userForm)
    showUserModal.value = false
    message.value = editingUser.value ? '用户信息已更新' : '用户创建成功'
    await loadUsers()
  } catch (exception: any) { error.value = exception.response?.data?.detail || '用户保存失败' } finally { saving.value = false }
}
async function toggleUser(user: UserRecord) {
  clearFeedback()
  try { await api.patch(`/auth/users/${user.id}`, { display_name: user.display_name, role: user.role, is_active: !user.is_active }); message.value = `${user.username} 已${user.is_active ? '禁用' : '启用'}`; await loadUsers() }
  catch (exception: any) { error.value = exception.response?.data?.detail || '用户状态更新失败' }
}
function openReset(user: UserRecord) { resetUser.value = user; Object.assign(resetForm, { new_password: '', confirm_password: '' }); clearFeedback(); showResetModal.value = true }
async function resetPassword() {
  clearFeedback()
  if (resetForm.new_password.length < 8) { error.value = '新密码至少需要 8 位'; return }
  if (resetForm.new_password !== resetForm.confirm_password) { error.value = '两次输入的新密码不一致'; return }
  saving.value = true
  try { const { data } = await api.post(`/auth/users/${resetUser.value?.id}/reset-password`, { new_password: resetForm.new_password }); showResetModal.value = false; message.value = data.message }
  catch (exception: any) { error.value = exception.response?.data?.detail || '密码重置失败' } finally { saving.value = false }
}
onMounted(() => { loadUsers(); loadPlatformSettings() })
</script>

<template>
  <div class="content compact settings-page">
    <div class="hero-row"><div><div class="eyebrow">Platform administration</div><h1>平台设置</h1><p>管理登录账号、发布规则和平台级安全策略。项目和目标服务器的配置仍在各自页面维护。</p></div><button v-if="isAdmin && activeTab==='users'" class="primary-button" @click="openCreateUser"><UserPlus />新建用户</button></div>
    <div class="settings-tabs"><button :class="{active:activeTab==='account'}" @click="activeTab='account'"><KeyRound />我的账号</button><button v-if="isAdmin" :class="{active:activeTab==='users'}" @click="activeTab='users'"><Users />用户与权限</button><button :class="{active:activeTab==='release'}" @click="activeTab='release'"><ShieldCheck />发布设置</button></div>
    <div v-if="message" class="inline-notice"><ShieldCheck />{{ message }}<button @click="message=''">×</button></div><div v-if="error" class="settings-error">{{ error }}<button @click="error=''">×</button></div>
    <section v-if="activeTab==='account'" class="settings-grid"><article class="settings-panel"><div class="settings-panel-head"><div><strong>当前账号</strong><span>用于登录和操作审计</span></div><span class="role-badge">{{ roleLabel(auth.role) }}</span></div><div class="account-summary"><div class="avatar large">{{ auth.displayName.slice(0,2).toUpperCase() }}</div><div><strong>{{ auth.displayName }}</strong><span>{{ auth.role }} · 当前已登录</span></div></div></article><article class="settings-panel"><div class="settings-panel-head"><div><strong>修改登录密码</strong><span>修改后当前登录令牌仍然有效，下次登录请使用新密码</span></div><LockKeyhole /></div><form class="settings-form" @submit.prevent="changePassword"><label>当前密码<input v-model="passwordForm.current_password" type="password" autocomplete="current-password" /></label><label>新密码<input v-model="passwordForm.new_password" type="password" autocomplete="new-password" placeholder="至少 8 位" /></label><label>确认新密码<input v-model="passwordForm.confirm_password" type="password" autocomplete="new-password" /></label><button class="primary-button" :disabled="saving"><LockKeyhole />{{ saving ? '保存中...' : '修改密码' }}</button></form></article></section>
    <section v-else-if="activeTab==='users'" class="settings-panel"><div class="settings-panel-head"><div><strong>用户与权限</strong><span>禁用用户后无法继续登录，已有发布任务不会被中断</span></div><button class="secondary-button" :disabled="loading" @click="loadUsers"><RefreshCw :class="{spin:loading}" />刷新</button></div><div class="user-table"><div class="user-table-head"><span>用户</span><span>角色</span><span>状态</span><span>创建时间</span><span>操作</span></div><div v-for="user in users" :key="user.id" class="user-row-item"><div><strong>{{ user.display_name }}</strong><span>{{ user.username }}</span></div><span class="role-badge">{{ roleLabel(user.role) }}</span><span class="user-status" :class="{disabled:!user.is_active}"><i />{{ user.is_active ? '启用' : '已禁用' }}</span><span class="user-date">{{ formatDate(user.created_at) }}</span><div class="user-actions"><button class="icon-text-button" @click="openEditUser(user)"><Pencil />编辑</button><button class="icon-text-button" @click="openReset(user)"><LockKeyhole />重置密码</button><button class="icon-text-button" @click="toggleUser(user)">{{ user.is_active ? '禁用' : '启用' }}</button></div></div><div v-if="!users.length" class="list-empty">暂无用户</div></div></section>
    <section v-else class="settings-grid release-settings-grid">
      <article class="settings-panel">
        <div class="settings-panel-head"><div><strong>发布执行策略</strong><span>保存后对之后创建的真实发布任务生效</span></div><ShieldCheck /></div>
        <form class="settings-form release-settings-form" @submit.prevent="savePlatformSettings">
          <label>执行模式<input :value="platformForm.executor_mode === 'real' ? '真实执行（real）' : '模拟执行（mock）'" disabled /><small>安全起见只能通过 EXECUTOR_MODE 环境变量修改，修改后需重启后端。</small></label>
          <div class="settings-form-columns">
            <label>本地构建超时（秒）<input v-model.number="platformForm.build_timeout_seconds" type="number" min="60" max="86400" :disabled="!isAdmin" /><small>代码拉取、构建及远程镜像构建的最长等待时间。</small></label>
            <label>SSH 命令超时（秒）<input v-model.number="platformForm.ssh_command_timeout_seconds" type="number" min="10" max="7200" :disabled="!isAdmin" /><small>普通远程命令无响应时的最大等待时间。</small></label>
            <label>健康检查重试次数<input v-model.number="platformForm.health_check_retries" type="number" min="1" max="20" :disabled="!isAdmin" /><small>每次失败间隔约 2 秒，适合启动较慢的服务。</small></label>
            <label>最大构建日志行数<input v-model.number="platformForm.max_build_log_lines" type="number" min="100" max="10000" :disabled="!isAdmin" /><small>超过限制的构建输出会截断，避免日志页面卡顿。</small></label>
          </div>
          <label class="settings-switch-row"><span><strong>失败自动回滚</strong><small>文件部署、Docker 和 Compose 发布失败时恢复上一可用版本。</small></span><input v-model="platformForm.auto_rollback" type="checkbox" :disabled="!isAdmin" /></label>
          <button v-if="isAdmin" class="primary-button" :disabled="saving"><Save />{{ saving ? '保存中...' : '保存发布设置' }}</button>
          <small v-else class="settings-readonly-note">当前账号只有查看权限，平台管理员可以修改这些全局参数。</small>
        </form>
      </article>
      <article class="settings-panel">
        <div class="settings-panel-head"><div><strong>参数影响范围</strong><span>便于判断应该在平台、项目还是服务器上调整</span></div></div>
        <div class="settings-info-list"><div><strong>平台级参数</strong><span>超时、日志上限、重试和回滚策略由这里统一管理。</span></div><div><strong>项目级参数</strong><span>代码仓库、构建命令、制品规则、Dockerfile 与 Compose 文件在项目中维护。</span></div><div><strong>服务器级参数</strong><span>SSH 凭证、部署目录、启动停止命令和健康检查命令在目标服务器中维护。</span></div></div>
        <div class="settings-effective-note"><ShieldCheck /><span><strong>已接入真实执行链路</strong>保存的参数会在发布开始时读取，正在运行的任务不会被中途改变。</span></div>
      </article>
    </section>
    <ModalShell v-if="showUserModal" :title="editingUser ? '编辑用户' : '新建用户'" subtitle="用户可以登录平台，具体发布权限由角色决定" size="small" @close="showUserModal=false"><div class="modal-body settings-modal-body"><div class="form-grid"><div v-if="!editingUser" class="form-field full"><label>用户名 *</label><input v-model="userForm.username" placeholder="例如 zhangsan" /></div><div class="form-field full"><label>显示名称 *</label><input v-model="userForm.display_name" placeholder="例如 张三" /></div><div v-if="!editingUser" class="form-field full"><label>初始密码 *</label><input v-model="userForm.password" type="password" placeholder="至少 8 位" /></div><div class="form-field full"><label>角色 *</label><select v-model="userForm.role"><option value="admin">平台管理员</option><option value="release_manager">发布管理员</option><option value="developer">开发人员</option><option value="viewer">只读用户</option></select></div></div><span v-if="error" class="error-text">{{ error }}</span></div><div class="modal-foot"><button class="ghost-button" @click="showUserModal=false">取消</button><button class="primary-button" :disabled="saving" @click="saveUser">{{ saving ? '保存中...' : '保存用户' }}</button></div></ModalShell>
    <ModalShell v-if="showResetModal" title="重置用户密码" :subtitle="`为 ${resetUser?.display_name} 设置新密码`" size="small" @close="showResetModal=false"><div class="modal-body settings-modal-body"><div class="form-grid"><div class="form-field full"><label>新密码 *</label><input v-model="resetForm.new_password" type="password" placeholder="至少 8 位" /></div><div class="form-field full"><label>确认新密码 *</label><input v-model="resetForm.confirm_password" type="password" /></div></div><span v-if="error" class="error-text">{{ error }}</span></div><div class="modal-foot"><button class="ghost-button" @click="showResetModal=false">取消</button><button class="primary-button" :disabled="saving" @click="resetPassword">重置密码</button></div></ModalShell>
  </div>
</template>
