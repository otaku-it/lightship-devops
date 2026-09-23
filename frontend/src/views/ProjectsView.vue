<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AlertTriangle, CheckCircle2, Container, GitBranch, LoaderCircle, Pencil, Plus, Rocket, Server, ShieldCheck, Trash2, WandSparkles } from 'lucide-vue-next'
import { api } from '../api/client'
import ModalShell from '../components/ModalShell.vue'
import type { DeploymentTarget, Project } from '../types'

const projects = ref<Project[]>([])
const targets = ref<DeploymentTarget[]>([])
const filter = ref('all')
const search = ref('')
const showCreate = ref(false)
const editingId = ref<number | null>(null)
const deleteCandidate = ref<Project | null>(null)
const deleting = ref(false)
const deleteError = ref('')
const branches = ref<string[]>([])
const branchesLoading = ref(false)
const branchesMessage = ref('')
const saving = ref(false)
const error = ref('')
const router = useRouter()
const form = reactive({ name: '', description: '', project_type: 'java', repository_url: '', default_branch: 'main', build_command: './mvnw clean package', artifact_pattern: 'target/*.jar', health_path: '/actuator/health', deployment_mode: 'file', dockerfile_path: 'Dockerfile', docker_image_name: '', docker_container_port: 8080, docker_run_args: '', compose_file_path: 'docker-compose.yml', compose_project_name: '', git_username: '', git_token: '' })

const visible = computed(() => projects.value.filter((item) => (filter.value === 'all' || (filter.value === 'docker' ? item.deployment_mode === 'docker' : filter.value === 'compose' ? item.deployment_mode === 'compose' : item.project_type === filter.value)) && `${item.name}${item.description}`.toLowerCase().includes(search.value.toLowerCase())))
const templates: Record<string, Pick<typeof form, 'build_command' | 'artifact_pattern' | 'health_path'>> = {
  java: { build_command: './mvnw clean package', artifact_pattern: 'target/*.jar', health_path: '/actuator/health' },
  frontend: { build_command: 'npm ci && npm run build', artifact_pattern: 'dist/**', health_path: '/' },
  python: { build_command: 'pip wheel . -w dist', artifact_pattern: 'dist/*.whl', health_path: '/health' },
  fullstack: { build_command: '', artifact_pattern: '', health_path: '/health' },
}

async function load() {
  const [projectResult, targetResult] = await Promise.all([api.get('/projects'), api.get('/targets')])
  projects.value = projectResult.data
  targets.value = targetResult.data
}
function projectTargets(projectId: number) { return targets.value.filter((item) => item.project_id === projectId) }
function readyTargetCount(projectId: number) { return projectTargets(projectId).filter((item) => item.connection_type === 'ssh' && item.status === 'online' && item.credential_configured).length }
function configureTargets(projectId: number) { router.push(`/environments?project_id=${projectId}&create=1`) }
function releaseProject(projectId: number) { router.push(`/releases?create=1&project_id=${projectId}`) }
function applyTemplate() {
  Object.assign(form, templates[form.project_type])
  if (form.project_type === 'fullstack') form.deployment_mode = 'compose'
}
function openCreate() {
  editingId.value = null
  Object.assign(form, { name:'', description:'', project_type:'java', repository_url:'', default_branch:'main', deployment_mode:'file', dockerfile_path:'Dockerfile', docker_image_name:'', docker_container_port:8080, docker_run_args:'', compose_file_path:'docker-compose.yml', compose_project_name:'', git_username:'', git_token:'' })
  applyTemplate()
  branches.value = []
  branchesMessage.value = ''
  showCreate.value = true
}
function openDockerCreate() {
  openCreate()
  form.deployment_mode = 'docker'
}
function deploymentName(project: Project) { return project.deployment_mode === 'compose' ? 'Compose' : project.deployment_mode === 'docker' ? 'Docker' : '文件' }
function deploymentDetail(project: Project) { return project.deployment_mode === 'compose' ? `Compose: ${project.compose_file_path}` : project.deployment_mode === 'docker' ? `Dockerfile: ${project.dockerfile_path}` : project.credential_configured ? 'Git 凭证已配置' : '公开仓库 / 未配置凭证' }
function openEdit(project: Project) {
  editingId.value = project.id
  Object.assign(form, { ...project, git_token: '' })
  branches.value = []
  branchesMessage.value = ''
  showCreate.value = true
}
async function detectBranches() {
  branchesMessage.value = ''
  if (!form.repository_url.trim()) {
    branchesMessage.value = '请先填写 Git 仓库地址'
    return
  }
  branchesLoading.value = true
  try {
    const { data } = await api.post('/projects/branches', {
      project_id: editingId.value || undefined,
      repository_url: form.repository_url,
      git_username: form.git_username,
      git_token: form.git_token,
    })
    branches.value = data.branches
    if (data.default_branch) form.default_branch = data.default_branch
    branchesMessage.value = `已识别 ${data.branches.length} 个分支${data.default_branch ? `，默认分支：${data.default_branch}` : ''}`
  } catch (exception:any) {
    branches.value = []
    branchesMessage.value = exception.response?.data?.detail || '分支识别失败，请检查仓库地址和凭证'
  } finally {
    branchesLoading.value = false
  }
}
async function saveProject(configureAfterSave = false) {
  error.value = ''
  if (!form.name || !form.repository_url) { error.value = '请填写项目名称和 Git 仓库地址'; return }
  saving.value = true
  try {
    const { data } = editingId.value ? await api.put(`/projects/${editingId.value}`, form) : await api.post('/projects', form)
    showCreate.value = false
    await load()
    if (configureAfterSave) configureTargets(data.id)
  }
  catch (exception:any) { error.value = exception.response?.data?.detail || '项目创建失败' }
  finally { saving.value = false }
}
function requestDelete(project: Project) {
  deleteError.value = ''
  deleteCandidate.value = project
}
async function deleteProject() {
  if (!deleteCandidate.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await api.delete(`/projects/${deleteCandidate.value.id}`)
    deleteCandidate.value = null
    await load()
  } catch (exception:any) {
    deleteError.value = exception.response?.data?.detail || '项目删除失败'
  } finally {
    deleting.value = false
  }
}
onMounted(load)
</script>

<template>
  <div class="content compact">
    <div class="hero-row"><div><div class="eyebrow">Project registry</div><h1>项目与流水线</h1><p>单体项目可用文件或单容器发布，包含前后端、数据库等多个服务的工程可直接用 Docker Compose 发布。</p></div><div class="hero-actions"><button class="secondary-button docker-entry-button" @click="openDockerCreate"><Container />接入容器项目</button><button class="primary-button" @click="openCreate"><Plus />接入新项目</button></div></div>
    <section class="docker-capability-banner"><span class="docker-capability-icon"><Container /></span><div><strong>前后端一体化工程已支持</strong><p>选择 Docker Compose 后，平台会上传整个仓库，在服务器构建并更新全部服务；失败会自动恢复上一版。</p></div><span class="tiny-pill">真实执行</span></section>
    <div class="toolbar"><div class="filter-tabs"><button v-for="item in [{k:'all',n:'全部'},{k:'java',n:'Java'},{k:'frontend',n:'Frontend'},{k:'python',n:'Python'},{k:'docker',n:'Docker'},{k:'compose',n:'Compose'}]" :key="item.k" class="filter-tab" :class="{active:filter===item.k}" @click="filter=item.k">{{ item.n }}</button></div><div class="toolbar-spacer" /><input v-model="search" class="mini-search" placeholder="搜索项目" /><span class="tiny-pill">{{ visible.length }} 个项目</span></div>
    <div class="project-grid"><article v-for="project in visible" :key="project.id" class="project-card"><div class="project-card-top"><div class="project-glyph" :class="project.deployment_mode!=='file'?'docker':project.project_type">{{ project.deployment_mode==='compose'?'COMP':project.deployment_mode==='docker'?'DOCK':project.project_type.slice(0,4).toUpperCase() }}</div><div class="project-card-actions"><button class="secondary-button" @click="openEdit(project)"><Pencil />配置</button><button class="icon-button delete-icon-button" title="删除项目" aria-label="删除项目" @click="requestDelete(project)"><Trash2 /></button></div></div><h3>{{ project.name }}</h3><p>{{ project.description || '暂无项目描述' }}</p><div class="project-readiness" :class="{ready:readyTargetCount(project.id)>0}"><component :is="readyTargetCount(project.id)>0?CheckCircle2:Server" /><div><strong>{{ readyTargetCount(project.id)>0?'已具备发布条件':'还不能发布' }}</strong><span>{{ projectTargets(project.id).length ? `${projectTargets(project.id).length} 台服务器，${readyTargetCount(project.id)} 台可用` : '请先为项目配置目标服务器' }}</span></div></div><div class="project-card-stats"><div class="project-stat"><span>发布次数</span><strong>{{ project.release_count }}</strong></div><div class="project-stat"><span>成功率</span><strong>{{ project.release_count ? `${project.success_rate}%` : '--' }}</strong></div><div class="project-stat"><span>部署方式</span><strong>{{ deploymentName(project) }}</strong></div></div><div class="project-card-foot"><div class="branch"><GitBranch />{{ project.default_branch }}</div><div class="project-health"><i class="health-dot" :class="{warn:project.repository_url.startsWith('https')&&!project.credential_configured}" />{{ deploymentDetail(project) }}</div></div><div class="project-quick-actions"><button class="secondary-button" @click="configureTargets(project.id)"><Server />{{ projectTargets(project.id).length?'管理服务器':'配置服务器' }}</button><button class="primary-button" :disabled="!readyTargetCount(project.id)" @click="releaseProject(project.id)"><Rocket />发起发布</button></div></article></div>

    <ModalShell v-if="showCreate" :title="editingId?'配置项目':'接入新项目'" subtitle="发布时平台会真实拉取代码、执行构建并打包制品" @close="showCreate=false">
      <div class="project-config-scroll">
      <section class="project-source-section">
        <div class="project-form-section-head">
          <div><strong>项目与代码仓库</strong><span>先填写项目信息和 Git 仓库，再读取远程分支。</span></div>
          <span class="section-step">01</span>
        </div>
        <div class="project-source-grid">
          <div class="form-field full"><label>项目名称 *</label><input v-model="form.name" placeholder="例如 order-service" /></div>
          <div class="form-field"><label>工程类型</label><select v-model="form.project_type" @change="applyTemplate"><option value="fullstack">前后端一体化</option><option value="java">Java 后端</option><option value="frontend">前端工程</option><option value="python">Python 服务</option></select></div>
          <div class="form-field"><label>Git 仓库 *</label><input v-model="form.repository_url" placeholder="https://git.example.com/team/project.git" /></div>
          <div class="form-field"><label>Git 用户名（私有仓库）</label><input v-model="form.git_username" placeholder="公开仓库可留空" /></div>
          <div class="form-field"><label>Git Token / 密码</label><input v-model="form.git_token" type="password" :placeholder="editingId?'留空表示使用已保存凭证':'私有仓库填写'" /></div>
          <div class="form-field full branch-field"><label>默认分支 *</label><div class="branch-discovery-controls"><select v-if="branches.length" v-model="form.default_branch"><option v-for="branch in branches" :key="branch" :value="branch">{{ branch }}</option></select><input v-else v-model="form.default_branch" placeholder="例如 main；可手动填写" /><button type="button" class="secondary-button" :disabled="branchesLoading || !form.repository_url.trim()" @click="detectBranches"><LoaderCircle v-if="branchesLoading" class="spin" /><WandSparkles v-else />{{ branchesLoading ? '正在读取...' : '识别远程分支' }}</button></div><small v-if="branchesMessage" class="branch-message" :class="{error:branches.length===0 && !branchesLoading}">{{ branchesMessage }}</small><small v-else>识别失败时仍可手动填写分支名称。</small></div>
          <div class="security-note full compact-security-note"><ShieldCheck /><div><strong>Git 凭证加密保存</strong><span>凭证不会返回前端，也不会出现在发布日志中。</span></div></div>
        </div>
      </section>
      <div class="modal-body"><div class="form-grid"><div class="form-field full"><label>怎么部署</label><div class="deployment-mode-choice"><button type="button" :class="{active:form.deployment_mode==='file'}" @click="form.deployment_mode='file'">文件 / 进程</button><button type="button" :class="{active:form.deployment_mode==='docker'}" @click="form.deployment_mode='docker'"><Container />单个 Docker 容器</button><button type="button" :class="{active:form.deployment_mode==='compose'}" @click="form.deployment_mode='compose'"><Container />Docker Compose 多服务</button></div><small>工程同时包含前端、后端或其他服务时，建议选择 Docker Compose。</small></div><div class="form-field full"><label>项目说明</label><textarea v-model="form.description" /></div><template v-if="form.deployment_mode==='file'"><div class="form-field full"><label>构建命令</label><input v-model="form.build_command" /></div><div class="form-field"><label>构建产物路径（Glob）</label><input v-model="form.artifact_pattern" /></div><div class="form-field"><label>健康检查路径</label><input v-model="form.health_path" /></div></template><template v-else-if="form.deployment_mode==='docker'"><div class="form-field"><label>Dockerfile 路径 *</label><input v-model="form.dockerfile_path" placeholder="Dockerfile" /><small>相对于 Git 仓库根目录</small></div><div class="form-field"><label>容器内部端口 *</label><input v-model.number="form.docker_container_port" type="number" min="1" max="65535" /></div><div class="form-field full"><label>镜像名称（可选）</label><input v-model="form.docker_image_name" :placeholder="`lightship/${form.name || 'project'}`" /><small>留空由平台生成；每次发布自动追加版本标签</small></div><div class="form-field full"><label>docker run 附加参数（可选）</label><input v-model="form.docker_run_args" placeholder="--env-file /opt/app/app.env -v /data/app:/data" /><small>可配置环境变量、数据卷等；端口映射和重启策略由平台生成</small></div><div class="security-note full docker-note"><Container /><div><strong>镜像在目标服务器构建</strong><span>平台通过 SSH 上传构建上下文，执行 docker build 和 docker run；更新失败会恢复上一镜像。</span></div></div></template><template v-else><div class="form-field"><label>Compose 文件路径 *</label><input v-model="form.compose_file_path" placeholder="docker-compose.yml" /><small>相对于 Git 仓库根目录，例如 deploy/docker-compose.yml</small></div><div class="form-field"><label>Compose 项目名（可选）</label><input v-model="form.compose_project_name" :placeholder="`lightship-${form.name || 'project'}`" /><small>用于隔离容器、网络和数据卷；同一项目各版本应保持不变</small></div><div class="security-note full docker-note"><Container /><div><strong>整个工程作为一个发布单元</strong><span>平台会校验 Compose 配置、在目标服务器构建全部服务并执行 docker compose up。发布目录按版本保留，启动失败自动恢复上一版。</span></div></div></template><span v-if="error" class="error-text">{{ error }}</span></div></div>
      </div>
      <div class="modal-foot"><button class="ghost-button" @click="showCreate=false">取消</button><div class="modal-actions"><button class="secondary-button" :disabled="saving" @click="saveProject(false)">{{ saving ? '正在保存...' : '仅保存' }}</button><button class="primary-button" :disabled="saving" @click="saveProject(true)"><Server />{{ saving ? '正在保存...' : '保存并配置服务器' }}</button></div></div>
    </ModalShell>

    <ModalShell v-if="deleteCandidate" title="删除项目" subtitle="此操作不可恢复" size="small" @close="deleteCandidate=null">
      <div class="modal-body delete-confirm-body"><div class="delete-warning-icon"><AlertTriangle /></div><div><strong>确认删除 {{ deleteCandidate.name }}？</strong><p>将同时删除该项目的 <b>{{ deleteCandidate.release_count }}</b> 条发布记录、完整日志，以及 <b>{{ projectTargets(deleteCandidate.id).length }}</b> 台目标服务器配置。</p><span v-if="deleteError" class="error-text">{{ deleteError }}</span></div></div>
      <div class="modal-foot"><button class="ghost-button" :disabled="deleting" @click="deleteCandidate=null">取消</button><button class="danger-button" :disabled="deleting" @click="deleteProject"><Trash2 />{{ deleting?'正在删除...':'确认删除项目' }}</button></div>
    </ModalShell>
  </div>
</template>
