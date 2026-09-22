<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CheckCircle2, Container, GitBranch, Pencil, Plus, Rocket, Server, ShieldCheck } from 'lucide-vue-next'
import { api } from '../api/client'
import ModalShell from '../components/ModalShell.vue'
import type { DeploymentTarget, Project } from '../types'

const projects = ref<Project[]>([])
const targets = ref<DeploymentTarget[]>([])
const filter = ref('all')
const search = ref('')
const showCreate = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const error = ref('')
const router = useRouter()
const form = reactive({ name: '', description: '', project_type: 'java', repository_url: '', default_branch: 'main', build_command: './mvnw clean package', artifact_pattern: 'target/*.jar', health_path: '/actuator/health', deployment_mode: 'file', dockerfile_path: 'Dockerfile', docker_image_name: '', docker_container_port: 8080, docker_run_args: '', git_username: '', git_token: '' })

const visible = computed(() => projects.value.filter((item) => (filter.value === 'all' || (filter.value === 'docker' ? item.deployment_mode === 'docker' : item.project_type === filter.value)) && `${item.name}${item.description}`.toLowerCase().includes(search.value.toLowerCase())))
const templates: Record<string, Pick<typeof form, 'build_command' | 'artifact_pattern' | 'health_path'>> = {
  java: { build_command: './mvnw clean package', artifact_pattern: 'target/*.jar', health_path: '/actuator/health' },
  frontend: { build_command: 'npm ci && npm run build', artifact_pattern: 'dist/**', health_path: '/' },
  python: { build_command: 'pip wheel . -w dist', artifact_pattern: 'dist/*.whl', health_path: '/health' },
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
function applyTemplate() { Object.assign(form, templates[form.project_type]) }
function openCreate() {
  editingId.value = null
  Object.assign(form, { name:'', description:'', project_type:'java', repository_url:'', default_branch:'main', deployment_mode:'file', dockerfile_path:'Dockerfile', docker_image_name:'', docker_container_port:8080, docker_run_args:'', git_username:'', git_token:'' })
  applyTemplate()
  showCreate.value = true
}
function openDockerCreate() {
  openCreate()
  form.deployment_mode = 'docker'
}
function openEdit(project: Project) {
  editingId.value = project.id
  Object.assign(form, { ...project, git_token: '' })
  showCreate.value = true
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
onMounted(load)
</script>

<template>
  <div class="content compact">
    <div class="hero-row"><div><div class="eyebrow">Project registry</div><h1>项目与流水线</h1><p>支持 Java、前端、Python 的文件发布，也支持基于 Dockerfile 的真实容器部署。</p></div><div class="hero-actions"><button class="secondary-button docker-entry-button" @click="openDockerCreate"><Container />接入 Docker 项目</button><button class="primary-button" @click="openCreate"><Plus />接入普通项目</button></div></div>
    <section class="docker-capability-banner"><span class="docker-capability-icon"><Container /></span><div><strong>Docker 部署已启用</strong><p>Git 代码 → 上传目标服务器 → docker build → 更新容器 → 健康检查 → 失败回滚</p></div><span class="tiny-pill">真实执行</span></section>
    <div class="toolbar"><div class="filter-tabs"><button v-for="item in [{k:'all',n:'全部'},{k:'java',n:'Java'},{k:'frontend',n:'Frontend'},{k:'python',n:'Python'},{k:'docker',n:'Docker'}]" :key="item.k" class="filter-tab" :class="{active:filter===item.k}" @click="filter=item.k">{{ item.n }}</button></div><div class="toolbar-spacer" /><input v-model="search" class="mini-search" placeholder="搜索项目" /><span class="tiny-pill">{{ visible.length }} 个项目</span></div>
    <div class="project-grid"><article v-for="project in visible" :key="project.id" class="project-card"><div class="project-card-top"><div class="project-glyph" :class="project.deployment_mode==='docker'?'docker':project.project_type">{{ project.deployment_mode==='docker'?'DOCK':project.project_type.slice(0,4).toUpperCase() }}</div><button class="secondary-button" @click="openEdit(project)"><Pencil />配置</button></div><h3>{{ project.name }}</h3><p>{{ project.description || '暂无项目描述' }}</p><div class="project-readiness" :class="{ready:readyTargetCount(project.id)>0}"><component :is="readyTargetCount(project.id)>0?CheckCircle2:Server" /><div><strong>{{ readyTargetCount(project.id)>0?'已具备发布条件':'还不能发布' }}</strong><span>{{ projectTargets(project.id).length ? `${projectTargets(project.id).length} 台服务器，${readyTargetCount(project.id)} 台可用` : '请先为项目配置目标服务器' }}</span></div></div><div class="project-card-stats"><div class="project-stat"><span>发布次数</span><strong>{{ project.release_count }}</strong></div><div class="project-stat"><span>成功率</span><strong>{{ project.release_count ? `${project.success_rate}%` : '--' }}</strong></div><div class="project-stat"><span>部署方式</span><strong>{{ project.deployment_mode==='docker'?'Docker':'文件' }}</strong></div></div><div class="project-card-foot"><div class="branch"><GitBranch />{{ project.default_branch }}</div><div class="project-health"><i class="health-dot" :class="{warn:project.repository_url.startsWith('https')&&!project.credential_configured}" />{{ project.deployment_mode==='docker'?`Dockerfile: ${project.dockerfile_path}`:(project.credential_configured?'Git 凭证已配置':'公开仓库 / 未配置凭证') }}</div></div><div class="project-quick-actions"><button class="secondary-button" @click="configureTargets(project.id)"><Server />{{ projectTargets(project.id).length?'管理服务器':'配置服务器' }}</button><button class="primary-button" :disabled="!readyTargetCount(project.id)" @click="releaseProject(project.id)"><Rocket />发起发布</button></div></article></div>

    <ModalShell v-if="showCreate" :title="editingId?'配置项目':'接入新项目'" subtitle="发布时平台会真实拉取代码、执行构建并打包制品" @close="showCreate=false">
      <div class="modal-body"><div class="form-grid"><div class="form-field full"><label>项目名称 *</label><input v-model="form.name" placeholder="例如 order-service" /></div><div class="form-field"><label>工程类型</label><select v-model="form.project_type" @change="applyTemplate"><option value="java">Java</option><option value="frontend">Frontend</option><option value="python">Python</option></select></div><div class="form-field"><label>默认分支</label><input v-model="form.default_branch" /></div><div class="form-field full"><label>部署方式</label><div class="deployment-mode-choice"><button type="button" :class="{active:form.deployment_mode==='file'}" @click="form.deployment_mode='file'">文件 / 进程</button><button type="button" :class="{active:form.deployment_mode==='docker'}" @click="form.deployment_mode='docker'"><Container />Docker 容器</button></div></div><div class="form-field full"><label>Git 仓库 *</label><input v-model="form.repository_url" placeholder="https://git.example.com/team/project.git" /></div><div class="form-field full"><label>项目说明</label><textarea v-model="form.description" /></div><template v-if="form.deployment_mode==='file'"><div class="form-field full"><label>构建命令</label><input v-model="form.build_command" /></div><div class="form-field"><label>构建产物路径（Glob）</label><input v-model="form.artifact_pattern" /></div><div class="form-field"><label>健康检查路径</label><input v-model="form.health_path" /></div></template><template v-else><div class="form-field"><label>Dockerfile 路径 *</label><input v-model="form.dockerfile_path" placeholder="Dockerfile" /><small>相对于 Git 仓库根目录</small></div><div class="form-field"><label>容器内部端口 *</label><input v-model.number="form.docker_container_port" type="number" min="1" max="65535" /></div><div class="form-field full"><label>镜像名称（可选）</label><input v-model="form.docker_image_name" :placeholder="`lightship/${form.name || 'project'}`" /><small>留空由平台生成；每次发布自动追加版本标签</small></div><div class="form-field full"><label>docker run 附加参数（可选）</label><input v-model="form.docker_run_args" placeholder="--env-file /opt/app/app.env -v /data/app:/data" /><small>可配置环境变量、数据卷等；端口映射和重启策略由平台生成</small></div><div class="security-note full docker-note"><Container /><div><strong>镜像在目标服务器构建</strong><span>平台通过 SSH 上传构建上下文，执行 docker build 和 docker run；更新失败会恢复上一镜像。目标服务器必须安装 Docker，且 SSH 用户需要有 Docker 权限。</span></div></div></template><div class="form-field"><label>Git 用户名</label><input v-model="form.git_username" placeholder="私有仓库填写" /></div><div class="form-field"><label>Git Token / 密码</label><input v-model="form.git_token" type="password" :placeholder="editingId?'留空表示不修改':'私有仓库填写'" /></div><div class="security-note full"><ShieldCheck /><div><strong>Git 凭证加密保存</strong><span>Token 不会返回前端，也不会写入发布日志。当前真实构建支持 HTTP/HTTPS Git 仓库。</span></div></div><span v-if="error" class="error-text">{{ error }}</span></div></div>
      <div class="modal-foot"><button class="ghost-button" @click="showCreate=false">取消</button><div class="modal-actions"><button class="secondary-button" :disabled="saving" @click="saveProject(false)">{{ saving ? '正在保存...' : '仅保存' }}</button><button class="primary-button" :disabled="saving" @click="saveProject(true)"><Server />{{ saving ? '正在保存...' : '保存并配置服务器' }}</button></div></div>
    </ModalShell>
  </div>
</template>
