import { computed, onMounted, ref } from 'vue';
import { CheckCircle2, CircleAlert, Container, Pause, Play, RefreshCw, RotateCw, Server, TriangleAlert, XCircle } from 'lucide-vue-next';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const projects = ref([]);
const targets = ref([]);
const statuses = ref({});
const checking = ref({});
const loading = ref(true);
const selectedProjectId = ref(Number(route.query.project_id || 0));
const notice = ref('');
const controlling = ref({});
const selectedProject = computed(() => projects.value.find((item) => item.id === selectedProjectId.value));
const visibleTargets = computed(() => selectedProjectId.value ? targets.value.filter((item) => item.project_id === selectedProjectId.value) : targets.value);
const runningCount = computed(() => visibleTargets.value.filter((item) => statuses.value[item.id]?.status === 'running').length);
const problemCount = computed(() => visibleTargets.value.filter((item) => ['unhealthy', 'stopped', 'unreachable'].includes(statuses.value[item.id]?.status || '')).length);
const pendingCount = computed(() => visibleTargets.value.filter((item) => !statuses.value[item.id]).length);
function statusLabel(status) {
    return { running: '运行中', unhealthy: '健康异常', stopped: '已停止', unreachable: '无法连接', unknown: '待检查' }[status || ''] || '检查中';
}
function statusIcon(status) {
    return status === 'running' ? CheckCircle2 : ['unhealthy', 'stopped', 'unreachable'].includes(status || '') ? XCircle : CircleAlert;
}
function statusClass(status) { return status || 'checking'; }
async function load() {
    loading.value = true;
    try {
        const [projectResult, targetResult] = await Promise.all([api.get('/projects'), api.get('/targets')]);
        projects.value = projectResult.data;
        targets.value = targetResult.data;
        if (selectedProjectId.value && !projects.value.some((item) => item.id === selectedProjectId.value))
            selectedProjectId.value = 0;
        await checkAll();
    }
    finally {
        loading.value = false;
    }
}
async function checkOne(target) {
    checking.value[target.id] = true;
    try {
        const { data } = await api.post(`/targets/${target.id}/service-status`, {});
        statuses.value[target.id] = data;
    }
    catch (exception) {
        statuses.value[target.id] = { target_id: target.id, project_id: target.project_id, status: 'unreachable', healthy: false, message: exception.response?.data?.detail || '服务状态检查失败', detail: '', version: '', release_no: '', runtime: '', latency_ms: 0, checked_at: new Date().toISOString() };
    }
    finally {
        checking.value[target.id] = false;
    }
}
async function checkAll() {
    const list = visibleTargets.value;
    if (!list.length)
        return;
    await Promise.all(list.map((target) => checkOne(target)));
    notice.value = `已完成 ${list.length} 台目标服务器的真实服务状态检查`;
}
async function controlService(target, action) {
    const labels = { stop: '暂停', start: '启用', restart: '重启' };
    if (!window.confirm(`确认${labels[action]} ${target.name} 上的服务？这会在目标服务器执行真实操作。`))
        return;
    controlling.value[target.id] = true;
    try {
        const { data } = await api.post(`/targets/${target.id}/service-control`, { action });
        notice.value = data.success ? `${target.name}：${data.message}` : `${target.name}：${data.message}（${data.detail || '无更多信息'}）`;
        await checkOne(target);
    }
    catch (exception) {
        notice.value = `${target.name}：${exception.response?.data?.detail || '服务操作失败'}`;
    }
    finally {
        controlling.value[target.id] = false;
    }
}
async function changeProject() {
    await router.replace(selectedProjectId.value ? `/services?project_id=${selectedProjectId.value}` : '/services');
    await checkAll();
}
onMounted(load);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "content compact services-page" },
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "hero-actions" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.router.push('/environments');
        } },
    ...{ class: "secondary-button" },
});
const __VLS_0 = {}.Server;
/** @type {[typeof __VLS_components.Server, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.checkAll) },
    ...{ class: "primary-button" },
    disabled: (__VLS_ctx.loading || !__VLS_ctx.visibleTargets.length),
});
const __VLS_4 = {}.RefreshCw;
/** @type {[typeof __VLS_components.RefreshCw, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    ...{ class: ({ spin: __VLS_ctx.loading }) },
}));
const __VLS_6 = __VLS_5({
    ...{ class: ({ spin: __VLS_ctx.loading }) },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "service-scope" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    ...{ onChange: (__VLS_ctx.changeProject) },
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
    ...{ class: "service-summary" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "service-summary-card good" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.runningCount);
__VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "service-summary-card danger" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.problemCount);
__VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "service-summary-card pending" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.pendingCount);
__VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "service-summary-card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.visibleTargets.length);
__VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
if (__VLS_ctx.notice) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "inline-notice" },
    });
    const __VLS_8 = {}.CheckCircle2;
    /** @type {[typeof __VLS_components.CheckCircle2, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({}));
    const __VLS_10 = __VLS_9({}, ...__VLS_functionalComponentArgsRest(__VLS_9));
    (__VLS_ctx.notice);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.notice))
                    return;
                __VLS_ctx.notice = '';
            } },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "service-grid" },
});
for (const [target] of __VLS_getVForSourceType((__VLS_ctx.visibleTargets))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        key: (target.id),
        ...{ class: "service-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "service-card-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "service-target" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "service-target-icon" },
    });
    if (target.connection_type !== 'ssh' || __VLS_ctx.selectedProject?.deployment_mode !== 'file') {
        const __VLS_12 = {}.Container;
        /** @type {[typeof __VLS_components.Container, ]} */ ;
        // @ts-ignore
        const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({}));
        const __VLS_14 = __VLS_13({}, ...__VLS_functionalComponentArgsRest(__VLS_13));
    }
    else {
        const __VLS_16 = {}.Server;
        /** @type {[typeof __VLS_components.Server, ]} */ ;
        // @ts-ignore
        const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({}));
        const __VLS_18 = __VLS_17({}, ...__VLS_functionalComponentArgsRest(__VLS_17));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (target.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (target.project_name);
    (target.environment_name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "service-status-pill" },
        ...{ class: (__VLS_ctx.statusClass(__VLS_ctx.statuses[target.id]?.status)) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.i)({});
    (__VLS_ctx.checking[target.id] ? '检查中' : __VLS_ctx.statusLabel(__VLS_ctx.statuses[target.id]?.status));
    if (__VLS_ctx.statuses[target.id]) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "service-result" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "service-result-message" },
        });
        const __VLS_20 = ((__VLS_ctx.statusIcon(__VLS_ctx.statuses[target.id]?.status)));
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({}));
        const __VLS_22 = __VLS_21({}, ...__VLS_functionalComponentArgsRest(__VLS_21));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (__VLS_ctx.statuses[target.id].message);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.statuses[target.id].detail || '暂无更多诊断信息');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "service-meta" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.statuses[target.id].version || '暂无成功发布');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.statuses[target.id].runtime || (__VLS_ctx.selectedProject?.deployment_mode || '未设置'));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.statuses[target.id].latency_ms ? `${__VLS_ctx.statuses[target.id].latency_ms} ms` : '--');
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "service-pending" },
        });
        const __VLS_24 = {}.CircleAlert;
        /** @type {[typeof __VLS_components.CircleAlert, ]} */ ;
        // @ts-ignore
        const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({}));
        const __VLS_26 = __VLS_25({}, ...__VLS_functionalComponentArgsRest(__VLS_25));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "service-card-foot" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (target.address);
    (target.service_port);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "service-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.controlService(target, 'stop');
            } },
        ...{ class: "service-action-button" },
        disabled: (__VLS_ctx.controlling[target.id] || __VLS_ctx.checking[target.id]),
        title: "暂停服务",
    });
    const __VLS_28 = {}.Pause;
    /** @type {[typeof __VLS_components.Pause, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({}));
    const __VLS_30 = __VLS_29({}, ...__VLS_functionalComponentArgsRest(__VLS_29));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.controlService(target, 'start');
            } },
        ...{ class: "service-action-button" },
        disabled: (__VLS_ctx.controlling[target.id] || __VLS_ctx.checking[target.id]),
        title: "启用服务",
    });
    const __VLS_32 = {}.Play;
    /** @type {[typeof __VLS_components.Play, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({}));
    const __VLS_34 = __VLS_33({}, ...__VLS_functionalComponentArgsRest(__VLS_33));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.controlService(target, 'restart');
            } },
        ...{ class: "service-action-button" },
        disabled: (__VLS_ctx.controlling[target.id] || __VLS_ctx.checking[target.id]),
        title: "重启服务",
    });
    const __VLS_36 = {}.RotateCw;
    /** @type {[typeof __VLS_components.RotateCw, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        ...{ class: ({ spin: __VLS_ctx.controlling[target.id] }) },
    }));
    const __VLS_38 = __VLS_37({
        ...{ class: ({ spin: __VLS_ctx.controlling[target.id] }) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.checkOne(target);
            } },
        ...{ class: "secondary-button" },
        disabled: (__VLS_ctx.checking[target.id] || __VLS_ctx.controlling[target.id]),
    });
    const __VLS_40 = {}.RefreshCw;
    /** @type {[typeof __VLS_components.RefreshCw, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
        ...{ class: ({ spin: __VLS_ctx.checking[target.id] }) },
    }));
    const __VLS_42 = __VLS_41({
        ...{ class: ({ spin: __VLS_ctx.checking[target.id] }) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    (__VLS_ctx.checking[target.id] ? '检查中' : '检查服务');
}
if (!__VLS_ctx.visibleTargets.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "list-empty" },
    });
    const __VLS_44 = {}.TriangleAlert;
    /** @type {[typeof __VLS_components.TriangleAlert, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({}));
    const __VLS_46 = __VLS_45({}, ...__VLS_functionalComponentArgsRest(__VLS_45));
}
/** @type {__VLS_StyleScopedClasses['content']} */ ;
/** @type {__VLS_StyleScopedClasses['compact']} */ ;
/** @type {__VLS_StyleScopedClasses['services-page']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-row']} */ ;
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['spin']} */ ;
/** @type {__VLS_StyleScopedClasses['service-scope']} */ ;
/** @type {__VLS_StyleScopedClasses['scope-result']} */ ;
/** @type {__VLS_StyleScopedClasses['service-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['service-summary-card']} */ ;
/** @type {__VLS_StyleScopedClasses['good']} */ ;
/** @type {__VLS_StyleScopedClasses['service-summary-card']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['service-summary-card']} */ ;
/** @type {__VLS_StyleScopedClasses['pending']} */ ;
/** @type {__VLS_StyleScopedClasses['service-summary-card']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-notice']} */ ;
/** @type {__VLS_StyleScopedClasses['service-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['service-card']} */ ;
/** @type {__VLS_StyleScopedClasses['service-card-head']} */ ;
/** @type {__VLS_StyleScopedClasses['service-target']} */ ;
/** @type {__VLS_StyleScopedClasses['service-target-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['service-status-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['service-result']} */ ;
/** @type {__VLS_StyleScopedClasses['service-result-message']} */ ;
/** @type {__VLS_StyleScopedClasses['service-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['service-pending']} */ ;
/** @type {__VLS_StyleScopedClasses['service-card-foot']} */ ;
/** @type {__VLS_StyleScopedClasses['service-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['service-action-button']} */ ;
/** @type {__VLS_StyleScopedClasses['service-action-button']} */ ;
/** @type {__VLS_StyleScopedClasses['service-action-button']} */ ;
/** @type {__VLS_StyleScopedClasses['spin']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['spin']} */ ;
/** @type {__VLS_StyleScopedClasses['list-empty']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            CheckCircle2: CheckCircle2,
            CircleAlert: CircleAlert,
            Container: Container,
            Pause: Pause,
            Play: Play,
            RefreshCw: RefreshCw,
            RotateCw: RotateCw,
            Server: Server,
            TriangleAlert: TriangleAlert,
            router: router,
            auth: auth,
            projects: projects,
            statuses: statuses,
            checking: checking,
            loading: loading,
            selectedProjectId: selectedProjectId,
            notice: notice,
            controlling: controlling,
            selectedProject: selectedProject,
            visibleTargets: visibleTargets,
            runningCount: runningCount,
            problemCount: problemCount,
            pendingCount: pendingCount,
            statusLabel: statusLabel,
            statusIcon: statusIcon,
            statusClass: statusClass,
            checkOne: checkOne,
            checkAll: checkAll,
            controlService: controlService,
            changeProject: changeProject,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
