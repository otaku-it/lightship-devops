import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { AlertTriangle, CheckCircle2, Container, GitBranch, Pencil, Plus, Rocket, Server, ShieldCheck, Trash2 } from 'lucide-vue-next';
import { api } from '../api/client';
import ModalShell from '../components/ModalShell.vue';
const projects = ref([]);
const targets = ref([]);
const filter = ref('all');
const search = ref('');
const showCreate = ref(false);
const editingId = ref(null);
const deleteCandidate = ref(null);
const deleting = ref(false);
const deleteError = ref('');
const saving = ref(false);
const error = ref('');
const router = useRouter();
const form = reactive({ name: '', description: '', project_type: 'java', repository_url: '', default_branch: 'main', build_command: './mvnw clean package', artifact_pattern: 'target/*.jar', health_path: '/actuator/health', deployment_mode: 'file', dockerfile_path: 'Dockerfile', docker_image_name: '', docker_container_port: 8080, docker_run_args: '', compose_file_path: 'docker-compose.yml', compose_project_name: '', git_username: '', git_token: '' });
const visible = computed(() => projects.value.filter((item) => (filter.value === 'all' || (filter.value === 'docker' ? item.deployment_mode === 'docker' : filter.value === 'compose' ? item.deployment_mode === 'compose' : item.project_type === filter.value)) && `${item.name}${item.description}`.toLowerCase().includes(search.value.toLowerCase())));
const templates = {
    java: { build_command: './mvnw clean package', artifact_pattern: 'target/*.jar', health_path: '/actuator/health' },
    frontend: { build_command: 'npm ci && npm run build', artifact_pattern: 'dist/**', health_path: '/' },
    python: { build_command: 'pip wheel . -w dist', artifact_pattern: 'dist/*.whl', health_path: '/health' },
    fullstack: { build_command: '', artifact_pattern: '', health_path: '/health' },
};
async function load() {
    const [projectResult, targetResult] = await Promise.all([api.get('/projects'), api.get('/targets')]);
    projects.value = projectResult.data;
    targets.value = targetResult.data;
}
function projectTargets(projectId) { return targets.value.filter((item) => item.project_id === projectId); }
function readyTargetCount(projectId) { return projectTargets(projectId).filter((item) => item.connection_type === 'ssh' && item.status === 'online' && item.credential_configured).length; }
function configureTargets(projectId) { router.push(`/environments?project_id=${projectId}&create=1`); }
function releaseProject(projectId) { router.push(`/releases?create=1&project_id=${projectId}`); }
function applyTemplate() {
    Object.assign(form, templates[form.project_type]);
    if (form.project_type === 'fullstack')
        form.deployment_mode = 'compose';
}
function openCreate() {
    editingId.value = null;
    Object.assign(form, { name: '', description: '', project_type: 'java', repository_url: '', default_branch: 'main', deployment_mode: 'file', dockerfile_path: 'Dockerfile', docker_image_name: '', docker_container_port: 8080, docker_run_args: '', compose_file_path: 'docker-compose.yml', compose_project_name: '', git_username: '', git_token: '' });
    applyTemplate();
    showCreate.value = true;
}
function openDockerCreate() {
    openCreate();
    form.deployment_mode = 'docker';
}
function deploymentName(project) { return project.deployment_mode === 'compose' ? 'Compose' : project.deployment_mode === 'docker' ? 'Docker' : '文件'; }
function deploymentDetail(project) { return project.deployment_mode === 'compose' ? `Compose: ${project.compose_file_path}` : project.deployment_mode === 'docker' ? `Dockerfile: ${project.dockerfile_path}` : project.credential_configured ? 'Git 凭证已配置' : '公开仓库 / 未配置凭证'; }
function openEdit(project) {
    editingId.value = project.id;
    Object.assign(form, { ...project, git_token: '' });
    showCreate.value = true;
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
onMounted(load);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "content compact" },
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
        ...{ class: "project-quick-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.configureTargets(project.id);
            } },
        ...{ class: "secondary-button" },
    });
    const __VLS_28 = {}.Server;
    /** @type {[typeof __VLS_components.Server, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({}));
    const __VLS_30 = __VLS_29({}, ...__VLS_functionalComponentArgsRest(__VLS_29));
    (__VLS_ctx.projectTargets(project.id).length ? '管理服务器' : '配置服务器');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.releaseProject(project.id);
            } },
        ...{ class: "primary-button" },
        disabled: (!__VLS_ctx.readyTargetCount(project.id)),
    });
    const __VLS_32 = {}.Rocket;
    /** @type {[typeof __VLS_components.Rocket, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({}));
    const __VLS_34 = __VLS_33({}, ...__VLS_functionalComponentArgsRest(__VLS_33));
}
if (__VLS_ctx.showCreate) {
    /** @type {[typeof ModalShell, typeof ModalShell, ]} */ ;
    // @ts-ignore
    const __VLS_36 = __VLS_asFunctionalComponent(ModalShell, new ModalShell({
        ...{ 'onClose': {} },
        title: (__VLS_ctx.editingId ? '配置项目' : '接入新项目'),
        subtitle: "发布时平台会真实拉取代码、执行构建并打包制品",
    }));
    const __VLS_37 = __VLS_36({
        ...{ 'onClose': {} },
        title: (__VLS_ctx.editingId ? '配置项目' : '接入新项目'),
        subtitle: "发布时平台会真实拉取代码、执行构建并打包制品",
    }, ...__VLS_functionalComponentArgsRest(__VLS_36));
    let __VLS_39;
    let __VLS_40;
    let __VLS_41;
    const __VLS_42 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.showCreate))
                return;
            __VLS_ctx.showCreate = false;
        }
    };
    __VLS_38.slots.default;
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
        ...{ class: "form-field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({});
    (__VLS_ctx.form.default_branch);
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
    const __VLS_43 = {}.Container;
    /** @type {[typeof __VLS_components.Container, ]} */ ;
    // @ts-ignore
    const __VLS_44 = __VLS_asFunctionalComponent(__VLS_43, new __VLS_43({}));
    const __VLS_45 = __VLS_44({}, ...__VLS_functionalComponentArgsRest(__VLS_44));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreate))
                    return;
                __VLS_ctx.form.deployment_mode = 'compose';
            } },
        type: "button",
        ...{ class: ({ active: __VLS_ctx.form.deployment_mode === 'compose' }) },
    });
    const __VLS_47 = {}.Container;
    /** @type {[typeof __VLS_components.Container, ]} */ ;
    // @ts-ignore
    const __VLS_48 = __VLS_asFunctionalComponent(__VLS_47, new __VLS_47({}));
    const __VLS_49 = __VLS_48({}, ...__VLS_functionalComponentArgsRest(__VLS_48));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        placeholder: "https://git.example.com/team/project.git",
    });
    (__VLS_ctx.form.repository_url);
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
        const __VLS_51 = {}.Container;
        /** @type {[typeof __VLS_components.Container, ]} */ ;
        // @ts-ignore
        const __VLS_52 = __VLS_asFunctionalComponent(__VLS_51, new __VLS_51({}));
        const __VLS_53 = __VLS_52({}, ...__VLS_functionalComponentArgsRest(__VLS_52));
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
        const __VLS_55 = {}.Container;
        /** @type {[typeof __VLS_components.Container, ]} */ ;
        // @ts-ignore
        const __VLS_56 = __VLS_asFunctionalComponent(__VLS_55, new __VLS_55({}));
        const __VLS_57 = __VLS_56({}, ...__VLS_functionalComponentArgsRest(__VLS_56));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        placeholder: "私有仓库填写",
    });
    (__VLS_ctx.form.git_username);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "password",
        placeholder: (__VLS_ctx.editingId ? '留空表示不修改' : '私有仓库填写'),
    });
    (__VLS_ctx.form.git_token);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "security-note full" },
    });
    const __VLS_59 = {}.ShieldCheck;
    /** @type {[typeof __VLS_components.ShieldCheck, ]} */ ;
    // @ts-ignore
    const __VLS_60 = __VLS_asFunctionalComponent(__VLS_59, new __VLS_59({}));
    const __VLS_61 = __VLS_60({}, ...__VLS_functionalComponentArgsRest(__VLS_60));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
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
    const __VLS_63 = {}.Server;
    /** @type {[typeof __VLS_components.Server, ]} */ ;
    // @ts-ignore
    const __VLS_64 = __VLS_asFunctionalComponent(__VLS_63, new __VLS_63({}));
    const __VLS_65 = __VLS_64({}, ...__VLS_functionalComponentArgsRest(__VLS_64));
    (__VLS_ctx.saving ? '正在保存...' : '保存并配置服务器');
    var __VLS_38;
}
if (__VLS_ctx.deleteCandidate) {
    /** @type {[typeof ModalShell, typeof ModalShell, ]} */ ;
    // @ts-ignore
    const __VLS_67 = __VLS_asFunctionalComponent(ModalShell, new ModalShell({
        ...{ 'onClose': {} },
        title: "删除项目",
        subtitle: "此操作不可恢复",
        size: "small",
    }));
    const __VLS_68 = __VLS_67({
        ...{ 'onClose': {} },
        title: "删除项目",
        subtitle: "此操作不可恢复",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_67));
    let __VLS_70;
    let __VLS_71;
    let __VLS_72;
    const __VLS_73 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.deleteCandidate))
                return;
            __VLS_ctx.deleteCandidate = null;
        }
    };
    __VLS_69.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-body delete-confirm-body" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "delete-warning-icon" },
    });
    const __VLS_74 = {}.AlertTriangle;
    /** @type {[typeof __VLS_components.AlertTriangle, ]} */ ;
    // @ts-ignore
    const __VLS_75 = __VLS_asFunctionalComponent(__VLS_74, new __VLS_74({}));
    const __VLS_76 = __VLS_75({}, ...__VLS_functionalComponentArgsRest(__VLS_75));
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
    const __VLS_78 = {}.Trash2;
    /** @type {[typeof __VLS_components.Trash2, ]} */ ;
    // @ts-ignore
    const __VLS_79 = __VLS_asFunctionalComponent(__VLS_78, new __VLS_78({}));
    const __VLS_80 = __VLS_79({}, ...__VLS_functionalComponentArgsRest(__VLS_79));
    (__VLS_ctx.deleting ? '正在删除...' : '确认删除项目');
    var __VLS_69;
}
/** @type {__VLS_StyleScopedClasses['content']} */ ;
/** @type {__VLS_StyleScopedClasses['compact']} */ ;
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
/** @type {__VLS_StyleScopedClasses['secondary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
/** @type {__VLS_StyleScopedClasses['form-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
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
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['security-note']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
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
            AlertTriangle: AlertTriangle,
            CheckCircle2: CheckCircle2,
            Container: Container,
            GitBranch: GitBranch,
            Pencil: Pencil,
            Plus: Plus,
            Rocket: Rocket,
            Server: Server,
            ShieldCheck: ShieldCheck,
            Trash2: Trash2,
            ModalShell: ModalShell,
            filter: filter,
            search: search,
            showCreate: showCreate,
            editingId: editingId,
            deleteCandidate: deleteCandidate,
            deleting: deleting,
            deleteError: deleteError,
            saving: saving,
            error: error,
            form: form,
            visible: visible,
            projectTargets: projectTargets,
            readyTargetCount: readyTargetCount,
            configureTargets: configureTargets,
            releaseProject: releaseProject,
            applyTemplate: applyTemplate,
            openCreate: openCreate,
            openDockerCreate: openDockerCreate,
            deploymentName: deploymentName,
            deploymentDetail: deploymentDetail,
            openEdit: openEdit,
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
