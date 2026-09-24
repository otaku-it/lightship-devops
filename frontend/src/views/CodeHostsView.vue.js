import { computed, onMounted, reactive, ref } from 'vue';
import { AlertTriangle, CheckCircle2, GitFork, LoaderCircle, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, XCircle } from 'lucide-vue-next';
import { api } from '../api/client';
import ModalShell from '../components/ModalShell.vue';
import { useAuthStore } from '../stores/auth';
const auth = useAuthStore();
const connections = ref([]);
const loading = ref(false);
const saving = ref(false);
const testingId = ref(null);
const error = ref('');
const message = ref('');
const showModal = ref(false);
const editing = ref(null);
const deleteCandidate = ref(null);
const canManage = computed(() => auth.role === 'admin');
const isAdmin = computed(() => auth.role === 'admin');
const roleLabels = { admin: '平台管理员', release_manager: '发布管理员', developer: '开发人员', viewer: '只读用户' };
const form = reactive({ name: '', provider: 'github', base_url: 'https://github.com', username: '', token: '', visible_roles: ['admin'] });
const providers = {
    github: { name: 'GitHub', defaultUrl: 'https://github.com', hint: 'Token 建议具备 repo 读取权限' },
    gitlab: { name: 'GitLab', defaultUrl: 'https://gitlab.com', hint: 'Token 至少需要 read_api、read_repository' },
    gitee: { name: 'Gitee 码云', defaultUrl: 'https://gitee.com', hint: '私人令牌需要 projects 读取权限' },
};
function providerName(key) { return providers[key]?.name || key; }
function providerHint(key) { return providers[key]?.hint || ''; }
function setProvider() { form.base_url = providers[form.provider].defaultUrl; }
function formatDate(value) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '尚未测试'; }
async function load() {
    loading.value = true;
    error.value = '';
    try {
        connections.value = (await api.get('/code-hosts')).data;
    }
    catch (exception) {
        error.value = exception.response?.data?.detail || '代码托管连接加载失败';
    }
    finally {
        loading.value = false;
    }
}
function openCreate() {
    editing.value = null;
    Object.assign(form, { name: '', provider: 'github', base_url: 'https://github.com', username: '', token: '', visible_roles: ['admin'] });
    error.value = '';
    message.value = '';
    showModal.value = true;
}
function openEdit(item) {
    editing.value = item;
    Object.assign(form, { name: item.name, provider: item.provider, base_url: item.base_url, username: item.username, token: '', visible_roles: [...item.visible_roles] });
    error.value = '';
    message.value = '';
    showModal.value = true;
}
async function save() {
    error.value = '';
    if (!form.name.trim() || !form.base_url.trim()) {
        error.value = '请填写连接名称和平台地址';
        return;
    }
    if (!editing.value && !form.token) {
        error.value = '首次创建必须填写访问令牌';
        return;
    }
    saving.value = true;
    try {
        const result = editing.value ? await api.put(`/code-hosts/${editing.value.id}`, form) : await api.post('/code-hosts', form);
        showModal.value = false;
        message.value = `连接“${result.data.name}”已保存，请执行连接测试`;
        await load();
    }
    catch (exception) {
        error.value = exception.response?.data?.detail || '连接保存失败';
    }
    finally {
        saving.value = false;
    }
}
async function test(item) {
    testingId.value = item.id;
    error.value = '';
    message.value = '';
    try {
        const { data } = await api.post(`/code-hosts/${item.id}/test`);
        if (data.success)
            message.value = data.message;
        else
            error.value = data.message;
        await load();
    }
    catch (exception) {
        error.value = exception.response?.data?.detail || '连接测试失败';
    }
    finally {
        testingId.value = null;
    }
}
async function remove() {
    if (!deleteCandidate.value)
        return;
    saving.value = true;
    error.value = '';
    try {
        await api.delete(`/code-hosts/${deleteCandidate.value.id}`);
        message.value = '代码托管连接已删除';
        deleteCandidate.value = null;
        await load();
    }
    catch (exception) {
        error.value = exception.response?.data?.detail || '删除失败';
    }
    finally {
        saving.value = false;
    }
}
onMounted(load);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "content compact code-host-page" },
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
    ...{ onClick: (__VLS_ctx.load) },
    ...{ class: "secondary-button" },
    disabled: (__VLS_ctx.loading),
});
const __VLS_0 = {}.RefreshCw;
/** @type {[typeof __VLS_components.RefreshCw, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: ({ spin: __VLS_ctx.loading }) },
}));
const __VLS_2 = __VLS_1({
    ...{ class: ({ spin: __VLS_ctx.loading }) },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
if (__VLS_ctx.canManage) {
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
    ...{ class: "code-host-guide" },
});
const __VLS_8 = {}.ShieldCheck;
/** @type {[typeof __VLS_components.ShieldCheck, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({}));
const __VLS_10 = __VLS_9({}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
if (__VLS_ctx.message) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "inline-notice" },
    });
    const __VLS_12 = {}.CheckCircle2;
    /** @type {[typeof __VLS_components.CheckCircle2, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({}));
    const __VLS_14 = __VLS_13({}, ...__VLS_functionalComponentArgsRest(__VLS_13));
    (__VLS_ctx.message);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.message))
                    return;
                __VLS_ctx.message = '';
            } },
    });
}
if (__VLS_ctx.error) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-error" },
    });
    (__VLS_ctx.error);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.error))
                    return;
                __VLS_ctx.error = '';
            } },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "code-host-grid" },
});
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.connections))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        key: (item.id),
        ...{ class: "code-host-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "code-host-card-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "provider-logo" },
        ...{ class: (item.provider) },
    });
    const __VLS_16 = {}.GitFork;
    /** @type {[typeof __VLS_components.GitFork, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({}));
    const __VLS_18 = __VLS_17({}, ...__VLS_functionalComponentArgsRest(__VLS_17));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (item.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.providerName(item.provider));
    (item.base_url);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "connection-pill" },
        ...{ class: (item.status) },
    });
    if (item.status === 'connected') {
        const __VLS_20 = {}.CheckCircle2;
        /** @type {[typeof __VLS_components.CheckCircle2, ]} */ ;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({}));
        const __VLS_22 = __VLS_21({}, ...__VLS_functionalComponentArgsRest(__VLS_21));
    }
    else if (item.status === 'failed') {
        const __VLS_24 = {}.XCircle;
        /** @type {[typeof __VLS_components.XCircle, ]} */ ;
        // @ts-ignore
        const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({}));
        const __VLS_26 = __VLS_25({}, ...__VLS_functionalComponentArgsRest(__VLS_25));
    }
    (item.status === 'connected' ? '已连接' : item.status === 'failed' ? '连接失败' : '待测试');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "code-host-meta" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (item.account_name || item.username || '--');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (item.project_count);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.formatDate(item.last_tested_at));
    if (item.status === 'failed' && item.last_error) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "code-host-error" },
        });
        const __VLS_28 = {}.XCircle;
        /** @type {[typeof __VLS_components.XCircle, ]} */ ;
        // @ts-ignore
        const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({}));
        const __VLS_30 = __VLS_29({}, ...__VLS_functionalComponentArgsRest(__VLS_29));
        (item.last_error);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "code-host-card-foot" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
    (item.visible_roles.map((role) => __VLS_ctx.roleLabels[role] || role).join('、'));
    if (__VLS_ctx.canManage) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.canManage))
                        return;
                    __VLS_ctx.test(item);
                } },
            ...{ class: "secondary-button" },
            disabled: (__VLS_ctx.testingId === item.id),
        });
        if (__VLS_ctx.testingId === item.id) {
            const __VLS_32 = {}.LoaderCircle;
            /** @type {[typeof __VLS_components.LoaderCircle, ]} */ ;
            // @ts-ignore
            const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
                ...{ class: "spin" },
            }));
            const __VLS_34 = __VLS_33({
                ...{ class: "spin" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_33));
        }
        else {
            const __VLS_36 = {}.CheckCircle2;
            /** @type {[typeof __VLS_components.CheckCircle2, ]} */ ;
            // @ts-ignore
            const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({}));
            const __VLS_38 = __VLS_37({}, ...__VLS_functionalComponentArgsRest(__VLS_37));
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.canManage))
                        return;
                    __VLS_ctx.openEdit(item);
                } },
            ...{ class: "icon-button" },
            title: "编辑",
        });
        const __VLS_40 = {}.Pencil;
        /** @type {[typeof __VLS_components.Pencil, ]} */ ;
        // @ts-ignore
        const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({}));
        const __VLS_42 = __VLS_41({}, ...__VLS_functionalComponentArgsRest(__VLS_41));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.canManage))
                        return;
                    __VLS_ctx.deleteCandidate = item;
                } },
            ...{ class: "icon-button delete-icon-button" },
            title: "删除",
        });
        const __VLS_44 = {}.Trash2;
        /** @type {[typeof __VLS_components.Trash2, ]} */ ;
        // @ts-ignore
        const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({}));
        const __VLS_46 = __VLS_45({}, ...__VLS_functionalComponentArgsRest(__VLS_45));
    }
}
if (!__VLS_ctx.loading && !__VLS_ctx.connections.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "code-host-empty" },
    });
    const __VLS_48 = {}.GitFork;
    /** @type {[typeof __VLS_components.GitFork, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({}));
    const __VLS_50 = __VLS_49({}, ...__VLS_functionalComponentArgsRest(__VLS_49));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    if (__VLS_ctx.canManage) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.openCreate) },
            ...{ class: "primary-button" },
        });
        const __VLS_52 = {}.Plus;
        /** @type {[typeof __VLS_components.Plus, ]} */ ;
        // @ts-ignore
        const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({}));
        const __VLS_54 = __VLS_53({}, ...__VLS_functionalComponentArgsRest(__VLS_53));
    }
}
if (__VLS_ctx.showModal) {
    /** @type {[typeof ModalShell, typeof ModalShell, ]} */ ;
    // @ts-ignore
    const __VLS_56 = __VLS_asFunctionalComponent(ModalShell, new ModalShell({
        ...{ 'onClose': {} },
        title: (__VLS_ctx.editing ? '编辑代码托管连接' : '新建代码托管连接'),
        subtitle: "使用 Personal Access Token 读取仓库和执行发布",
        size: "small",
    }));
    const __VLS_57 = __VLS_56({
        ...{ 'onClose': {} },
        title: (__VLS_ctx.editing ? '编辑代码托管连接' : '新建代码托管连接'),
        subtitle: "使用 Personal Access Token 读取仓库和执行发布",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_56));
    let __VLS_59;
    let __VLS_60;
    let __VLS_61;
    const __VLS_62 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.showModal))
                return;
            __VLS_ctx.showModal = false;
        }
    };
    __VLS_58.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-body settings-modal-body" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-grid" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        placeholder: "例如 公司 GitLab",
    });
    (__VLS_ctx.form.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        ...{ onChange: (__VLS_ctx.setProvider) },
        value: (__VLS_ctx.form.provider),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "github",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "gitlab",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "gitee",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        placeholder: "https://gitlab.example.com",
    });
    (__VLS_ctx.form.base_url);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        placeholder: "可留空，连接测试后自动识别",
    });
    (__VLS_ctx.form.username);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    (__VLS_ctx.editing ? '' : '*');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "password",
        placeholder: (__VLS_ctx.editing ? '留空表示继续使用已保存令牌' : '请输入访问令牌'),
    });
    (__VLS_ctx.form.token);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
    (__VLS_ctx.providerHint(__VLS_ctx.form.provider));
    if (__VLS_ctx.isAdmin) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field full" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "role-visibility-grid" },
        });
        for (const [role] of __VLS_getVForSourceType((Object.keys(__VLS_ctx.roleLabels)))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
                key: (role),
                ...{ class: "role-visibility-option" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                type: "checkbox",
                value: (role),
                disabled: (role === 'admin'),
            });
            (__VLS_ctx.form.visible_roles);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            (__VLS_ctx.roleLabels[role]);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
            (role === 'admin' ? '始终保留' : '可查看仓库并用于项目接入');
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
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
                if (!(__VLS_ctx.showModal))
                    return;
                __VLS_ctx.showModal = false;
            } },
        ...{ class: "ghost-button" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.save) },
        ...{ class: "primary-button" },
        disabled: (__VLS_ctx.saving),
    });
    (__VLS_ctx.saving ? '保存中...' : '保存连接');
    var __VLS_58;
}
if (__VLS_ctx.deleteCandidate) {
    /** @type {[typeof ModalShell, typeof ModalShell, ]} */ ;
    // @ts-ignore
    const __VLS_63 = __VLS_asFunctionalComponent(ModalShell, new ModalShell({
        ...{ 'onClose': {} },
        title: "删除代码托管连接",
        subtitle: "已绑定项目的连接不能删除",
        size: "small",
    }));
    const __VLS_64 = __VLS_63({
        ...{ 'onClose': {} },
        title: "删除代码托管连接",
        subtitle: "已绑定项目的连接不能删除",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_63));
    let __VLS_66;
    let __VLS_67;
    let __VLS_68;
    const __VLS_69 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.deleteCandidate))
                return;
            __VLS_ctx.deleteCandidate = null;
        }
    };
    __VLS_65.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-body delete-confirm-body" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "delete-warning-icon" },
    });
    const __VLS_70 = {}.AlertTriangle;
    /** @type {[typeof __VLS_components.AlertTriangle, ]} */ ;
    // @ts-ignore
    const __VLS_71 = __VLS_asFunctionalComponent(__VLS_70, new __VLS_70({}));
    const __VLS_72 = __VLS_71({}, ...__VLS_functionalComponentArgsRest(__VLS_71));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.deleteCandidate.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)({});
    (__VLS_ctx.deleteCandidate.project_count);
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
                if (!(__VLS_ctx.deleteCandidate))
                    return;
                __VLS_ctx.deleteCandidate = null;
            } },
        ...{ class: "ghost-button" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.remove) },
        ...{ class: "danger-button" },
        disabled: (__VLS_ctx.saving || __VLS_ctx.deleteCandidate.project_count > 0),
    });
    const __VLS_74 = {}.Trash2;
    /** @type {[typeof __VLS_components.Trash2, ]} */ ;
    // @ts-ignore
    const __VLS_75 = __VLS_asFunctionalComponent(__VLS_74, new __VLS_74({}));
    const __VLS_76 = __VLS_75({}, ...__VLS_functionalComponentArgsRest(__VLS_75));
    var __VLS_65;
}
/** @type {__VLS_StyleScopedClasses['content']} */ ;
/** @type {__VLS_StyleScopedClasses['compact']} */ ;
/** @type {__VLS_StyleScopedClasses['code-host-page']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-row']} */ ;
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['spin']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['code-host-guide']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-notice']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-error']} */ ;
/** @type {__VLS_StyleScopedClasses['code-host-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['code-host-card']} */ ;
/** @type {__VLS_StyleScopedClasses['code-host-card-head']} */ ;
/** @type {__VLS_StyleScopedClasses['provider-logo']} */ ;
/** @type {__VLS_StyleScopedClasses['connection-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['code-host-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['code-host-error']} */ ;
/** @type {__VLS_StyleScopedClasses['code-host-card-foot']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['spin']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-button']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-button']} */ ;
/** @type {__VLS_StyleScopedClasses['delete-icon-button']} */ ;
/** @type {__VLS_StyleScopedClasses['code-host-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-modal-body']} */ ;
/** @type {__VLS_StyleScopedClasses['form-grid']} */ ;
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
/** @type {__VLS_StyleScopedClasses['role-visibility-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['role-visibility-option']} */ ;
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
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            AlertTriangle: AlertTriangle,
            CheckCircle2: CheckCircle2,
            GitFork: GitFork,
            LoaderCircle: LoaderCircle,
            Pencil: Pencil,
            Plus: Plus,
            RefreshCw: RefreshCw,
            ShieldCheck: ShieldCheck,
            Trash2: Trash2,
            XCircle: XCircle,
            ModalShell: ModalShell,
            connections: connections,
            loading: loading,
            saving: saving,
            testingId: testingId,
            error: error,
            message: message,
            showModal: showModal,
            editing: editing,
            deleteCandidate: deleteCandidate,
            canManage: canManage,
            isAdmin: isAdmin,
            roleLabels: roleLabels,
            form: form,
            providerName: providerName,
            providerHint: providerHint,
            setProvider: setProvider,
            formatDate: formatDate,
            load: load,
            openCreate: openCreate,
            openEdit: openEdit,
            save: save,
            test: test,
            remove: remove,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
