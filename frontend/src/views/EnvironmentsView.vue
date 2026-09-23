<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertTriangle, ArrowRight, Check, FolderKanban, KeyRound, Network, Pencil, Plus, RefreshCw, Server, ShieldCheck, Terminal, Trash2, Unplug } from 'lucide-vue-next'
import { api } from '../api/client'
import ModalShell from '../components/ModalShell.vue'
import type { DeploymentTarget, Environment, Project } from '../types'
import { parseApiDate } from '../utils/datetime'

const targets = ref<DeploymentTarget[]>([])
const environments = ref<Environment[]>([])
const projects = ref<Project[]>([])
const selectedProjectId = ref(0)
const selectedEnvironmentId = ref<number | null>(null)
const showCreate = ref(false)
const editingId = ref<number | null>(null)
const deleteCandidate = ref<DeploymentTarget | null>(null)
const deleting = ref(false)
const deleteError = ref('')
const step = ref(1)
const testingId = ref<number | null>(null)
const testingAll = ref(false)
const message = ref('')
const error = ref('')
const saving = ref(false)
const readyProjectId = ref<number | null>(null)
const route = useRoute()
const router = useRouter()
const form = reactive({ project_id: 0, environment_id: 0, name: '', connection_type: 'ssh', address: '', port: 22, username: 'deploy', auth_type: 'password', password: '', private_key: '', passphrase: '', host_key_fingerprint: '', trust_on_first_use: true, service_port: 8080, deploy_path: '/opt/apps/{project}/releases/{version}', start_command: 'systemctl restart {project}', health_check_command: 'curl --fail http://127.0.0.1:{service_port}/health' })
const projectTargets = computed(() => selectedProjectId.value
  ? targets.value.filter((item) => item.project_id === selectedProjectId.value)
  : targets.value)
const online = computed(() => projectTargets.value.filter((item) => item.status === 'online').length)
const visibleTargets = computed(() => selectedEnvironmentId.value === null
  ? projectTargets.value
  : projectTargets.value.filter((item) => item.environment_id === selectedEnvironmentId.value))
const selectedEnvironment = computed(() => environments.value.find((item) => item.id === selectedEnvironmentId.value))
const selectedProject = computed(() => projects.value.find((item) => item.id === selectedProjectId.value))
const formProject = computed(() => projects.value.find((item) => item.id === Number(form.project_id)))

function environmentStatus(environment: Environment) {
  const items = projectTargets.value.filter((item) => item.environment_id === environment.id)
  return { total: items.length, online: items.filter((item) => item.status === 'online').length }
}

function applyProjectTargetDefaults() {
  if (editingId.value) return
  const project = projects.value.find((item) => item.id === Number(form.project_id))
  if (project) {
    form.health_check_command = `curl --fail http://127.0.0.1:{service_port}${project.health_path || '/health'}`
    if (project.deployment_mode === 'docker') form.service_port = project.docker_container_port
  }
}

async function load() {
  const [targetResult, environmentResult, projectResult] = await Promise.all([api.get('/targets'), api.get('/environments'), api.get('/projects')])
  targets.value = targetResult.data
  environments.value = environmentResult.data
  projects.value = projectResult.data
  if (!form.environment_id && environments.value.length) form.environment_id = environments.value.at(-1)!.id
  if (!form.project_id && projects.value.length) form.project_id = projects.value[0].id
}
function openCreate() {
  editingId.value = null
  Object.assign(form, { name:'', connection_type:'ssh', address:'', port:22, username:'deploy', auth_type:'password', password:'', private_key:'', passphrase:'', host_key_fingerprint:'', trust_on_first_use:true, service_port:8080, deploy_path:'/opt/apps/{project}/releases/{version}', start_command:'systemctl restart {project}', health_check_command:'curl --fail http://127.0.0.1:{service_port}/health' })
  if (environments.value.length) form.environment_id = environments.value.at(-1)!.id
  form.project_id = selectedProjectId.value || projects.value[0]?.id || 0
  applyProjectTargetDefaults()
  step.value = 2; error.value = ''; message.value = ''; readyProjectId.value = null; showCreate.value = true
}
function openEdit(target: DeploymentTarget) {
  editingId.value = target.id
  Object.assign(form, { ...target, password:'', private_key:'', passphrase:'' })
  step.value = 2; error.value = ''; message.value = ''; showCreate.value = true
}
async function testTarget(target: DeploymentTarget) {
  testingId.value = target.id; message.value = ''
  try { const { data } = await api.post(`/targets/${target.id}/test`, {}); message.value = `${target.name}：${data.message}，延迟 ${data.latency_ms} ms`; await load() }
  catch (exception:any) { message.value = exception.response?.data?.detail || '连接测试失败' }
  finally { testingId.value = null }
}
async function testVisibleTargets() {
  if (!visibleTargets.value.length) return
  testingAll.value = true
  let passed = 0
  const failures: string[] = []
  for (const target of visibleTargets.value) {
    testingId.value = target.id
    try {
      const { data } = await api.post(`/targets/${target.id}/test`, {})
      if (data.success) passed += 1
      else failures.push(target.name)
    } catch {
      failures.push(target.name)
    }
  }
  testingId.value = null
  testingAll.value = false
  message.value = `连接检查完成：${passed} 台通过，${failures.length} 台失败${failures.length ? `（${failures.join('、')}）` : ''}`
  await load()
}
async function saveTarget() {
  error.value = ''
  if (!form.project_id) { error.value = '请选择这台服务器用于哪个项目'; return }
  if (!form.name || !form.address) { error.value = '请填写服务器名称和 IP / 域名'; return }
  saving.value = true
  try {
    const { data } = editingId.value ? await api.put(`/targets/${editingId.value}`, form) : await api.post('/targets', form)
    editingId.value = data.id
    const test = (await api.post(`/targets/${data.id}/test`, {})).data
    if (!test.success) { error.value = test.message; await load(); return }
    showCreate.value = false
    message.value = `${data.name} 已保存并通过真实 SSH 连接测试，指纹 ${test.host_key_fingerprint}`
    readyProjectId.value = data.project_id
    await router.replace(`/environments?project_id=${data.project_id}`)
    await load()
  } catch (exception:any) { error.value = exception.response?.data?.detail || '目标服务器保存失败' }
  finally { saving.value = false }
}
function requestDelete(target: DeploymentTarget) {
  deleteError.value = ''
  deleteCandidate.value = target
}
async function deleteTarget() {
  if (!deleteCandidate.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await api.delete(`/targets/${deleteCandidate.value.id}`)
    deleteCandidate.value = null
    await load()
  } catch (exception:any) {
    deleteError.value = exception.response?.data?.detail || '目标服务器删除失败'
  } finally {
    deleting.value = false
  }
}
function goRelease() {
  if (readyProjectId.value) router.push(`/releases?create=1&project_id=${readyProjectId.value}`)
}
onMounted(async () => {
  await load()
  const projectId = Number(route.query.project_id || 0)
  if (projects.value.some((item) => item.id === projectId)) {
    selectedProjectId.value = projectId
    form.project_id = projectId
  }
  if (route.query.create) openCreate()
})
</script>

<template>
  <div class="content compact">
    <div class="hero-row"><div><div class="eyebrow">Release environments</div><h1>发布环境</h1><p>把服务器按测试、预发、生产分组；发起发布时选择一个环境，平台会发布到该组服务器。</p></div><button class="primary-button" @click="openCreate"><Plus />{{ selectedProject?`为 ${selectedProject.name} 添加服务器`:'添加目标服务器' }}</button></div>

    <section class="environment-explainer">
      <div><span class="explain-icon"><FolderKanban /></span><strong>项目</strong><small>要发布哪个应用</small></div>
      <ArrowRight />
      <div><span class="explain-number">环境</span><strong>测试 / 预发 / 生产</strong><small>决定发布到哪一组</small></div>
      <ArrowRight />
      <div><span class="explain-icon"><Server /></span><strong>目标服务器</strong><small>真正接收并运行应用</small></div>
      <p><b>例：</b>发布“订单服务”到“生产环境”，只会操作订单服务在生产环境下绑定的服务器，不会碰其他项目。</p>
    </section>

    <div class="project-scope"><div><strong>先选择项目</strong><span>下面只显示这个项目在各环境中的服务器</span></div><select v-model.number="selectedProjectId" @change="selectedEnvironmentId=null"><option :value="0">所有项目（管理视图）</option><option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option></select><span v-if="selectedProject" class="scope-result">当前查看：{{ selectedProject.name }}</span></div>

    <div class="environment-summary">
      <button class="environment-summary-card all" :class="{active:selectedEnvironmentId===null}" @click="selectedEnvironmentId=null">
        <span>全部环境</span><strong>{{ projectTargets.length }}</strong><small>{{ online }} 台连接正常</small>
      </button>
      <button v-for="environment in environments" :key="environment.id" class="environment-summary-card" :class="{active:selectedEnvironmentId===environment.id}" @click="selectedEnvironmentId=environment.id">
        <span>{{ environment.name }}</span><strong>{{ environmentStatus(environment).total }}</strong><small>{{ environmentStatus(environment).online }} 台在线 · {{ environment.release_window }}</small>
      </button>
    </div>
    <div v-if="message" class="inline-notice"><Check />{{ message }}<button v-if="readyProjectId" class="notice-action" @click="goRelease">立即发起发布</button><button @click="message=''">×</button></div>
    <div class="toolbar environment-toolbar"><div><strong class="server-list-title">{{ selectedProject?.name || '所有项目' }} · {{ selectedEnvironment?.name || '全部环境' }}</strong><span class="server-list-tip">每条记录表示“某个项目在某个环境中的一台目标服务器”</span></div><div class="toolbar-spacer" /><button class="secondary-button" :disabled="testingAll||!visibleTargets.length" @click="testVisibleTargets"><Terminal />{{ testingAll?'正在逐台测试...':'测试当前列表' }}</button><button class="secondary-button" @click="load"><RefreshCw />刷新状态</button></div>
    <section class="panel target-table"><div class="target-table-head"><span>服务器</span><span>项目 / 环境</span><span>连接方式</span><span>连接状态</span><span>操作系统</span><span /></div><div v-for="target in visibleTargets" :key="target.id" class="target-row"><div class="target-name"><div class="method-icon" :class="target.connection_type"><component :is="target.connection_type==='ssh'?Terminal:target.connection_type==='kubernetes'?Network:Unplug" /></div><div><strong>{{ target.name }}</strong><span>{{ target.address }}:{{ target.port }} · 应用端口 {{ target.service_port }}</span></div></div><div><strong class="target-env">{{ target.project_name || '未绑定项目' }}</strong><span class="target-workload">{{ target.environment_name }}</span></div><div><span class="method-pill">{{ target.connection_type.toUpperCase() }}</span></div><div><span class="connection-status" :class="target.status"><i />{{ target.status==='online'?'连接正常':target.status==='offline'?'连接失败':'尚未测试' }}</span></div><div><span class="target-workload">{{ target.system_info || '等待连接后探测' }}</span></div><div class="target-actions"><button class="secondary-button" @click="openEdit(target)"><Pencil />配置</button><button class="secondary-button" :disabled="testingId===target.id" @click="testTarget(target)">{{ testingId===target.id?'测试中...':'测试连接' }}</button><button class="icon-button delete-icon-button" title="删除服务器" aria-label="删除服务器" @click="requestDelete(target)"><Trash2 /></button></div></div><div v-if="!visibleTargets.length" class="list-empty">这个项目在该环境还没有服务器，点击“添加目标服务器”开始接入。</div></section>

    <ModalShell v-if="showCreate" :title="editingId?'配置目标服务器':'添加目标服务器'" subtitle="目标服务器是最终接收制品并运行应用的真实机器" @close="showCreate=false">
      <div class="stepper"><div v-for="(name,index) in ['连接方式','连接配置','部署模板']" :key="name" class="step" :class="{active:step===index+1,done:step>index+1}"><span class="step-index">{{ step>index+1?'✓':index+1 }}</span>{{ name }}</div></div>
      <div class="modal-body target-modal-body">
        <div v-if="step===1"><div class="method-choice-grid"><button v-for="method in [{key:'ssh',title:'SSH 直连',icon:Terminal,desc:'当前已支持：上传制品、切换版本、重启、健康检查与单机失败回滚。',enabled:true},{key:'agent',title:'轻量 Agent',icon:Unplug,desc:'规划中，暂不能执行真实发布。',enabled:false},{key:'kubernetes',title:'Kubernetes',icon:Network,desc:'规划中，暂不能执行真实发布。',enabled:false}]" :key="method.key" class="method-choice" :class="{selected:form.connection_type===method.key,disabled:!method.enabled}" :disabled="!method.enabled" @click="form.connection_type=method.key"><div class="method-choice-top"><span class="method-choice-icon"><component :is="method.icon" /></span><span class="tiny-pill">{{ method.enabled?'真实可用':'待实现' }}</span></div><strong>{{ method.title }}</strong><p>{{ method.desc }}</p><span class="choice-radio"><Check v-if="form.connection_type===method.key" /></span></button></div><div class="security-note"><ShieldCheck /><div><strong>凭证加密保存，服务器指纹固定</strong><span>首次连接可采用 TOFU 保存 SHA-256 指纹，之后指纹变化会拒绝连接。建议使用低权限 deploy 账号。</span></div></div></div>
        <div v-if="step===2" class="form-grid"><div class="form-field"><label>用于哪个项目 *</label><select v-model="form.project_id" @change="applyProjectTargetDefaults"><option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }} · {{ project.deployment_mode==='docker'?'Docker':'文件部署' }}</option></select></div><div class="form-field"><label>放入哪个环境 *</label><select v-model="form.environment_id"><option v-for="env in environments" :key="env.id" :value="env.id">{{ env.name }}</option></select></div><div class="form-field"><label>服务器名称 *</label><input v-model="form.name" placeholder="例如：prod-app-01" /></div><div class="form-field"><label>服务器 IP / 域名 *</label><input v-model="form.address" placeholder="192.168.1.10" /></div><div class="form-field"><label>SSH 端口</label><input v-model.number="form.port" /></div><div class="form-field"><label>SSH 登录用户</label><input v-model="form.username" /></div><div class="form-field full"><label>{{ formProject?.deployment_mode==='docker'?'宿主机映射端口':'应用监听端口' }}</label><input v-model.number="form.service_port" /></div><div class="form-field full"><label>SSH 认证方式</label><select v-model="form.auth_type"><option value="password">密码</option><option value="private_key">SSH 私钥</option></select></div><div v-if="form.auth_type==='password'" class="form-field full"><label>SSH 密码</label><input v-model="form.password" type="password" :placeholder="editingId?'留空表示不修改':'请输入 SSH 密码'" /></div><template v-else><div class="form-field full"><label>SSH 私钥</label><textarea v-model="form.private_key" rows="6" :placeholder="editingId?'留空表示不修改':'粘贴 OpenSSH / PEM 私钥'" /></div><div class="form-field full"><label>私钥口令（可选）</label><input v-model="form.passphrase" type="password" /></div></template><div class="form-field full"><label>服务器 SHA-256 指纹</label><input v-model="form.host_key_fingerprint" placeholder="首次可留空，连接成功后自动保存" /></div><label class="check-field full"><input v-model="form.trust_on_first_use" type="checkbox" />首次连接时信任并固定服务器指纹</label><div class="security-note full"><KeyRound /><div><strong>已有凭证不会回显</strong><span>编辑服务器时密码或私钥留空表示保持原凭证不变。</span></div></div></div>
        <div v-if="step===3" class="form-grid"><template v-if="formProject?.deployment_mode==='docker'"><div class="security-note full docker-note"><Server /><div><strong>Docker 部署到这台服务器</strong><span>宿主机端口 {{ form.service_port }} 将映射到容器端口 {{ formProject.docker_container_port }}。保存测试时会同时检查 Docker Engine 和当前 SSH 用户权限。</span></div></div><div class="form-field full"><label>容器健康检查命令</label><input v-model="form.health_check_command" placeholder="curl --fail http://127.0.0.1:{service_port}/health" /><small>支持：&#123;service_port&#125;、&#123;container_port&#125;、&#123;container_name&#125;、&#123;image&#125;</small></div></template><template v-else><div class="form-field full"><label>版本部署目录</label><input v-model="form.deploy_path" /><small>支持：&#123;project&#125;、&#123;version&#125;、&#123;release_no&#125;</small></div><div class="form-field full"><label>启动 / 重启命令</label><input v-model="form.start_command" /><small>支持：&#123;current_path&#125;、&#123;deploy_path&#125;、&#123;service_port&#125;</small></div><div class="form-field full"><label>健康检查命令</label><input v-model="form.health_check_command" /></div><div class="security-note full"><Server /><div><strong>保存后执行真实 SSH 测试</strong><span>发布时会上传制品、切换 current 软链接、执行启动命令和健康检查；失败时回切上一版本。</span></div></div></template></div>
        <span v-if="error" class="error-text target-error">{{ error }}</span>
      </div>
      <div class="modal-foot"><button class="ghost-button" @click="step===1?showCreate=false:step--">{{ step===1?'取消':'上一步' }}</button><button v-if="step<3" class="primary-button" @click="step++">下一步</button><button v-else class="primary-button" :disabled="saving" @click="saveTarget">{{ saving?'保存并测试中...':'保存并测试真实连接' }}</button></div>
    </ModalShell>

    <ModalShell v-if="deleteCandidate" title="删除目标服务器" subtitle="只删除平台配置，不会登录或清理服务器" size="small" @close="deleteCandidate=null">
      <div class="modal-body delete-confirm-body"><div class="delete-warning-icon"><AlertTriangle /></div><div><strong>确认删除 {{ deleteCandidate.name }}？</strong><p>将移除 {{ deleteCandidate.project_name }} 在 {{ deleteCandidate.environment_name }} 中的服务器连接和加密凭证，不会停止目标服务器上已运行的应用。</p><span v-if="deleteError" class="error-text">{{ deleteError }}</span></div></div>
      <div class="modal-foot"><button class="ghost-button" :disabled="deleting" @click="deleteCandidate=null">取消</button><button class="danger-button" :disabled="deleting" @click="deleteTarget"><Trash2 />{{ deleting?'正在删除...':'确认删除服务器' }}</button></div>
    </ModalShell>
  </div>
</template>
