import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AlertTriangle, ArrowRight, Check, FolderKanban, KeyRound, Network, Pencil, Plus, RefreshCw, Server, ShieldCheck, Terminal, Trash2, Unplug } from 'lucide-vue-next';
import { api } from '../api/client';
import ModalShell from '../components/ModalShell.vue';
import { useAuthStore } from '../stores/auth';
const targets = ref([]);
const environments = ref([]);
const projects = ref([]);
const selectedProjectId = ref(0);
const selectedEnvironmentId = ref(null);
const showCreate = ref(false);
const editingId = ref(null);
const deleteCandidate = ref(null);
const deleting = ref(false);
const deleteError = ref('');
const step = ref(1);
const testingId = ref(null);
const testingAll = ref(false);
const message = ref('');
const error = ref('');
const saving = ref(false);
const readyProjectId = ref(null);
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const canManage = computed(() => ['admin', 'release_manager'].includes(auth.role));
const form = reactive({ project_id: 0, environment_id: 0, name: '', connection_type: 'ssh', address: '', port: 22, username: 'deploy', auth_type: 'password', password: '', private_key: '', passphrase: '', host_key_fingerprint: '', trust_on_first_use: true, service_port: 8080, deploy_path: '/opt/apps/{project}/releases/{version}', start_command: 'systemctl restart {project}', stop_command: 'systemctl stop {project}', health_check_command: 'curl --fail http://127.0.0.1:{service_port}/health' });
const projectTargets = computed(() => selectedProjectId.value
    ? targets.value.filter((item) => item.project_id === selectedProjectId.value)
    : targets.value);
const online = computed(() => projectTargets.value.filter((item) => item.status === 'online').length);
const visibleTargets = computed(() => selectedEnvironmentId.value === null
    ? projectTargets.value
    : projectTargets.value.filter((item) => item.environment_id === selectedEnvironmentId.value));
const selectedEnvironment = computed(() => environments.value.find((item) => item.id === selectedEnvironmentId.value));
const selectedProject = computed(() => projects.value.find((item) => item.id === selectedProjectId.value));
const formProject = computed(() => projects.value.find((item) => item.id === Number(form.project_id)));
function environmentStatus(environment) {
    const items = projectTargets.value.filter((item) => item.environment_id === environment.id);
    return { total: items.length, online: items.filter((item) => item.status === 'online').length };
}
function applyProjectTargetDefaults() {
    if (editingId.value)
        return;
    const project = projects.value.find((item) => item.id === Number(form.project_id));
    if (project) {
        form.health_check_command = `curl --fail http://127.0.0.1:{service_port}${project.health_path || '/health'}`;
        if (project.deployment_mode === 'docker')
            form.service_port = project.docker_container_port;
    }
}
async function load() {
    const [targetResult, environmentResult, projectResult] = await Promise.all([api.get('/targets'), api.get('/environments'), api.get('/projects')]);
    targets.value = targetResult.data;
    environments.value = environmentResult.data;
    projects.value = projectResult.data;
    if (!form.environment_id && environments.value.length)
        form.environment_id = environments.value.at(-1).id;
    if (!form.project_id && projects.value.length)
        form.project_id = projects.value[0].id;
}
function openCreate() {
    if (!canManage.value)
        return;
    editingId.value = null;
    Object.assign(form, { name: '', connection_type: 'ssh', address: '', port: 22, username: 'deploy', auth_type: 'password', password: '', private_key: '', passphrase: '', host_key_fingerprint: '', trust_on_first_use: true, service_port: 8080, deploy_path: '/opt/apps/{project}/releases/{version}', start_command: 'systemctl restart {project}', stop_command: 'systemctl stop {project}', health_check_command: 'curl --fail http://127.0.0.1:{service_port}/health' });
    if (environments.value.length)
        form.environment_id = environments.value.at(-1).id;
    form.project_id = selectedProjectId.value || projects.value[0]?.id || 0;
    applyProjectTargetDefaults();
    step.value = 2;
    error.value = '';
    message.value = '';
    readyProjectId.value = null;
    showCreate.value = true;
}
function openEdit(target) {
    if (!canManage.value)
        return;
    editingId.value = target.id;
    Object.assign(form, { ...target, password: '', private_key: '', passphrase: '' });
    step.value = 2;
    error.value = '';
    message.value = '';
    showCreate.value = true;
}
async function testTarget(target) {
    testingId.value = target.id;
    message.value = '';
    try {
        const { data } = await api.post(`/targets/${target.id}/test`, {});
        message.value = `${target.name}：${data.message}，延迟 ${data.latency_ms} ms`;
        await load();
    }
    catch (exception) {
        message.value = exception.response?.data?.detail || '连接测试失败';
    }
    finally {
        testingId.value = null;
    }
}
async function testVisibleTargets() {
    if (!visibleTargets.value.length)
        return;
    testingAll.value = true;
    let passed = 0;
    const failures = [];
    for (const target of visibleTargets.value) {
        testingId.value = target.id;
        try {
            const { data } = await api.post(`/targets/${target.id}/test`, {});
            if (data.success)
                passed += 1;
            else
                failures.push(target.name);
        }
        catch {
            failures.push(target.name);
        }
    }
    testingId.value = null;
    testingAll.value = false;
    message.value = `连接检查完成：${passed} 台通过，${failures.length} 台失败${failures.length ? `（${failures.join('、')}）` : ''}`;
    await load();
}
async function saveTarget() {
    error.value = '';
    if (!form.project_id) {
        error.value = '请选择这台服务器用于哪个项目';
        return;
    }
    if (!form.name || !form.address) {
        error.value = '请填写服务器名称和 IP / 域名';
        return;
    }
    saving.value = true;
    try {
        const { data } = editingId.value ? await api.put(`/targets/${editingId.value}`, form) : await api.post('/targets', form);
        editingId.value = data.id;
        const test = (await api.post(`/targets/${data.id}/test`, {})).data;
        if (!test.success) {
            error.value = test.message;
            await load();
            return;
        }
        showCreate.value = false;
        message.value = `${data.name} 已保存并通过真实 SSH 连接测试，指纹 ${test.host_key_fingerprint}`;
        readyProjectId.value = data.project_id;
        await router.replace(`/environments?project_id=${data.project_id}`);
        await load();
    }
    catch (exception) {
        error.value = exception.response?.data?.detail || '目标服务器保存失败';
    }
    finally {
        saving.value = false;
    }
}
function requestDelete(target) {
    if (!canManage.value)
        return;
    deleteError.value = '';
    deleteCandidate.value = target;
}
async function deleteTarget() {
    if (!deleteCandidate.value)
        return;
    deleting.value = true;
    deleteError.value = '';
    try {
        await api.delete(`/targets/${deleteCandidate.value.id}`);
        deleteCandidate.value = null;
        await load();
    }
    catch (exception) {
        deleteError.value = exception.response?.data?.detail || '目标服务器删除失败';
    }
    finally {
        deleting.value = false;
    }
}
function goRelease() {
    if (readyProjectId.value)
        router.push(`/releases?create=1&project_id=${readyProjectId.value}`);
}
onMounted(async () => {
    await load();
    const projectId = Number(route.query.project_id || 0);
    if (projects.value.some((item) => item.id === projectId)) {
        selectedProjectId.value = projectId;
        form.project_id = projectId;
    }
    if (route.query.create)
        openCreate();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "content compact environments-page" },
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
(__VLS_ctx.selectedProject ? `为 ${__VLS_ctx.selectedProject.name} 添加服务器` : '添加目标服务器');
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "environment-explainer" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "explain-icon" },
});
const __VLS_4 = {}.FolderKanban;
/** @type {[typeof __VLS_components.FolderKanban, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({}));
const __VLS_6 = __VLS_5({}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
const __VLS_8 = {}.ArrowRight;
/** @type {[typeof __VLS_components.ArrowRight, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({}));
const __VLS_10 = __VLS_9({}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "explain-number" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
const __VLS_12 = {}.ArrowRight;
/** @type {[typeof __VLS_components.ArrowRight, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({}));
const __VLS_14 = __VLS_13({}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "explain-icon" },
});
const __VLS_16 = {}.Server;
/** @type {[typeof __VLS_components.Server, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({}));
const __VLS_18 = __VLS_17({}, ...__VLS_functionalComponentArgsRest(__VLS_17));
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "project-scope" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    ...{ onChange: (...[$event]) => {
            __VLS_ctx.selectedEnvironmentId = null;
        } },
    value: (__VLS_ctx.selectedProjectId),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: (0),
});
for (const [project] of __VLS_getVForSourceType((__VLS_ctx.projects))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (project.id),
        value: (project.id),
    });
    (project.name);
}
if (__VLS_ctx.selectedProject) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "scope-result" },
    });
    (__VLS_ctx.selectedProject.name);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "environment-summary" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.selectedEnvironmentId = null;
        } },
    ...{ class: "environment-summary-card all" },
    ...{ class: ({ active: __VLS_ctx.selectedEnvironmentId === null }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.projectTargets.length);
__VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
(__VLS_ctx.online);
for (const [environment] of __VLS_getVForSourceType((__VLS_ctx.environments))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectedEnvironmentId = environment.id;
            } },
        key: (environment.id),
        ...{ class: "environment-summary-card" },
        ...{ class: ({ active: __VLS_ctx.selectedEnvironmentId === environment.id }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (environment.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.environmentStatus(environment).total);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
    (__VLS_ctx.environmentStatus(environment).online);
    (environment.release_window);
}
if (__VLS_ctx.message) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "inline-notice" },
    });
    const __VLS_20 = {}.Check;
    /** @type {[typeof __VLS_components.Check, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({}));
    const __VLS_22 = __VLS_21({}, ...__VLS_functionalComponentArgsRest(__VLS_21));
    (__VLS_ctx.message);
    if (__VLS_ctx.readyProjectId) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.goRelease) },
            ...{ class: "notice-action" },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.message))
                    return;
                __VLS_ctx.message = '';
            } },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "toolbar environment-toolbar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({
    ...{ class: "server-list-title" },
});
(__VLS_ctx.selectedProject?.name || '所有项目');
(__VLS_ctx.selectedEnvironment?.name || '全部环境');
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "server-list-tip" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
    ...{ class: "toolbar-spacer" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.testVisibleTargets) },
    ...{ class: "secondary-button" },
    disabled: (__VLS_ctx.testingAll || !__VLS_ctx.visibleTargets.length),
});
const __VLS_24 = {}.Terminal;
/** @type {[typeof __VLS_components.Terminal, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({}));
const __VLS_26 = __VLS_25({}, ...__VLS_functionalComponentArgsRest(__VLS_25));
(__VLS_ctx.testingAll ? '正在逐台测试...' : '测试当前列表');
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.load) },
    ...{ class: "secondary-button" },
});
const __VLS_28 = {}.RefreshCw;
/** @type {[typeof __VLS_components.RefreshCw, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({}));
const __VLS_30 = __VLS_29({}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "panel target-table" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "target-table-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span)({});
for (const [target] of __VLS_getVForSourceType((__VLS_ctx.visibleTargets))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (target.id),
        ...{ class: "target-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "target-name" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "method-icon" },
        ...{ class: (target.connection_type) },
    });
    const __VLS_32 = ((target.connection_type === 'ssh' ? __VLS_ctx.Terminal : target.connection_type === 'kubernetes' ? __VLS_ctx.Network : __VLS_ctx.Unplug));
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({}));
    const __VLS_34 = __VLS_33({}, ...__VLS_functionalComponentArgsRest(__VLS_33));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (target.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (target.address);
    (target.port);
    (target.service_port);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({
        ...{ class: "target-env" },
    });
    (target.project_name || '未绑定项目');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "target-workload" },
    });
    (target.environment_name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "method-pill" },
    });
    (target.connection_type.toUpperCase());
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "connection-status" },
        ...{ class: (target.status) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.i)({});
    (target.status === 'online' ? '连接正常' : target.status === 'offline' ? '连接失败' : '尚未测试');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "target-workload" },
    });
    (target.system_info || '等待连接后探测');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "target-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.openEdit(target);
            } },
        ...{ class: "secondary-button" },
    });
    const __VLS_36 = {}.Pencil;
    /** @type {[typeof __VLS_components.Pencil, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({}));
    const __VLS_38 = __VLS_37({}, ...__VLS_functionalComponentArgsRest(__VLS_37));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.testTarget(target);
            } },
        ...{ class: "secondary-button" },
        disabled: (__VLS_ctx.testingId === target.id),
    });
    (__VLS_ctx.testingId === target.id ? '测试中...' : '测试连接');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.requestDelete(target);
            } },
        ...{ class: "icon-button delete-icon-button" },
        title: "删除服务器",
        'aria-label': "删除服务器",
    });
    const __VLS_40 = {}.Trash2;
    /** @type {[typeof __VLS_components.Trash2, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({}));
    const __VLS_42 = __VLS_41({}, ...__VLS_functionalComponentArgsRest(__VLS_41));
}
if (!__VLS_ctx.visibleTargets.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "list-empty" },
    });
}
if (__VLS_ctx.showCreate) {
    /** @type {[typeof ModalShell, typeof ModalShell, ]} */ ;
    // @ts-ignore
    const __VLS_44 = __VLS_asFunctionalComponent(ModalShell, new ModalShell({
        ...{ 'onClose': {} },
        title: (__VLS_ctx.editingId ? '配置目标服务器' : '添加目标服务器'),
        subtitle: "目标服务器是最终接收制品并运行应用的真实机器",
    }));
    const __VLS_45 = __VLS_44({
        ...{ 'onClose': {} },
        title: (__VLS_ctx.editingId ? '配置目标服务器' : '添加目标服务器'),
        subtitle: "目标服务器是最终接收制品并运行应用的真实机器",
    }, ...__VLS_functionalComponentArgsRest(__VLS_44));
    let __VLS_47;
    let __VLS_48;
    let __VLS_49;
    const __VLS_50 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.showCreate))
                return;
            __VLS_ctx.showCreate = false;
        }
    };
    __VLS_46.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stepper" },
    });
    for (const [name, index] of __VLS_getVForSourceType((['连接方式', '连接配置', '部署模板']))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (name),
            ...{ class: "step" },
            ...{ class: ({ active: __VLS_ctx.step === index + 1, done: __VLS_ctx.step > index + 1 }) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "step-index" },
        });
        (__VLS_ctx.step > index + 1 ? '✓' : index + 1);
        (name);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-body target-modal-body" },
    });
    if (__VLS_ctx.step === 1) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "method-choice-grid" },
        });
        for (const [method] of __VLS_getVForSourceType(([{ key: 'ssh', title: 'SSH 直连', icon: __VLS_ctx.Terminal, desc: '当前已支持：上传制品、切换版本、重启、健康检查与单机失败回滚。', enabled: true }, { key: 'agent', title: '轻量 Agent', icon: __VLS_ctx.Unplug, desc: '规划中，暂不能执行真实发布。', enabled: false }, { key: 'kubernetes', title: 'Kubernetes', icon: __VLS_ctx.Network, desc: '规划中，暂不能执行真实发布。', enabled: false }]))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showCreate))
                            return;
                        if (!(__VLS_ctx.step === 1))
                            return;
                        __VLS_ctx.form.connection_type = method.key;
                    } },
                key: (method.key),
                ...{ class: "method-choice" },
                ...{ class: ({ selected: __VLS_ctx.form.connection_type === method.key, disabled: !method.enabled }) },
                disabled: (!method.enabled),
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "method-choice-top" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "method-choice-icon" },
            });
            const __VLS_51 = ((method.icon));
            // @ts-ignore
            const __VLS_52 = __VLS_asFunctionalComponent(__VLS_51, new __VLS_51({}));
            const __VLS_53 = __VLS_52({}, ...__VLS_functionalComponentArgsRest(__VLS_52));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "tiny-pill" },
            });
            (method.enabled ? '真实可用' : '待实现');
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            (method.title);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
            (method.desc);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "choice-radio" },
            });
            if (__VLS_ctx.form.connection_type === method.key) {
                const __VLS_55 = {}.Check;
                /** @type {[typeof __VLS_components.Check, ]} */ ;
                // @ts-ignore
                const __VLS_56 = __VLS_asFunctionalComponent(__VLS_55, new __VLS_55({}));
                const __VLS_57 = __VLS_56({}, ...__VLS_functionalComponentArgsRest(__VLS_56));
            }
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "security-note" },
        });
        const __VLS_59 = {}.ShieldCheck;
        /** @type {[typeof __VLS_components.ShieldCheck, ]} */ ;
        // @ts-ignore
        const __VLS_60 = __VLS_asFunctionalComponent(__VLS_59, new __VLS_59({}));
        const __VLS_61 = __VLS_60({}, ...__VLS_functionalComponentArgsRest(__VLS_60));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    if (__VLS_ctx.step === 2) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-grid" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
            ...{ onChange: (__VLS_ctx.applyProjectTargetDefaults) },
            value: (__VLS_ctx.form.project_id),
        });
        for (const [project] of __VLS_getVForSourceType((__VLS_ctx.projects))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                key: (project.id),
                value: (project.id),
            });
            (project.name);
            (project.deployment_mode === 'docker' ? 'Docker' : '文件部署');
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
            value: (__VLS_ctx.form.environment_id),
        });
        for (const [env] of __VLS_getVForSourceType((__VLS_ctx.environments))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                key: (env.id),
                value: (env.id),
            });
            (env.name);
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            placeholder: "例如：prod-app-01",
        });
        (__VLS_ctx.form.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            placeholder: "192.168.1.10",
        });
        (__VLS_ctx.form.address);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({});
        (__VLS_ctx.form.port);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({});
        (__VLS_ctx.form.username);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field full" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        (__VLS_ctx.formProject?.deployment_mode === 'docker' ? '宿主机映射端口' : '应用监听端口');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({});
        (__VLS_ctx.form.service_port);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field full" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
            value: (__VLS_ctx.form.auth_type),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "password",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "private_key",
        });
        if (__VLS_ctx.form.auth_type === 'password') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "form-field full" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                type: "password",
                placeholder: (__VLS_ctx.editingId ? '留空表示不修改' : '请输入 SSH 密码'),
            });
            (__VLS_ctx.form.password);
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "form-field full" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea)({
                value: (__VLS_ctx.form.private_key),
                rows: "6",
                placeholder: (__VLS_ctx.editingId ? '留空表示不修改' : '粘贴 OpenSSH / PEM 私钥'),
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "form-field full" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                type: "password",
            });
            (__VLS_ctx.form.passphrase);
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field full" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            placeholder: "首次可留空，连接成功后自动保存",
        });
        (__VLS_ctx.form.host_key_fingerprint);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "check-field full" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            type: "checkbox",
        });
        (__VLS_ctx.form.trust_on_first_use);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "security-note full" },
        });
        const __VLS_63 = {}.KeyRound;
        /** @type {[typeof __VLS_components.KeyRound, ]} */ ;
        // @ts-ignore
        const __VLS_64 = __VLS_asFunctionalComponent(__VLS_63, new __VLS_63({}));
        const __VLS_65 = __VLS_64({}, ...__VLS_functionalComponentArgsRest(__VLS_64));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    if (__VLS_ctx.step === 3) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-grid" },
        });
        if (__VLS_ctx.formProject?.deployment_mode === 'docker') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "security-note full docker-note" },
            });
            const __VLS_67 = {}.Server;
            /** @type {[typeof __VLS_components.Server, ]} */ ;
            // @ts-ignore
            const __VLS_68 = __VLS_asFunctionalComponent(__VLS_67, new __VLS_67({}));
            const __VLS_69 = __VLS_68({}, ...__VLS_functionalComponentArgsRest(__VLS_68));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (__VLS_ctx.form.service_port);
            (__VLS_ctx.formProject.docker_container_port);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "form-field full" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                placeholder: "curl --fail http://127.0.0.1:{service_port}/health",
            });
            (__VLS_ctx.form.health_check_command);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "form-field full" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({});
            (__VLS_ctx.form.deploy_path);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "form-field full" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({});
            (__VLS_ctx.form.start_command);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "form-field full" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({});
            (__VLS_ctx.form.stop_command);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "form-field full" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({});
            (__VLS_ctx.form.health_check_command);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "security-note full" },
            });
            const __VLS_71 = {}.Server;
            /** @type {[typeof __VLS_components.Server, ]} */ ;
            // @ts-ignore
            const __VLS_72 = __VLS_asFunctionalComponent(__VLS_71, new __VLS_71({}));
            const __VLS_73 = __VLS_72({}, ...__VLS_functionalComponentArgsRest(__VLS_72));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        }
    }
    if (__VLS_ctx.error) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "error-text target-error" },
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
                __VLS_ctx.step === 1 ? __VLS_ctx.showCreate = false : __VLS_ctx.step--;
            } },
        ...{ class: "ghost-button" },
    });
    (__VLS_ctx.step === 1 ? '取消' : '上一步');
    if (__VLS_ctx.step < 3) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showCreate))
                        return;
                    if (!(__VLS_ctx.step < 3))
                        return;
                    __VLS_ctx.step++;
                } },
            ...{ class: "primary-button" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.saveTarget) },
            ...{ class: "primary-button" },
            disabled: (__VLS_ctx.saving),
        });
        (__VLS_ctx.saving ? '保存并测试中...' : '保存并测试真实连接');
    }
    var __VLS_46;
}
if (__VLS_ctx.deleteCandidate) {
    /** @type {[typeof ModalShell, typeof ModalShell, ]} */ ;
    // @ts-ignore
    const __VLS_75 = __VLS_asFunctionalComponent(ModalShell, new ModalShell({
        ...{ 'onClose': {} },
        title: "删除目标服务器",
        subtitle: "只删除平台配置，不会登录或清理服务器",
        size: "small",
    }));
    const __VLS_76 = __VLS_75({
        ...{ 'onClose': {} },
        title: "删除目标服务器",
        subtitle: "只删除平台配置，不会登录或清理服务器",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_75));
    let __VLS_78;
    let __VLS_79;
    let __VLS_80;
    const __VLS_81 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.deleteCandidate))
                return;
            __VLS_ctx.deleteCandidate = null;
        }
    };
    __VLS_77.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-body delete-confirm-body" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "delete-warning-icon" },
    });
    const __VLS_82 = {}.AlertTriangle;
    /** @type {[typeof __VLS_components.AlertTriangle, ]} */ ;
    // @ts-ignore
    const __VLS_83 = __VLS_asFunctionalComponent(__VLS_82, new __VLS_82({}));
    const __VLS_84 = __VLS_83({}, ...__VLS_functionalComponentArgsRest(__VLS_83));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.deleteCandidate.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.deleteCandidate.project_name);
    (__VLS_ctx.deleteCandidate.environment_name);
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
        ...{ onClick: (__VLS_ctx.deleteTarget) },
        ...{ class: "danger-button" },
        disabled: (__VLS_ctx.deleting),
    });
    const __VLS_86 = {}.Trash2;
    /** @type {[typeof __VLS_components.Trash2, ]} */ ;
    // @ts-ignore
    const __VLS_87 = __VLS_asFunctionalComponent(__VLS_86, new __VLS_86({}));
    const __VLS_88 = __VLS_87({}, ...__VLS_functionalComponentArgsRest(__VLS_87));
    (__VLS_ctx.deleting ? '正在删除...' : '确认删除服务器');
    var __VLS_77;
}
/** @type {__VLS_StyleScopedClasses['content']} */ ;
/** @type {__VLS_StyleScopedClasses['compact']} */ ;
/** @type {__VLS_StyleScopedClasses['environments-page']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-row']} */ ;
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['environment-explainer']} */ ;
/** @type {__VLS_StyleScopedClasses['explain-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['explain-number']} */ ;
/** @type {__VLS_StyleScopedClasses['explain-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['project-scope']} */ ;
/** @type {__VLS_StyleScopedClasses['scope-result']} */ ;
/** @type {__VLS_StyleScopedClasses['environment-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['environment-summary-card']} */ ;
/** @type {__VLS_StyleScopedClasses['all']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['environment-summary-card']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-notice']} */ ;
/** @type {__VLS_StyleScopedClasses['notice-action']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['environment-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['server-list-title']} */ ;
/** @type {__VLS_StyleScopedClasses['server-list-tip']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-spacer']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['target-table']} */ ;
/** @type {__VLS_StyleScopedClasses['target-table-head']} */ ;
/** @type {__VLS_StyleScopedClasses['target-row']} */ ;
/** @type {__VLS_StyleScopedClasses['target-name']} */ ;
/** @type {__VLS_StyleScopedClasses['method-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['target-env']} */ ;
/** @type {__VLS_StyleScopedClasses['target-workload']} */ ;
/** @type {__VLS_StyleScopedClasses['method-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['connection-status']} */ ;
/** @type {__VLS_StyleScopedClasses['target-workload']} */ ;
/** @type {__VLS_StyleScopedClasses['target-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-button']} */ ;
/** @type {__VLS_StyleScopedClasses['delete-icon-button']} */ ;
/** @type {__VLS_StyleScopedClasses['list-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['stepper']} */ ;
/** @type {__VLS_StyleScopedClasses['step']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['done']} */ ;
/** @type {__VLS_StyleScopedClasses['step-index']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
/** @type {__VLS_StyleScopedClasses['target-modal-body']} */ ;
/** @type {__VLS_StyleScopedClasses['method-choice-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['method-choice']} */ ;
/** @type {__VLS_StyleScopedClasses['selected']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['method-choice-top']} */ ;
/** @type {__VLS_StyleScopedClasses['method-choice-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['tiny-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['choice-radio']} */ ;
/** @type {__VLS_StyleScopedClasses['security-note']} */ ;
/** @type {__VLS_StyleScopedClasses['form-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['check-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['security-note']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['security-note']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['docker-note']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['security-note']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['error-text']} */ ;
/** @type {__VLS_StyleScopedClasses['target-error']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-foot']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost-button']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-button']} */ ;
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
            ArrowRight: ArrowRight,
            Check: Check,
            FolderKanban: FolderKanban,
            KeyRound: KeyRound,
            Network: Network,
            Pencil: Pencil,
            Plus: Plus,
            RefreshCw: RefreshCw,
            Server: Server,
            ShieldCheck: ShieldCheck,
            Terminal: Terminal,
            Trash2: Trash2,
            Unplug: Unplug,
            ModalShell: ModalShell,
            environments: environments,
            projects: projects,
            selectedProjectId: selectedProjectId,
            selectedEnvironmentId: selectedEnvironmentId,
            showCreate: showCreate,
            editingId: editingId,
            deleteCandidate: deleteCandidate,
            deleting: deleting,
            deleteError: deleteError,
            step: step,
            testingId: testingId,
            testingAll: testingAll,
            message: message,
            error: error,
            saving: saving,
            readyProjectId: readyProjectId,
            auth: auth,
            form: form,
            projectTargets: projectTargets,
            online: online,
            visibleTargets: visibleTargets,
            selectedEnvironment: selectedEnvironment,
            selectedProject: selectedProject,
            formProject: formProject,
            environmentStatus: environmentStatus,
            applyProjectTargetDefaults: applyProjectTargetDefaults,
            load: load,
            openCreate: openCreate,
            openEdit: openEdit,
            testTarget: testTarget,
            testVisibleTargets: testVisibleTargets,
            saveTarget: saveTarget,
            requestDelete: requestDelete,
            deleteTarget: deleteTarget,
            goRelease: goRelease,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
