import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AlertTriangle, Check, Maximize2, Plus, RefreshCw, Rocket, Server, Trash2, X } from 'lucide-vue-next';
import { api } from '../api/client';
import ModalShell from '../components/ModalShell.vue';
import StatusTrack from '../components/StatusTrack.vue';
import { parseApiDate } from '../utils/datetime';
import { useAuthStore } from '../stores/auth';
const releases = ref([]);
const projects = ref([]);
const environments = ref([]);
const targets = ref([]);
const filter = ref('all');
const showCreate = ref(false);
const selected = ref(null);
const logExpanded = ref(false);
const deleteCandidate = ref(null);
const deleting = ref(false);
const deleteError = ref('');
const refreshingLogs = ref(false);
const saving = ref(false);
const error = ref('');
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const canOperate = computed(() => ['admin', 'release_manager', 'developer'].includes(auth.role));
const canManage = computed(() => ['admin', 'release_manager'].includes(auth.role));
let timer;
const form = reactive({ project_id: 0, environment_id: 0, version: '1.0.0', branch: 'main', strategy: 'rolling', artifact_url: '', notes: '' });
const visible = computed(() => releases.value.filter((item) => filter.value === 'all' || item.status === filter.value));
const selectedProject = computed(() => projects.value.find((item) => item.id === form.project_id));
const selectedTargets = computed(() => targets.value.filter((item) => item.project_id === form.project_id && item.environment_id === form.environment_id));
const readyTargets = computed(() => selectedTargets.value.filter((item) => item.connection_type === 'ssh' && item.status === 'online' && item.credential_configured));
async function load() {
    const [releaseResult, projectResult, environmentResult, targetResult] = await Promise.all([api.get('/releases'), api.get('/projects'), api.get('/environments'), api.get('/targets')]);
    releases.value = releaseResult.data;
    projects.value = projectResult.data;
    environments.value = environmentResult.data;
    targets.value = targetResult.data;
    if (!form.project_id && projects.value.length)
        selectProject(projects.value[0].id);
    if (!form.environment_id && environments.value.length)
        form.environment_id = environments.value.at(-1).id;
    if (selected.value)
        selected.value = releases.value.find((item) => item.id === selected.value?.id) || selected.value;
}
function selectProject(projectId) {
    form.project_id = projectId;
    const project = projects.value.find((item) => item.id === projectId);
    if (project)
        form.branch = project.default_branch;
    const preferred = environments.value.find((environment) => targets.value.some((item) => item.project_id === projectId && item.environment_id === environment.id && item.status === 'online' && item.credential_configured));
    if (preferred)
        form.environment_id = preferred.id;
}
function targetCount(environmentId) { return targets.value.filter((item) => item.project_id === form.project_id && item.environment_id === environmentId).length; }
function readyTargetCount(environmentId) { return targets.value.filter((item) => item.project_id === form.project_id && item.environment_id === environmentId && item.connection_type === 'ssh' && item.status === 'online' && item.credential_configured).length; }
function openCreate() { if (!canOperate.value)
    return; error.value = ''; showCreate.value = true; }
function configureTargets() { router.push(`/environments?project_id=${form.project_id}&create=1`); }
async function createRelease() {
    error.value = '';
    if (!form.version || !form.branch) {
        error.value = '请填写版本号和分支';
        return;
    }
    if (!readyTargets.value.length) {
        error.value = '所选环境没有连接正常且已配置凭证的 SSH 服务器';
        return;
    }
    saving.value = true;
    try {
        const { data } = await api.post('/releases', form);
        showCreate.value = false;
        selected.value = data;
        await router.replace('/releases');
        await load();
    }
    catch (exception) {
        error.value = exception.response?.data?.detail || '发布任务创建失败';
    }
    finally {
        saving.value = false;
    }
}
function duration(item) {
    if (!item.started_at)
        return '--';
    const end = item.finished_at ? parseApiDate(item.finished_at).getTime() : Date.now();
    const seconds = Math.max(0, Math.floor((end - parseApiDate(item.started_at).getTime()) / 1000));
    return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}
function activeStep(item) { return item.steps.find((step) => step.status === 'running') || item.steps.find((step) => step.status === 'failed') || item.steps.at(-1); }
function lastLog(item) { return item.logs.at(-1); }
function waitingMinutes(item) {
    if (!item.started_at || item.status !== 'running')
        return 0;
    return Math.floor(Math.max(0, Date.now() - parseApiDate(item.started_at).getTime()) / 60000);
}
function stepLabel(status) { return { running: '执行中', success: '已完成', failed: '失败', simulated: '仅模拟' }[status] || '等待中'; }
function closeRelease() { logExpanded.value = false; selected.value = null; }
function requestDelete(release) {
    if (!canManage.value)
        return;
    if (['pending', 'running'].includes(release.status))
        return;
    deleteError.value = '';
    deleteCandidate.value = release;
}
async function deleteRelease() {
    if (!deleteCandidate.value)
        return;
    deleting.value = true;
    deleteError.value = '';
    try {
        await api.delete(`/releases/${deleteCandidate.value.id}`);
        if (selected.value?.id === deleteCandidate.value.id)
            closeRelease();
        deleteCandidate.value = null;
        await load();
    }
    catch (exception) {
        deleteError.value = exception.response?.data?.detail || '发布记录删除失败';
    }
    finally {
        deleting.value = false;
    }
}
async function refreshSelectedRelease() {
    if (!selected.value || refreshingLogs.value)
        return;
    refreshingLogs.value = true;
    try {
        const { data } = await api.get(`/releases/${selected.value.id}`);
        const index = releases.value.findIndex((item) => item.id === data.id);
        if (index >= 0)
            releases.value[index] = data;
        selected.value = data;
    }
    finally {
        refreshingLogs.value = false;
    }
}
function handleKeydown(event) {
    if (event.key === 'Escape' && logExpanded.value)
        logExpanded.value = false;
}
function applyRouteIntent() {
    const projectId = Number(route.query.project_id || 0);
    if (projects.value.some((item) => item.id === projectId))
        selectProject(projectId);
    if (route.query.create)
        openCreate();
    const releaseId = Number(route.query.release_id || 0);
    if (releaseId)
        selected.value = releases.value.find((item) => item.id === releaseId) || null;
}
watch(() => route.query, () => { if (projects.value.length)
    applyRouteIntent(); });
watch(selected, (value) => { if (!value)
    logExpanded.value = false; });
onMounted(async () => {
    window.addEventListener('keydown', handleKeydown);
    await load();
    applyRouteIntent();
    timer = window.setInterval(() => { if (releases.value.some((item) => ['pending', 'running'].includes(item.status)))
        load(); }, 1500);
});
onBeforeUnmount(() => {
    window.clearInterval(timer);
    window.removeEventListener('keydown', handleKeydown);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "content compact releases-page" },
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.openCreate) },
    ...{ class: "primary-button" },
});
const __VLS_0 = {}.Plus;
/** @type {[typeof __VLS_components.Plus, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "toolbar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "filter-tabs" },
});
for (const [item] of __VLS_getVForSourceType(([{ k: 'all', n: '全部' }, { k: 'success', n: '成功' }, { k: 'running', n: '进行中' }, { k: 'failed', n: '失败' }, { k: 'simulated', n: '仅模拟' }]))) {
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.load) },
    ...{ class: "secondary-button" },
});
const __VLS_4 = {}.RefreshCw;
/** @type {[typeof __VLS_components.RefreshCw, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({}));
const __VLS_6 = __VLS_5({}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "pipeline-list" },
});
for (const [release] of __VLS_getVForSourceType((__VLS_ctx.visible))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selected = release;
            } },
        key: (release.id),
        ...{ class: "pipeline-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-cell" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-glyph" },
        ...{ class: (release.project_type) },
    });
    (release.project_type.slice(0, 4).toUpperCase());
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (release.project_name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (release.version);
    (release.release_no);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "env-pill" },
        ...{ class: ({ prod: release.environment_name === '生产环境' }) },
    });
    (release.environment_name);
    /** @type {[typeof StatusTrack, ]} */ ;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent(StatusTrack, new StatusTrack({
        stage: (release.current_stage),
        status: (release.status),
    }));
    const __VLS_9 = __VLS_8({
        stage: (release.current_stage),
        status: (release.status),
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "duration" },
    });
    (__VLS_ctx.duration(release));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (release.created_by);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "pipeline-row-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.requestDelete(release);
            } },
        ...{ class: "row-delete-button" },
        disabled: (['pending', 'running'].includes(release.status)),
        title: (['pending', 'running'].includes(release.status) ? '进行中的发布不能删除' : '删除发布记录'),
        'aria-label': "删除发布记录",
    });
    const __VLS_11 = {}.Trash2;
    /** @type {[typeof __VLS_components.Trash2, ]} */ ;
    // @ts-ignore
    const __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11({}));
    const __VLS_13 = __VLS_12({}, ...__VLS_functionalComponentArgsRest(__VLS_12));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
}
if (!__VLS_ctx.visible.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "list-empty" },
    });
}
if (__VLS_ctx.showCreate) {
    /** @type {[typeof ModalShell, typeof ModalShell, ]} */ ;
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent(ModalShell, new ModalShell({
        ...{ 'onClose': {} },
        title: "发起发布",
        subtitle: "创建一条可追踪、可回滚的标准发布",
    }));
    const __VLS_16 = __VLS_15({
        ...{ 'onClose': {} },
        title: "发起发布",
        subtitle: "创建一条可追踪、可回滚的标准发布",
    }, ...__VLS_functionalComponentArgsRest(__VLS_15));
    let __VLS_18;
    let __VLS_19;
    let __VLS_20;
    const __VLS_21 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.showCreate))
                return;
            __VLS_ctx.showCreate = false;
        }
    };
    __VLS_17.slots.default;
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
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        ...{ onChange: (...[$event]) => {
                if (!(__VLS_ctx.showCreate))
                    return;
                __VLS_ctx.selectProject(Number($event.target.value));
            } },
        value: (__VLS_ctx.form.project_id),
    });
    for (const [project] of __VLS_getVForSourceType((__VLS_ctx.projects))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (project.id),
            value: (project.id),
        });
        (project.name);
        (project.deployment_mode === 'docker' ? 'Docker 部署' : project.project_type);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({});
    (__VLS_ctx.form.branch);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({});
    (__VLS_ctx.form.version);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.form.environment_id),
    });
    for (const [environment] of __VLS_getVForSourceType((__VLS_ctx.environments))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (environment.id),
            value: (environment.id),
        });
        (environment.name);
        (__VLS_ctx.readyTargetCount(environment.id));
        (__VLS_ctx.targetCount(environment.id));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.form.strategy),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "rolling",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "blue_green",
        disabled: true,
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "canary",
        disabled: true,
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "release-target-preview full" },
        ...{ class: ({ blocked: !__VLS_ctx.readyTargets.length }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "release-target-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.selectedProject?.name);
    (__VLS_ctx.environments.find(item => item.id === __VLS_ctx.form.environment_id)?.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)({});
    (__VLS_ctx.readyTargets.length);
    (__VLS_ctx.selectedTargets.length);
    if (__VLS_ctx.selectedTargets.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "release-target-list" },
        });
        for (const [target] of __VLS_getVForSourceType((__VLS_ctx.selectedTargets))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (target.id),
            });
            const __VLS_22 = {}.Server;
            /** @type {[typeof __VLS_components.Server, ]} */ ;
            // @ts-ignore
            const __VLS_23 = __VLS_asFunctionalComponent(__VLS_22, new __VLS_22({}));
            const __VLS_24 = __VLS_23({}, ...__VLS_functionalComponentArgsRest(__VLS_23));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            (target.name);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (target.address);
            (target.port);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.em, __VLS_intrinsicElements.em)({
                ...{ class: ({ ready: __VLS_ctx.readyTargets.some(item => item.id === target.id) }) },
            });
            (__VLS_ctx.readyTargets.some(item => item.id === target.id) ? '就绪' : target.status === 'offline' ? '连接失败' : !target.credential_configured ? '未配置凭证' : '未测试');
        }
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "release-target-empty" },
        });
        const __VLS_26 = {}.AlertTriangle;
        /** @type {[typeof __VLS_components.AlertTriangle, ]} */ ;
        // @ts-ignore
        const __VLS_27 = __VLS_asFunctionalComponent(__VLS_26, new __VLS_26({}));
        const __VLS_28 = __VLS_27({}, ...__VLS_functionalComponentArgsRest(__VLS_27));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.configureTargets) },
            ...{ class: "secondary-button" },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea)({
        value: (__VLS_ctx.form.notes),
        placeholder: "例如：修复登录问题，发布后观察 10 分钟",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "security-note full" },
    });
    const __VLS_30 = {}.Rocket;
    /** @type {[typeof __VLS_components.Rocket, ]} */ ;
    // @ts-ignore
    const __VLS_31 = __VLS_asFunctionalComponent(__VLS_30, new __VLS_30({}));
    const __VLS_32 = __VLS_31({}, ...__VLS_functionalComponentArgsRest(__VLS_31));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.selectedProject?.deployment_mode === 'docker' ? '将执行真实 Docker 发布' : '将执行真实文件发布');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.selectedProject?.deployment_mode === 'docker' ? '平台会上传代码到目标服务器，构建镜像、更新容器并检查健康状态。' : '平台会构建制品，并只部署到上方显示为“就绪”的目标服务器。');
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
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.createRelease) },
        ...{ class: "primary-button" },
        disabled: (__VLS_ctx.saving || !__VLS_ctx.readyTargets.length),
    });
    const __VLS_34 = {}.Rocket;
    /** @type {[typeof __VLS_components.Rocket, ]} */ ;
    // @ts-ignore
    const __VLS_35 = __VLS_asFunctionalComponent(__VLS_34, new __VLS_34({}));
    const __VLS_36 = __VLS_35({}, ...__VLS_functionalComponentArgsRest(__VLS_35));
    (__VLS_ctx.saving ? '正在创建...' : __VLS_ctx.readyTargets.length ? `确认发布到 ${__VLS_ctx.readyTargets.length} 台服务器` : '请先配置可用服务器');
    var __VLS_17;
}
if (__VLS_ctx.deleteCandidate) {
    /** @type {[typeof ModalShell, typeof ModalShell, ]} */ ;
    // @ts-ignore
    const __VLS_38 = __VLS_asFunctionalComponent(ModalShell, new ModalShell({
        ...{ 'onClose': {} },
        title: "删除发布记录",
        subtitle: "此操作不可恢复",
        size: "small",
    }));
    const __VLS_39 = __VLS_38({
        ...{ 'onClose': {} },
        title: "删除发布记录",
        subtitle: "此操作不可恢复",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_38));
    let __VLS_41;
    let __VLS_42;
    let __VLS_43;
    const __VLS_44 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.deleteCandidate))
                return;
            __VLS_ctx.deleteCandidate = null;
        }
    };
    __VLS_40.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-body delete-confirm-body" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "delete-warning-icon" },
    });
    const __VLS_45 = {}.AlertTriangle;
    /** @type {[typeof __VLS_components.AlertTriangle, ]} */ ;
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({}));
    const __VLS_47 = __VLS_46({}, ...__VLS_functionalComponentArgsRest(__VLS_46));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.deleteCandidate.release_no);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.deleteCandidate.project_name);
    (__VLS_ctx.deleteCandidate.version);
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
        ...{ onClick: (__VLS_ctx.deleteRelease) },
        ...{ class: "danger-button" },
        disabled: (__VLS_ctx.deleting),
    });
    const __VLS_49 = {}.Trash2;
    /** @type {[typeof __VLS_components.Trash2, ]} */ ;
    // @ts-ignore
    const __VLS_50 = __VLS_asFunctionalComponent(__VLS_49, new __VLS_49({}));
    const __VLS_51 = __VLS_50({}, ...__VLS_functionalComponentArgsRest(__VLS_50));
    (__VLS_ctx.deleting ? '正在删除...' : '确认删除记录');
    var __VLS_40;
}
if (__VLS_ctx.selected) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onMousedown: (__VLS_ctx.closeRelease) },
        ...{ class: "drawer-wrap" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({
        ...{ class: "drawer release-drawer" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "drawer-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "drawer-title" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-glyph" },
        ...{ class: (__VLS_ctx.selected.project_type) },
    });
    (__VLS_ctx.selected.project_type.slice(0, 4).toUpperCase());
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (__VLS_ctx.selected.release_no);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.selected.project_name);
    (__VLS_ctx.selected.version);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.closeRelease) },
        ...{ class: "icon-button" },
        'aria-label': "关闭发布详情",
    });
    const __VLS_53 = {}.X;
    /** @type {[typeof __VLS_components.X, ]} */ ;
    // @ts-ignore
    const __VLS_54 = __VLS_asFunctionalComponent(__VLS_53, new __VLS_53({}));
    const __VLS_55 = __VLS_54({}, ...__VLS_functionalComponentArgsRest(__VLS_54));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "drawer-body" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-status" },
        ...{ class: (__VLS_ctx.selected.status) },
    });
    const __VLS_57 = ((__VLS_ctx.selected.status === 'success' ? __VLS_ctx.Check : __VLS_ctx.RefreshCw));
    // @ts-ignore
    const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({}));
    const __VLS_59 = __VLS_58({}, ...__VLS_functionalComponentArgsRest(__VLS_58));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.selected.status === 'success' ? '真实发布成功' : __VLS_ctx.selected.status === 'simulated' ? '仅模拟完成，未操作服务器' : __VLS_ctx.selected.status === 'failed' ? '发布失败' : '发布正在执行');
    if (__VLS_ctx.selected.status === 'running') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.activeStep(__VLS_ctx.selected)?.name || '准备执行');
        (__VLS_ctx.waitingMinutes(__VLS_ctx.selected));
    }
    if (__VLS_ctx.selected.status === 'running') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "release-live-summary" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (__VLS_ctx.activeStep(__VLS_ctx.selected)?.name || '准备中');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.lastLog(__VLS_ctx.selected) ? __VLS_ctx.parseApiDate(__VLS_ctx.lastLog(__VLS_ctx.selected).created_at).toLocaleTimeString('zh-CN') : '暂无');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-section" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-stage-list" },
    });
    for (const [stepItem] of __VLS_getVForSourceType((__VLS_ctx.selected.steps))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (stepItem.id),
            ...{ class: "detail-stage" },
            ...{ class: (stepItem.status) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (stepItem.sequence);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (stepItem.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        (__VLS_ctx.stepLabel(stepItem.status));
        (stepItem.status === 'running' ? ` · ${__VLS_ctx.duration({ ...__VLS_ctx.selected, started_at: stepItem.started_at })}` : '');
    }
    if (__VLS_ctx.selected.deployments.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "detail-section" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "deployment-results" },
        });
        for (const [item] of __VLS_getVForSourceType((__VLS_ctx.selected.deployments))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (item.id),
                ...{ class: "deployment-result" },
                ...{ class: (item.status) },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            (item.target_name);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (item.status === 'success' ? '部署成功' : item.status === 'skipped' ? '已跳过' : item.status === 'running' ? '部署中' : '部署失败');
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
            (item.message || (item.status === 'running' ? '已连接目标服务器，正在执行远程命令...' : ''));
            if (item.deployed_path) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.code, __VLS_intrinsicElements.code)({});
                (item.deployed_path);
            }
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-section" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({});
    if (__VLS_ctx.selected.logs.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        (__VLS_ctx.selected.logs.length);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "terminal detail-terminal" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "terminal-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.selected.release_no);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "terminal-head-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.lastLog(__VLS_ctx.selected) ? __VLS_ctx.parseApiDate(__VLS_ctx.lastLog(__VLS_ctx.selected).created_at).toLocaleTimeString('zh-CN') : '--');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.refreshSelectedRelease) },
        ...{ class: "terminal-refresh-button" },
        ...{ class: ({ spinning: __VLS_ctx.refreshingLogs }) },
        disabled: (__VLS_ctx.refreshingLogs),
        title: "刷新日志",
        'aria-label': "刷新日志",
    });
    const __VLS_61 = {}.RefreshCw;
    /** @type {[typeof __VLS_components.RefreshCw, ]} */ ;
    // @ts-ignore
    const __VLS_62 = __VLS_asFunctionalComponent(__VLS_61, new __VLS_61({}));
    const __VLS_63 = __VLS_62({}, ...__VLS_functionalComponentArgsRest(__VLS_62));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.selected))
                    return;
                __VLS_ctx.logExpanded = true;
            } },
        ...{ class: "terminal-expand-button" },
        title: "放大查看日志",
        'aria-label': "放大查看日志",
    });
    const __VLS_65 = {}.Maximize2;
    /** @type {[typeof __VLS_components.Maximize2, ]} */ ;
    // @ts-ignore
    const __VLS_66 = __VLS_asFunctionalComponent(__VLS_65, new __VLS_65({}));
    const __VLS_67 = __VLS_66({}, ...__VLS_functionalComponentArgsRest(__VLS_66));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "terminal-body" },
    });
    for (const [log] of __VLS_getVForSourceType((__VLS_ctx.selected.logs))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (log.id),
            ...{ class: "log-line" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "log-time" },
        });
        (__VLS_ctx.parseApiDate(log.created_at).toLocaleTimeString('zh-CN'));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: ({ 'log-ok': log.level === 'SUCCESS', 'log-warn': ['ERROR', 'WARNING'].includes(log.level) }) },
        });
        (log.level.padEnd(7));
        (log.message);
    }
    if (!__VLS_ctx.selected.logs.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
}
const __VLS_69 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
// @ts-ignore
const __VLS_70 = __VLS_asFunctionalComponent(__VLS_69, new __VLS_69({
    to: "body",
}));
const __VLS_71 = __VLS_70({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_70));
__VLS_72.slots.default;
if (__VLS_ctx.logExpanded && __VLS_ctx.selected) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onMousedown: (...[$event]) => {
                if (!(__VLS_ctx.logExpanded && __VLS_ctx.selected))
                    return;
                __VLS_ctx.logExpanded = false;
            } },
        ...{ class: "log-viewer-backdrop" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "log-viewer" },
        role: "dialog",
        'aria-modal': "true",
        'aria-label': "发布实时日志",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
        ...{ class: "log-viewer-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    (__VLS_ctx.selected.release_no);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.selected.project_name);
    (__VLS_ctx.selected.version);
    (__VLS_ctx.selected.logs.length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "log-viewer-meta" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.refreshSelectedRelease) },
        ...{ class: "log-refresh-button" },
        ...{ class: ({ spinning: __VLS_ctx.refreshingLogs }) },
        disabled: (__VLS_ctx.refreshingLogs),
        'aria-label': "刷新日志",
        title: "刷新日志",
    });
    const __VLS_73 = {}.RefreshCw;
    /** @type {[typeof __VLS_components.RefreshCw, ]} */ ;
    // @ts-ignore
    const __VLS_74 = __VLS_asFunctionalComponent(__VLS_73, new __VLS_73({}));
    const __VLS_75 = __VLS_74({}, ...__VLS_functionalComponentArgsRest(__VLS_74));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.lastLog(__VLS_ctx.selected) ? __VLS_ctx.parseApiDate(__VLS_ctx.lastLog(__VLS_ctx.selected).created_at).toLocaleTimeString('zh-CN') : '--');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.logExpanded && __VLS_ctx.selected))
                    return;
                __VLS_ctx.logExpanded = false;
            } },
        'aria-label': "退出放大查看",
        title: "退出放大查看",
    });
    const __VLS_77 = {}.X;
    /** @type {[typeof __VLS_components.X, ]} */ ;
    // @ts-ignore
    const __VLS_78 = __VLS_asFunctionalComponent(__VLS_77, new __VLS_77({}));
    const __VLS_79 = __VLS_78({}, ...__VLS_functionalComponentArgsRest(__VLS_78));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "terminal log-viewer-terminal" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "terminal-body" },
    });
    for (const [log] of __VLS_getVForSourceType((__VLS_ctx.selected.logs))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (log.id),
            ...{ class: "log-line" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "log-time" },
        });
        (__VLS_ctx.parseApiDate(log.created_at).toLocaleTimeString('zh-CN'));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: ({ 'log-ok': log.level === 'SUCCESS', 'log-warn': ['ERROR', 'WARNING'].includes(log.level) }) },
        });
        (log.level.padEnd(7));
        (log.message);
    }
    if (!__VLS_ctx.selected.logs.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
}
var __VLS_72;
/** @type {__VLS_StyleScopedClasses['content']} */ ;
/** @type {__VLS_StyleScopedClasses['compact']} */ ;
/** @type {__VLS_StyleScopedClasses['releases-page']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-row']} */ ;
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-spacer']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['pipeline-list']} */ ;
/** @type {__VLS_StyleScopedClasses['pipeline-row']} */ ;
/** @type {__VLS_StyleScopedClasses['project-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['project-glyph']} */ ;
/** @type {__VLS_StyleScopedClasses['env-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['prod']} */ ;
/** @type {__VLS_StyleScopedClasses['duration']} */ ;
/** @type {__VLS_StyleScopedClasses['pipeline-row-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['row-delete-button']} */ ;
/** @type {__VLS_StyleScopedClasses['list-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
/** @type {__VLS_StyleScopedClasses['form-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['release-target-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['blocked']} */ ;
/** @type {__VLS_StyleScopedClasses['release-target-head']} */ ;
/** @type {__VLS_StyleScopedClasses['release-target-list']} */ ;
/** @type {__VLS_StyleScopedClasses['ready']} */ ;
/** @type {__VLS_StyleScopedClasses['release-target-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['security-note']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['error-text']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-foot']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost-button']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
/** @type {__VLS_StyleScopedClasses['delete-confirm-body']} */ ;
/** @type {__VLS_StyleScopedClasses['delete-warning-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['error-text']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-foot']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost-button']} */ ;
/** @type {__VLS_StyleScopedClasses['danger-button']} */ ;
/** @type {__VLS_StyleScopedClasses['drawer-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['drawer']} */ ;
/** @type {__VLS_StyleScopedClasses['release-drawer']} */ ;
/** @type {__VLS_StyleScopedClasses['drawer-head']} */ ;
/** @type {__VLS_StyleScopedClasses['drawer-title']} */ ;
/** @type {__VLS_StyleScopedClasses['project-glyph']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-button']} */ ;
/** @type {__VLS_StyleScopedClasses['drawer-body']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-status']} */ ;
/** @type {__VLS_StyleScopedClasses['release-live-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-section']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-stage-list']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-stage']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-section']} */ ;
/** @type {__VLS_StyleScopedClasses['deployment-results']} */ ;
/** @type {__VLS_StyleScopedClasses['deployment-result']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-section']} */ ;
/** @type {__VLS_StyleScopedClasses['terminal']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-terminal']} */ ;
/** @type {__VLS_StyleScopedClasses['terminal-head']} */ ;
/** @type {__VLS_StyleScopedClasses['terminal-head-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['terminal-refresh-button']} */ ;
/** @type {__VLS_StyleScopedClasses['spinning']} */ ;
/** @type {__VLS_StyleScopedClasses['terminal-expand-button']} */ ;
/** @type {__VLS_StyleScopedClasses['terminal-body']} */ ;
/** @type {__VLS_StyleScopedClasses['log-line']} */ ;
/** @type {__VLS_StyleScopedClasses['log-time']} */ ;
/** @type {__VLS_StyleScopedClasses['log-ok']} */ ;
/** @type {__VLS_StyleScopedClasses['log-warn']} */ ;
/** @type {__VLS_StyleScopedClasses['log-viewer-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['log-viewer']} */ ;
/** @type {__VLS_StyleScopedClasses['log-viewer-head']} */ ;
/** @type {__VLS_StyleScopedClasses['log-viewer-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['log-refresh-button']} */ ;
/** @type {__VLS_StyleScopedClasses['spinning']} */ ;
/** @type {__VLS_StyleScopedClasses['terminal']} */ ;
/** @type {__VLS_StyleScopedClasses['log-viewer-terminal']} */ ;
/** @type {__VLS_StyleScopedClasses['terminal-body']} */ ;
/** @type {__VLS_StyleScopedClasses['log-line']} */ ;
/** @type {__VLS_StyleScopedClasses['log-time']} */ ;
/** @type {__VLS_StyleScopedClasses['log-ok']} */ ;
/** @type {__VLS_StyleScopedClasses['log-warn']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            AlertTriangle: AlertTriangle,
            Check: Check,
            Maximize2: Maximize2,
            Plus: Plus,
            RefreshCw: RefreshCw,
            Rocket: Rocket,
            Server: Server,
            Trash2: Trash2,
            X: X,
            ModalShell: ModalShell,
            StatusTrack: StatusTrack,
            parseApiDate: parseApiDate,
            projects: projects,
            environments: environments,
            filter: filter,
            showCreate: showCreate,
            selected: selected,
            logExpanded: logExpanded,
            deleteCandidate: deleteCandidate,
            deleting: deleting,
            deleteError: deleteError,
            refreshingLogs: refreshingLogs,
            saving: saving,
            error: error,
            auth: auth,
            form: form,
            visible: visible,
            selectedProject: selectedProject,
            selectedTargets: selectedTargets,
            readyTargets: readyTargets,
            load: load,
            selectProject: selectProject,
            targetCount: targetCount,
            readyTargetCount: readyTargetCount,
            openCreate: openCreate,
            configureTargets: configureTargets,
            createRelease: createRelease,
            duration: duration,
            activeStep: activeStep,
            lastLog: lastLog,
            waitingMinutes: waitingMinutes,
            stepLabel: stepLabel,
            closeRelease: closeRelease,
            requestDelete: requestDelete,
            deleteRelease: deleteRelease,
            refreshSelectedRelease: refreshSelectedRelease,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
