import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Activity, AlertTriangle, CheckCircle2, Container, GitBranch, GitFork, LoaderCircle, Pencil, Plus, Rocket, Search, Server, ShieldCheck, Trash2, WandSparkles } from 'lucide-vue-next';
import { api } from '../api/client';
import ModalShell from '../components/ModalShell.vue';
import { useAuthStore } from '../stores/auth';
const projects = ref([]);
const targets = ref([]);
const filter = ref('all');
const search = ref('');
const showCreate = ref(false);
const editingId = ref(null);
const deleteCandidate = ref(null);
const deleting = ref(false);
const deleteError = ref('');
const branches = ref([]);
const branchesLoading = ref(false);
const branchesMessage = ref('');
const codeHosts = ref([]);
const repositories = ref([]);
const repositoriesLoading = ref(false);
const repositorySearch = ref('');
const repositoryMessage = ref('');
const sourceMode = ref('connection');
const saving = ref(false);
const error = ref('');
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const canOperate = computed(() => ['admin', 'release_manager', 'developer'].includes(auth.role));
const canManage = computed(() => ['admin', 'release_manager'].includes(auth.role));
const form = reactive({ name: '', description: '', project_type: 'java', repository_url: '', default_branch: 'main', build_command: './mvnw clean package', artifact_pattern: 'target/*.jar', health_path: '/actuator/health', deployment_mode: 'file', dockerfile_path: 'Dockerfile', docker_image_name: '', docker_container_port: 8080, docker_run_args: '', compose_file_path: 'docker-compose.yml', compose_project_name: '', git_username: '', git_token: '', code_host_connection_id: null });
const selectedCodeHost = computed(() => codeHosts.value.find((item) => item.id === form.code_host_connection_id) || null);
const visible = computed(() => projects.value.filter((item) => (filter.value === 'all' || (filter.value === 'docker' ? item.deployment_mode === 'docker' : filter.value === 'compose' ? item.deployment_mode === 'compose' : item.project_type === filter.value)) && `${item.name}${item.description}`.toLowerCase().includes(search.value.toLowerCase())));
const templates = {
    java: { build_command: './mvnw clean package', artifact_pattern: 'target/*.jar', health_path: '/actuator/health' },
    frontend: { build_command: 'npm ci && npm run build', artifact_pattern: 'dist/**', health_path: '/' },
    python: { build_command: 'pip wheel . -w dist', artifact_pattern: 'dist/*.whl', health_path: '/health' },
    fullstack: { build_command: '', artifact_pattern: '', health_path: '/health' },
};
async function load() {
    const [projectResult, targetResult, codeHostResult] = await Promise.all([api.get('/projects'), api.get('/targets'), api.get('/code-hosts')]);
    projects.value = projectResult.data;
    targets.value = targetResult.data;
    codeHosts.value = codeHostResult.data;
}
function applyRouteSearch() {
    search.value = String(route.query.search || '');
}
function projectTargets(projectId) { return targets.value.filter((item) => item.project_id === projectId); }
function readyTargetCount(projectId) { return projectTargets(projectId).filter((item) => item.connection_type === 'ssh' && item.status === 'online' && item.credential_configured).length; }
// “管理服务器”进入项目范围的服务器列表；新增动作由发布环境页的
// “添加目标服务器”按钮明确触发，避免点击管理时误打开新增表单。
function configureTargets(projectId) { router.push(`/environments?project_id=${projectId}`); }
function releaseProject(projectId) { router.push(`/releases?create=1&project_id=${projectId}`); }
function viewServiceStatus(projectId) { router.push(`/services?project_id=${projectId}`); }
function applyTemplate() {
    Object.assign(form, templates[form.project_type]);
    if (form.project_type === 'fullstack')
        form.deployment_mode = 'compose';
}
function openCreate() {
    if (!canOperate.value)
        return;
    editingId.value = null;
    Object.assign(form, { name: '', description: '', project_type: 'java', repository_url: '', default_branch: 'main', deployment_mode: 'file', dockerfile_path: 'Dockerfile', docker_image_name: '', docker_container_port: 8080, docker_run_args: '', compose_file_path: 'docker-compose.yml', compose_project_name: '', git_username: '', git_token: '', code_host_connection_id: null });
    applyTemplate();
    sourceMode.value = codeHosts.value.length ? 'connection' : 'manual';
    repositories.value = [];
    repositorySearch.value = '';
    repositoryMessage.value = '';
    branches.value = [];
    branchesMessage.value = '';
    showCreate.value = true;
}
function openDockerCreate() {
    openCreate();
    form.deployment_mode = 'docker';
}
function deploymentName(project) { return project.deployment_mode === 'compose' ? 'Compose' : project.deployment_mode === 'docker' ? 'Docker' : '文件'; }
function deploymentDetail(project) { return project.code_host_name ? `${project.code_host_name} · ${project.code_host_provider}` : project.deployment_mode === 'compose' ? `Compose: ${project.compose_file_path}` : project.deployment_mode === 'docker' ? `Dockerfile: ${project.dockerfile_path}` : project.credential_configured ? 'Git 凭证已配置' : '公开仓库 / 未配置凭证'; }
function openEdit(project) {
    if (!canOperate.value)
        return;
    editingId.value = project.id;
    Object.assign(form, { ...project, git_token: '' });
    sourceMode.value = project.code_host_connection_id ? 'connection' : 'manual';
    repositories.value = [];
    repositorySearch.value = '';
    repositoryMessage.value = '';
    branches.value = [];
    branchesMessage.value = '';
    showCreate.value = true;
}
async function detectBranches() {
    branchesMessage.value = '';
    if (!form.repository_url.trim()) {
        branchesMessage.value = '请先填写 Git 仓库地址';
        return;
    }
    branchesLoading.value = true;
    try {
        const { data } = await api.post('/projects/branches', {
            project_id: editingId.value || undefined,
            repository_url: form.repository_url,
            git_username: form.git_username,
            git_token: form.git_token,
            code_host_connection_id: form.code_host_connection_id,
        });
        branches.value = data.branches;
        if (data.default_branch)
            form.default_branch = data.default_branch;
        branchesMessage.value = `已识别 ${data.branches.length} 个分支${data.default_branch ? `，默认分支：${data.default_branch}` : ''}`;
    }
    catch (exception) {
        branches.value = [];
        branchesMessage.value = exception.response?.data?.detail || '分支识别失败，请检查仓库地址和凭证';
    }
    finally {
        branchesLoading.value = false;
    }
}
async function loadRepositories() {
    repositories.value = [];
    repositoryMessage.value = '';
    if (!form.code_host_connection_id) {
        repositoryMessage.value = '请先选择代码托管连接';
        return;
    }
    repositoriesLoading.value = true;
    try {
        repositories.value = (await api.get(`/code-hosts/${form.code_host_connection_id}/repositories`, { params: { search: repositorySearch.value } })).data;
        repositoryMessage.value = `已读取 ${repositories.value.length} 个仓库`;
    }
    catch (exception) {
        repositoryMessage.value = exception.response?.data?.detail || '仓库读取失败，请先到代码托管页面测试连接';
    }
    finally {
        repositoriesLoading.value = false;
    }
}
function selectRepository(repository) {
    form.repository_url = repository.clone_url;
    form.default_branch = repository.default_branch || 'main';
    if (!form.name.trim())
        form.name = repository.name;
    if (!form.description.trim() && repository.description)
        form.description = repository.description;
    repositoryMessage.value = `已选择 ${repository.full_name}`;
    branches.value = [];
}
function changeSourceMode(mode) {
    sourceMode.value = mode;
    if (mode === 'manual')
        form.code_host_connection_id = null;
    repositories.value = [];
    repositoryMessage.value = '';
}
async function saveProject(configureAfterSave = false) {
    error.value = '';
    if (!form.name || !form.repository_url) {
        error.value = '请填写项目名称和 Git 仓库地址';
        return;
    }
    saving.value = true;
    try {
        const { data } = editingId.value ? await api.put(`/projects/${editingId.value}`, form) : await api.post('/projects', form);
        showCreate.value = false;
        await load();
        if (configureAfterSave)
            configureTargets(data.id);
    }
    catch (exception) {
        error.value = exception.response?.data?.detail || '项目创建失败';
    }
    finally {
        saving.value = false;
    }
}
function requestDelete(project) {
    if (!canManage.value)
        return;
    deleteError.value = '';
    deleteCandidate.value = project;
}
async function deleteProject() {
    if (!deleteCandidate.value)
        return;
    deleting.value = true;
    deleteError.value = '';
    try {
        await api.delete(`/projects/${deleteCandidate.value.id}`);
        deleteCandidate.value = null;
        await load();
    }
    catch (exception) {
        deleteError.value = exception.response?.data?.detail || '项目删除失败';
    }
    finally {
        deleting.value = false;
    }
}
watch(() => route.query.search, applyRouteSearch);
onMounted(async () => {
    applyRouteSearch();
    await load();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "content compact projects-page" },
    ...{ class: (`role-${__VLS_ctx.auth.role}`) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "hero-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "eyebrow" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
if (__VLS_ctx.canOperate) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "hero-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.openDockerCreate) },
        ...{ class: "secondary-button docker-entry-button" },
    });
    const __VLS_0 = {}.Container;
    /** @type {[typeof __VLS_components.Container, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
    const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.openCreate) },
        ...{ class: "primary-button" },
    });
    const __VLS_4 = {}.Plus;
    /** @type {[typeof __VLS_components.Plus, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({}));
    const __VLS_6 = __VLS_5({}, ...__VLS_functionalComponentArgsRest(__VLS_5));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "docker-capability-banner" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "docker-capability-icon" },
});
const __VLS_8 = {}.Container;
/** @type {[typeof __VLS_components.Container, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({}));
const __VLS_10 = __VLS_9({}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "tiny-pill" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "toolbar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "filter-tabs" },
});
for (const [item] of __VLS_getVForSourceType(([{ k: 'all', n: '全部' }, { k: 'java', n: 'Java' }, { k: 'frontend', n: 'Frontend' }, { k: 'python', n: 'Python' }, { k: 'docker', n: 'Docker' }, { k: 'compose', n: 'Compose' }]))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.filter = item.k;
            } },
        key: (item.k),
        ...{ class: "filter-tab" },
        ...{ class: ({ active: __VLS_ctx.filter === item.k }) },
    });
    (item.n);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
    ...{ class: "toolbar-spacer" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ class: "mini-search" },
    placeholder: "搜索项目",
});
(__VLS_ctx.search);
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "tiny-pill" },
});
(__VLS_ctx.visible.length);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "project-grid" },
});
for (const [project] of __VLS_getVForSourceType((__VLS_ctx.visible))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        key: (project.id),
        ...{ class: "project-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-card-top" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-glyph" },
        ...{ class: (project.deployment_mode !== 'file' ? 'docker' : project.project_type) },
    });
    (project.deployment_mode === 'compose' ? 'COMP' : project.deployment_mode === 'docker' ? 'DOCK' : project.project_type.slice(0, 4).toUpperCase());
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-card-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.openEdit(project);
            } },
        ...{ class: "secondary-button" },
    });
    const __VLS_12 = {}.Pencil;
    /** @type {[typeof __VLS_components.Pencil, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({}));
    const __VLS_14 = __VLS_13({}, ...__VLS_functionalComponentArgsRest(__VLS_13));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.requestDelete(project);
            } },
        ...{ class: "icon-button delete-icon-button" },
        title: "删除项目",
        'aria-label': "删除项目",
    });
    const __VLS_16 = {}.Trash2;
    /** @type {[typeof __VLS_components.Trash2, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({}));
    const __VLS_18 = __VLS_17({}, ...__VLS_functionalComponentArgsRest(__VLS_17));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    (project.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (project.description || '暂无项目描述');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-readiness" },
        ...{ class: ({ ready: __VLS_ctx.readyTargetCount(project.id) > 0 }) },
    });
    const __VLS_20 = ((__VLS_ctx.readyTargetCount(project.id) > 0 ? __VLS_ctx.CheckCircle2 : __VLS_ctx.Server));
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({}));
    const __VLS_22 = __VLS_21({}, ...__VLS_functionalComponentArgsRest(__VLS_21));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.readyTargetCount(project.id) > 0 ? '已具备发布条件' : '还不能发布');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.projectTargets(project.id).length ? `${__VLS_ctx.projectTargets(project.id).length} 台服务器，${__VLS_ctx.readyTargetCount(project.id)} 台可用` : '请先为项目配置目标服务器');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-card-stats" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-stat" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (project.release_count);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-stat" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (project.release_count ? `${project.success_rate}%` : '--');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-stat" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.deploymentName(project));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-card-foot" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "branch" },
    });
    const __VLS_24 = {}.GitBranch;
    /** @type {[typeof __VLS_components.GitBranch, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({}));
    const __VLS_26 = __VLS_25({}, ...__VLS_functionalComponentArgsRest(__VLS_25));
    (project.default_branch);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-health" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.i)({
        ...{ class: "health-dot" },
        ...{ class: ({ warn: project.repository_url.startsWith('https') && !project.credential_configured }) },
    });
    (__VLS_ctx.deploymentDetail(project));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-quick-actions project-quick-actions-three" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.viewServiceStatus(project.id);
            } },
        ...{ class: "secondary-button" },
    });
    const __VLS_28 = {}.Activity;
    /** @type {[typeof __VLS_components.Activity, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({}));
    const __VLS_30 = __VLS_29({}, ...__VLS_functionalComponentArgsRest(__VLS_29));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.configureTargets(project.id);
            } },
        ...{ class: "secondary-button" },
    });
    const __VLS_32 = {}.Server;
    /** @type {[typeof __VLS_components.Server, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({}));
    const __VLS_34 = __VLS_33({}, ...__VLS_functionalComponentArgsRest(__VLS_33));
    (__VLS_ctx.projectTargets(project.id).length ? '管理服务器' : '配置服务器');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.releaseProject(project.id);
            } },
        ...{ class: "primary-button" },
        disabled: (!__VLS_ctx.readyTargetCount(project.id)),
    });
    const __VLS_36 = {}.Rocket;
    /** @type {[typeof __VLS_components.Rocket, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({}));
    const __VLS_38 = __VLS_37({}, ...__VLS_functionalComponentArgsRest(__VLS_37));
}
if (__VLS_ctx.showCreate) {
    /** @type {[typeof ModalShell, typeof ModalShell, ]} */ ;
    // @ts-ignore
    const __VLS_40 = __VLS_asFunctionalComponent(ModalShell, new ModalShell({
        ...{ 'onClose': {} },
        title: (__VLS_ctx.editingId ? '配置项目' : '接入新项目'),
        subtitle: "发布时平台会真实拉取代码、执行构建并打包制品",
    }));
    const __VLS_41 = __VLS_40({
        ...{ 'onClose': {} },
        title: (__VLS_ctx.editingId ? '配置项目' : '接入新项目'),
        subtitle: "发布时平台会真实拉取代码、执行构建并打包制品",
    }, ...__VLS_functionalComponentArgsRest(__VLS_40));
    let __VLS_43;
    let __VLS_44;
    let __VLS_45;
    const __VLS_46 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.showCreate))
                return;
            __VLS_ctx.showCreate = false;
        }
    };
    __VLS_42.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-config-scroll" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "project-source-section" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-form-section-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "section-step" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-source-grid" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        placeholder: "例如 order-service",
    });
    (__VLS_ctx.form.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        ...{ onChange: (__VLS_ctx.applyTemplate) },
        value: (__VLS_ctx.form.project_type),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "fullstack",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "java",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "frontend",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "python",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "source-mode-choice" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreate))
                    return;
                __VLS_ctx.changeSourceMode('connection');
            } },
        type: "button",
        ...{ class: ({ active: __VLS_ctx.sourceMode === 'connection' }) },
    });
    const __VLS_47 = {}.GitFork;
    /** @type {[typeof __VLS_components.GitFork, ]} */ ;
    // @ts-ignore
    const __VLS_48 = __VLS_asFunctionalComponent(__VLS_47, new __VLS_47({}));
    const __VLS_49 = __VLS_48({}, ...__VLS_functionalComponentArgsRest(__VLS_48));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreate))
                    return;
                __VLS_ctx.changeSourceMode('manual');
            } },
        type: "button",
        ...{ class: ({ active: __VLS_ctx.sourceMode === 'manual' }) },
    });
    const __VLS_51 = {}.GitBranch;
    /** @type {[typeof __VLS_components.GitBranch, ]} */ ;
    // @ts-ignore
    const __VLS_52 = __VLS_asFunctionalComponent(__VLS_51, new __VLS_51({}));
    const __VLS_53 = __VLS_52({}, ...__VLS_functionalComponentArgsRest(__VLS_52));
    if (__VLS_ctx.sourceMode === 'connection') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
            ...{ onChange: (...[$event]) => {
                    if (!(__VLS_ctx.showCreate))
                        return;
                    if (!(__VLS_ctx.sourceMode === 'connection'))
                        return;
                    __VLS_ctx.repositories = [];
                    __VLS_ctx.repositoryMessage = '';
                } },
            value: (__VLS_ctx.form.code_host_connection_id),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: (null),
        });
        for (const [item] of __VLS_getVForSourceType((__VLS_ctx.codeHosts))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                key: (item.id),
                value: (item.id),
            });
            (item.name);
            (item.provider);
            (item.status === 'connected' ? ' · 已连接' : ' · 待测试');
        }
        if (!__VLS_ctx.codeHosts.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "repository-search" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            ...{ onKeyup: (__VLS_ctx.loadRepositories) },
            placeholder: "项目名或仓库路径",
        });
        (__VLS_ctx.repositorySearch);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.loadRepositories) },
            type: "button",
            ...{ class: "secondary-button" },
            disabled: (__VLS_ctx.repositoriesLoading || !__VLS_ctx.form.code_host_connection_id),
        });
        if (__VLS_ctx.repositoriesLoading) {
            const __VLS_55 = {}.LoaderCircle;
            /** @type {[typeof __VLS_components.LoaderCircle, ]} */ ;
            // @ts-ignore
            const __VLS_56 = __VLS_asFunctionalComponent(__VLS_55, new __VLS_55({
                ...{ class: "spin" },
            }));
            const __VLS_57 = __VLS_56({
                ...{ class: "spin" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_56));
        }
        else {
            const __VLS_59 = {}.Search;
            /** @type {[typeof __VLS_components.Search, ]} */ ;
            // @ts-ignore
            const __VLS_60 = __VLS_asFunctionalComponent(__VLS_59, new __VLS_59({}));
            const __VLS_61 = __VLS_60({}, ...__VLS_functionalComponentArgsRest(__VLS_60));
        }
        (__VLS_ctx.repositoriesLoading ? '读取中' : '读取仓库');
        if (__VLS_ctx.repositories.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "repository-picker full" },
            });
            for (const [repository] of __VLS_getVForSourceType((__VLS_ctx.repositories))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.showCreate))
                                return;
                            if (!(__VLS_ctx.sourceMode === 'connection'))
                                return;
                            if (!(__VLS_ctx.repositories.length))
                                return;
                            __VLS_ctx.selectRepository(repository);
                        } },
                    key: (repository.id),
                    type: "button",
                    ...{ class: ({ selected: __VLS_ctx.form.repository_url === repository.clone_url }) },
                });
                const __VLS_63 = {}.GitFork;
                /** @type {[typeof __VLS_components.GitFork, ]} */ ;
                // @ts-ignore
                const __VLS_64 = __VLS_asFunctionalComponent(__VLS_63, new __VLS_63({}));
                const __VLS_65 = __VLS_64({}, ...__VLS_functionalComponentArgsRest(__VLS_64));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
                (repository.full_name);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                (repository.description || repository.clone_url);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.em, __VLS_intrinsicElements.em)({});
                (repository.private ? '私有' : '公开');
            }
        }
        if (__VLS_ctx.repositoryMessage) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({
                ...{ class: "repository-message full" },
            });
            (__VLS_ctx.repositoryMessage);
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field full" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            placeholder: "请先读取并选择仓库，也可直接修正地址",
        });
        (__VLS_ctx.form.repository_url);
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field full" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            placeholder: "https://git.example.com/team/project.git",
        });
        (__VLS_ctx.form.repository_url);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            placeholder: "公开仓库可留空",
        });
        (__VLS_ctx.form.git_username);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            type: "password",
            placeholder: (__VLS_ctx.editingId ? '留空表示使用已保存凭证' : '私有仓库填写'),
        });
        (__VLS_ctx.form.git_token);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field full branch-field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "branch-discovery-controls" },
    });
    if (__VLS_ctx.branches.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
            value: (__VLS_ctx.form.default_branch),
        });
        for (const [branch] of __VLS_getVForSourceType((__VLS_ctx.branches))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                key: (branch),
                value: (branch),
            });
            (branch);
        }
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            placeholder: "例如 main；可手动填写",
        });
        (__VLS_ctx.form.default_branch);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.detectBranches) },
        type: "button",
        ...{ class: "secondary-button" },
        disabled: (__VLS_ctx.branchesLoading || !__VLS_ctx.form.repository_url.trim()),
    });
    if (__VLS_ctx.branchesLoading) {
        const __VLS_67 = {}.LoaderCircle;
        /** @type {[typeof __VLS_components.LoaderCircle, ]} */ ;
        // @ts-ignore
        const __VLS_68 = __VLS_asFunctionalComponent(__VLS_67, new __VLS_67({
            ...{ class: "spin" },
        }));
        const __VLS_69 = __VLS_68({
            ...{ class: "spin" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_68));
    }
    else {
        const __VLS_71 = {}.WandSparkles;
        /** @type {[typeof __VLS_components.WandSparkles, ]} */ ;
        // @ts-ignore
        const __VLS_72 = __VLS_asFunctionalComponent(__VLS_71, new __VLS_71({}));
        const __VLS_73 = __VLS_72({}, ...__VLS_functionalComponentArgsRest(__VLS_72));
    }
    (__VLS_ctx.branchesLoading ? '正在读取...' : '识别远程分支');
    if (__VLS_ctx.branchesMessage) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({
            ...{ class: "branch-message" },
            ...{ class: ({ error: __VLS_ctx.branches.length === 0 && !__VLS_ctx.branchesLoading }) },
        });
        (__VLS_ctx.branchesMessage);
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "security-note full compact-security-note" },
    });
    const __VLS_75 = {}.ShieldCheck;
    /** @type {[typeof __VLS_components.ShieldCheck, ]} */ ;
    // @ts-ignore
    const __VLS_76 = __VLS_asFunctionalComponent(__VLS_75, new __VLS_75({}));
    const __VLS_77 = __VLS_76({}, ...__VLS_functionalComponentArgsRest(__VLS_76));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.selectedCodeHost ? `使用连接：${__VLS_ctx.selectedCodeHost.name}` : 'Git 凭证加密保存');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.selectedCodeHost ? '仓库读取、分支识别和发布拉取将复用该连接的加密令牌。' : '凭证不会返回前端，也不会出现在发布日志中。');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-body" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-grid" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "deployment-mode-choice" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreate))
                    return;
                __VLS_ctx.form.deployment_mode = 'file';
            } },
        type: "button",
        ...{ class: ({ active: __VLS_ctx.form.deployment_mode === 'file' }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreate))
                    return;
                __VLS_ctx.form.deployment_mode = 'docker';
            } },
        type: "button",
        ...{ class: ({ active: __VLS_ctx.form.deployment_mode === 'docker' }) },
    });
    const __VLS_79 = {}.Container;
    /** @type {[typeof __VLS_components.Container, ]} */ ;
    // @ts-ignore
    const __VLS_80 = __VLS_asFunctionalComponent(__VLS_79, new __VLS_79({}));
    const __VLS_81 = __VLS_80({}, ...__VLS_functionalComponentArgsRest(__VLS_80));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreate))
                    return;
                __VLS_ctx.form.deployment_mode = 'compose';
            } },
        type: "button",
        ...{ class: ({ active: __VLS_ctx.form.deployment_mode === 'compose' }) },
    });
    const __VLS_83 = {}.Container;
    /** @type {[typeof __VLS_components.Container, ]} */ ;
    // @ts-ignore
    const __VLS_84 = __VLS_asFunctionalComponent(__VLS_83, new __VLS_83({}));
    const __VLS_85 = __VLS_84({}, ...__VLS_functionalComponentArgsRest(__VLS_84));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea)({
        value: (__VLS_ctx.form.description),
    });
    if (__VLS_ctx.form.deployment_mode === 'file') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field full" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({});
        (__VLS_ctx.form.build_command);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({});
        (__VLS_ctx.form.artifact_pattern);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({});
        (__VLS_ctx.form.health_path);
    }
    else if (__VLS_ctx.form.deployment_mode === 'docker') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            placeholder: "Dockerfile",
        });
        (__VLS_ctx.form.dockerfile_path);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            type: "number",
            min: "1",
            max: "65535",
        });
        (__VLS_ctx.form.docker_container_port);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field full" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            placeholder: (`lightship/${__VLS_ctx.form.name || 'project'}`),
        });
        (__VLS_ctx.form.docker_image_name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field full" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            placeholder: "--env-file /opt/app/app.env -v /data/app:/data",
        });
        (__VLS_ctx.form.docker_run_args);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "security-note full docker-note" },
        });
        const __VLS_87 = {}.Container;
        /** @type {[typeof __VLS_components.Container, ]} */ ;
        // @ts-ignore
        const __VLS_88 = __VLS_asFunctionalComponent(__VLS_87, new __VLS_87({}));
        const __VLS_89 = __VLS_88({}, ...__VLS_functionalComponentArgsRest(__VLS_88));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            placeholder: "docker-compose.yml",
        });
        (__VLS_ctx.form.compose_file_path);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            placeholder: (`lightship-${__VLS_ctx.form.name || 'project'}`),
        });
        (__VLS_ctx.form.compose_project_name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "security-note full docker-note" },
        });
        const __VLS_91 = {}.Container;
        /** @type {[typeof __VLS_components.Container, ]} */ ;
        // @ts-ignore
        const __VLS_92 = __VLS_asFunctionalComponent(__VLS_91, new __VLS_91({}));
        const __VLS_93 = __VLS_92({}, ...__VLS_functionalComponentArgsRest(__VLS_92));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    if (__VLS_ctx.error) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "error-text" },
        });
        (__VLS_ctx.error);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-foot" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreate))
                    return;
                __VLS_ctx.showCreate = false;
            } },
        ...{ class: "ghost-button" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreate))
                    return;
                __VLS_ctx.saveProject(false);
            } },
        ...{ class: "secondary-button" },
        disabled: (__VLS_ctx.saving),
    });
    (__VLS_ctx.saving ? '正在保存...' : '仅保存');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreate))
                    return;
                __VLS_ctx.saveProject(true);
            } },
        ...{ class: "primary-button" },
        disabled: (__VLS_ctx.saving),
    });
    const __VLS_95 = {}.Server;
    /** @type {[typeof __VLS_components.Server, ]} */ ;
    // @ts-ignore
    const __VLS_96 = __VLS_asFunctionalComponent(__VLS_95, new __VLS_95({}));
    const __VLS_97 = __VLS_96({}, ...__VLS_functionalComponentArgsRest(__VLS_96));
    (__VLS_ctx.saving ? '正在保存...' : '保存并配置服务器');
    var __VLS_42;
}
if (__VLS_ctx.deleteCandidate) {
    /** @type {[typeof ModalShell, typeof ModalShell, ]} */ ;
    // @ts-ignore
    const __VLS_99 = __VLS_asFunctionalComponent(ModalShell, new ModalShell({
        ...{ 'onClose': {} },
        title: "删除项目",
        subtitle: "此操作不可恢复",
        size: "small",
    }));
    const __VLS_100 = __VLS_99({
        ...{ 'onClose': {} },
        title: "删除项目",
        subtitle: "此操作不可恢复",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_99));
    let __VLS_102;
    let __VLS_103;
    let __VLS_104;
    const __VLS_105 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.deleteCandidate))
                return;
            __VLS_ctx.deleteCandidate = null;
        }
    };
    __VLS_101.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-body delete-confirm-body" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "delete-warning-icon" },
    });
    const __VLS_106 = {}.AlertTriangle;
    /** @type {[typeof __VLS_components.AlertTriangle, ]} */ ;
    // @ts-ignore
    const __VLS_107 = __VLS_asFunctionalComponent(__VLS_106, new __VLS_106({}));
    const __VLS_108 = __VLS_107({}, ...__VLS_functionalComponentArgsRest(__VLS_107));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.deleteCandidate.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)({});
    (__VLS_ctx.deleteCandidate.release_count);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)({});
    (__VLS_ctx.projectTargets(__VLS_ctx.deleteCandidate.id).length);
    if (__VLS_ctx.deleteError) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "error-text" },
        });
        (__VLS_ctx.deleteError);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-foot" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.deleteCandidate))
                    return;
                __VLS_ctx.deleteCandidate = null;
            } },
        ...{ class: "ghost-button" },
        disabled: (__VLS_ctx.deleting),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.deleteProject) },
        ...{ class: "danger-button" },
        disabled: (__VLS_ctx.deleting),
    });
    const __VLS_110 = {}.Trash2;
    /** @type {[typeof __VLS_components.Trash2, ]} */ ;
    // @ts-ignore
    const __VLS_111 = __VLS_asFunctionalComponent(__VLS_110, new __VLS_110({}));
    const __VLS_112 = __VLS_111({}, ...__VLS_functionalComponentArgsRest(__VLS_111));
    (__VLS_ctx.deleting ? '正在删除...' : '确认删除项目');
    var __VLS_101;
}
/** @type {__VLS_StyleScopedClasses['content']} */ ;
/** @type {__VLS_StyleScopedClasses['compact']} */ ;
/** @type {__VLS_StyleScopedClasses['projects-page']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-row']} */ ;
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['docker-entry-button']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['docker-capability-banner']} */ ;
/** @type {__VLS_StyleScopedClasses['docker-capability-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['tiny-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-spacer']} */ ;
/** @type {__VLS_StyleScopedClasses['mini-search']} */ ;
/** @type {__VLS_StyleScopedClasses['tiny-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['project-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['project-card']} */ ;
/** @type {__VLS_StyleScopedClasses['project-card-top']} */ ;
/** @type {__VLS_StyleScopedClasses['project-glyph']} */ ;
/** @type {__VLS_StyleScopedClasses['project-card-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-button']} */ ;
/** @type {__VLS_StyleScopedClasses['delete-icon-button']} */ ;
/** @type {__VLS_StyleScopedClasses['project-readiness']} */ ;
/** @type {__VLS_StyleScopedClasses['ready']} */ ;
/** @type {__VLS_StyleScopedClasses['project-card-stats']} */ ;
/** @type {__VLS_StyleScopedClasses['project-stat']} */ ;
/** @type {__VLS_StyleScopedClasses['project-stat']} */ ;
/** @type {__VLS_StyleScopedClasses['project-stat']} */ ;
/** @type {__VLS_StyleScopedClasses['project-card-foot']} */ ;
/** @type {__VLS_StyleScopedClasses['branch']} */ ;
/** @type {__VLS_StyleScopedClasses['project-health']} */ ;
/** @type {__VLS_StyleScopedClasses['health-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['warn']} */ ;
/** @type {__VLS_StyleScopedClasses['project-quick-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['project-quick-actions-three']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['project-config-scroll']} */ ;
/** @type {__VLS_StyleScopedClasses['project-source-section']} */ ;
/** @type {__VLS_StyleScopedClasses['project-form-section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['section-step']} */ ;
/** @type {__VLS_StyleScopedClasses['project-source-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['source-mode-choice']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['repository-search']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['spin']} */ ;
/** @type {__VLS_StyleScopedClasses['repository-picker']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['selected']} */ ;
/** @type {__VLS_StyleScopedClasses['repository-message']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['branch-field']} */ ;
/** @type {__VLS_StyleScopedClasses['branch-discovery-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['spin']} */ ;
/** @type {__VLS_StyleScopedClasses['branch-message']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['security-note']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['compact-security-note']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
/** @type {__VLS_StyleScopedClasses['form-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['deployment-mode-choice']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['security-note']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['docker-note']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['security-note']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['docker-note']} */ ;
/** @type {__VLS_StyleScopedClasses['error-text']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-foot']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost-button']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
/** @type {__VLS_StyleScopedClasses['delete-confirm-body']} */ ;
/** @type {__VLS_StyleScopedClasses['delete-warning-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['error-text']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-foot']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost-button']} */ ;
/** @type {__VLS_StyleScopedClasses['danger-button']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Activity: Activity,
            AlertTriangle: AlertTriangle,
            CheckCircle2: CheckCircle2,
            Container: Container,
            GitBranch: GitBranch,
            GitFork: GitFork,
            LoaderCircle: LoaderCircle,
            Pencil: Pencil,
            Plus: Plus,
            Rocket: Rocket,
            Search: Search,
            Server: Server,
            ShieldCheck: ShieldCheck,
            Trash2: Trash2,
            WandSparkles: WandSparkles,
            ModalShell: ModalShell,
            filter: filter,
            search: search,
            showCreate: showCreate,
            editingId: editingId,
            deleteCandidate: deleteCandidate,
            deleting: deleting,
            deleteError: deleteError,
            branches: branches,
            branchesLoading: branchesLoading,
            branchesMessage: branchesMessage,
            codeHosts: codeHosts,
            repositories: repositories,
            repositoriesLoading: repositoriesLoading,
            repositorySearch: repositorySearch,
            repositoryMessage: repositoryMessage,
            sourceMode: sourceMode,
            saving: saving,
            error: error,
            auth: auth,
            canOperate: canOperate,
            form: form,
            selectedCodeHost: selectedCodeHost,
            visible: visible,
            projectTargets: projectTargets,
            readyTargetCount: readyTargetCount,
            configureTargets: configureTargets,
            releaseProject: releaseProject,
            viewServiceStatus: viewServiceStatus,
            applyTemplate: applyTemplate,
            openCreate: openCreate,
            openDockerCreate: openDockerCreate,
            deploymentName: deploymentName,
            deploymentDetail: deploymentDetail,
            openEdit: openEdit,
            detectBranches: detectBranches,
            loadRepositories: loadRepositories,
            selectRepository: selectRepository,
            changeSourceMode: changeSourceMode,
            saveProject: saveProject,
            requestDelete: requestDelete,
            deleteProject: deleteProject,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
