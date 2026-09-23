import { computed, onMounted, reactive, ref } from 'vue';
import { KeyRound, LockKeyhole, Pencil, RefreshCw, ShieldCheck, UserPlus, Users } from 'lucide-vue-next';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import ModalShell from '../components/ModalShell.vue';
const auth = useAuthStore();
const users = ref([]);
const activeTab = ref('account');
const loading = ref(false);
const saving = ref(false);
const message = ref('');
const error = ref('');
const showUserModal = ref(false);
const editingUser = ref(null);
const showResetModal = ref(false);
const resetUser = ref(null);
const passwordForm = reactive({ current_password: '', new_password: '', confirm_password: '' });
const userForm = reactive({ username: '', display_name: '', password: '', role: 'developer' });
const resetForm = reactive({ new_password: '', confirm_password: '' });
const isAdmin = computed(() => auth.role === 'admin');
const roleLabels = { admin: '平台管理员', release_manager: '发布管理员', developer: '开发人员', viewer: '只读用户' };
function clearFeedback() { message.value = ''; error.value = ''; }
function roleLabel(role) { return roleLabels[role] || role; }
function formatDate(value) { return new Date(value).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }); }
async function loadUsers() {
    if (!isAdmin.value)
        return;
    loading.value = true;
    try {
        users.value = (await api.get('/auth/users')).data;
    }
    catch (exception) {
        error.value = exception.response?.data?.detail || '用户列表加载失败';
    }
    finally {
        loading.value = false;
    }
}
async function changePassword() {
    clearFeedback();
    if (passwordForm.new_password.length < 8) {
        error.value = '新密码至少需要 8 位';
        return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
        error.value = '两次输入的新密码不一致';
        return;
    }
    saving.value = true;
    try {
        const { data } = await api.post('/auth/change-password', { current_password: passwordForm.current_password, new_password: passwordForm.new_password });
        message.value = data.message;
        Object.assign(passwordForm, { current_password: '', new_password: '', confirm_password: '' });
    }
    catch (exception) {
        error.value = exception.response?.data?.detail || '密码修改失败';
    }
    finally {
        saving.value = false;
    }
}
function openCreateUser() {
    editingUser.value = null;
    Object.assign(userForm, { username: '', display_name: '', password: '', role: 'developer' });
    clearFeedback();
    showUserModal.value = true;
}
function openEditUser(user) {
    editingUser.value = user;
    Object.assign(userForm, { username: user.username, display_name: user.display_name, password: '', role: user.role });
    clearFeedback();
    showUserModal.value = true;
}
async function saveUser() {
    clearFeedback();
    if (!userForm.display_name.trim()) {
        error.value = '请填写显示名称';
        return;
    }
    if (!editingUser.value && userForm.password.length < 8) {
        error.value = '初始密码至少需要 8 位';
        return;
    }
    saving.value = true;
    try {
        if (editingUser.value)
            await api.patch(`/auth/users/${editingUser.value.id}`, { display_name: userForm.display_name, role: userForm.role, is_active: editingUser.value.is_active });
        else
            await api.post('/auth/users', userForm);
        showUserModal.value = false;
        message.value = editingUser.value ? '用户信息已更新' : '用户创建成功';
        await loadUsers();
    }
    catch (exception) {
        error.value = exception.response?.data?.detail || '用户保存失败';
    }
    finally {
        saving.value = false;
    }
}
async function toggleUser(user) {
    clearFeedback();
    try {
        await api.patch(`/auth/users/${user.id}`, { display_name: user.display_name, role: user.role, is_active: !user.is_active });
        message.value = `${user.username} 已${user.is_active ? '禁用' : '启用'}`;
        await loadUsers();
    }
    catch (exception) {
        error.value = exception.response?.data?.detail || '用户状态更新失败';
    }
}
function openReset(user) { resetUser.value = user; Object.assign(resetForm, { new_password: '', confirm_password: '' }); clearFeedback(); showResetModal.value = true; }
async function resetPassword() {
    clearFeedback();
    if (resetForm.new_password.length < 8) {
        error.value = '新密码至少需要 8 位';
        return;
    }
    if (resetForm.new_password !== resetForm.confirm_password) {
        error.value = '两次输入的新密码不一致';
        return;
    }
    saving.value = true;
    try {
        const { data } = await api.post(`/auth/users/${resetUser.value?.id}/reset-password`, { new_password: resetForm.new_password });
        showResetModal.value = false;
        message.value = data.message;
    }
    catch (exception) {
        error.value = exception.response?.data?.detail || '密码重置失败';
    }
    finally {
        saving.value = false;
    }
}
onMounted(loadUsers);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "content compact settings-page" },
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
if (__VLS_ctx.isAdmin && __VLS_ctx.activeTab === 'users') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.openCreateUser) },
        ...{ class: "primary-button" },
    });
    const __VLS_0 = {}.UserPlus;
    /** @type {[typeof __VLS_components.UserPlus, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
    const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "settings-tabs" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activeTab = 'account';
        } },
    ...{ class: ({ active: __VLS_ctx.activeTab === 'account' }) },
});
const __VLS_4 = {}.KeyRound;
/** @type {[typeof __VLS_components.KeyRound, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({}));
const __VLS_6 = __VLS_5({}, ...__VLS_functionalComponentArgsRest(__VLS_5));
if (__VLS_ctx.isAdmin) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isAdmin))
                    return;
                __VLS_ctx.activeTab = 'users';
            } },
        ...{ class: ({ active: __VLS_ctx.activeTab === 'users' }) },
    });
    const __VLS_8 = {}.Users;
    /** @type {[typeof __VLS_components.Users, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({}));
    const __VLS_10 = __VLS_9({}, ...__VLS_functionalComponentArgsRest(__VLS_9));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activeTab = 'release';
        } },
    ...{ class: ({ active: __VLS_ctx.activeTab === 'release' }) },
});
const __VLS_12 = {}.ShieldCheck;
/** @type {[typeof __VLS_components.ShieldCheck, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({}));
const __VLS_14 = __VLS_13({}, ...__VLS_functionalComponentArgsRest(__VLS_13));
if (__VLS_ctx.message) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "inline-notice" },
    });
    const __VLS_16 = {}.ShieldCheck;
    /** @type {[typeof __VLS_components.ShieldCheck, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({}));
    const __VLS_18 = __VLS_17({}, ...__VLS_functionalComponentArgsRest(__VLS_17));
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
if (__VLS_ctx.activeTab === 'account') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "settings-grid" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        ...{ class: "settings-panel" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "role-badge" },
    });
    (__VLS_ctx.roleLabel(__VLS_ctx.auth.role));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "account-summary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "avatar large" },
    });
    (__VLS_ctx.auth.displayName.slice(0, 2).toUpperCase());
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.auth.displayName);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.auth.role);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        ...{ class: "settings-panel" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    const __VLS_20 = {}.LockKeyhole;
    /** @type {[typeof __VLS_components.LockKeyhole, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({}));
    const __VLS_22 = __VLS_21({}, ...__VLS_functionalComponentArgsRest(__VLS_21));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
        ...{ onSubmit: (__VLS_ctx.changePassword) },
        ...{ class: "settings-form" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "password",
        autocomplete: "current-password",
    });
    (__VLS_ctx.passwordForm.current_password);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "password",
        autocomplete: "new-password",
        placeholder: "至少 8 位",
    });
    (__VLS_ctx.passwordForm.new_password);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "password",
        autocomplete: "new-password",
    });
    (__VLS_ctx.passwordForm.confirm_password);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ class: "primary-button" },
        disabled: (__VLS_ctx.saving),
    });
    const __VLS_24 = {}.LockKeyhole;
    /** @type {[typeof __VLS_components.LockKeyhole, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({}));
    const __VLS_26 = __VLS_25({}, ...__VLS_functionalComponentArgsRest(__VLS_25));
    (__VLS_ctx.saving ? '保存中...' : '修改密码');
}
else if (__VLS_ctx.activeTab === 'users') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "settings-panel" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.loadUsers) },
        ...{ class: "secondary-button" },
        disabled: (__VLS_ctx.loading),
    });
    const __VLS_28 = {}.RefreshCw;
    /** @type {[typeof __VLS_components.RefreshCw, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        ...{ class: ({ spin: __VLS_ctx.loading }) },
    }));
    const __VLS_30 = __VLS_29({
        ...{ class: ({ spin: __VLS_ctx.loading }) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "user-table" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "user-table-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    for (const [user] of __VLS_getVForSourceType((__VLS_ctx.users))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (user.id),
            ...{ class: "user-row-item" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (user.display_name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (user.username);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "role-badge" },
        });
        (__VLS_ctx.roleLabel(user.role));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "user-status" },
            ...{ class: ({ disabled: !user.is_active }) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.i)({});
        (user.is_active ? '启用' : '已禁用');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "user-date" },
        });
        (__VLS_ctx.formatDate(user.created_at));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "user-actions" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeTab === 'account'))
                        return;
                    if (!(__VLS_ctx.activeTab === 'users'))
                        return;
                    __VLS_ctx.openEditUser(user);
                } },
            ...{ class: "icon-text-button" },
        });
        const __VLS_32 = {}.Pencil;
        /** @type {[typeof __VLS_components.Pencil, ]} */ ;
        // @ts-ignore
        const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({}));
        const __VLS_34 = __VLS_33({}, ...__VLS_functionalComponentArgsRest(__VLS_33));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeTab === 'account'))
                        return;
                    if (!(__VLS_ctx.activeTab === 'users'))
                        return;
                    __VLS_ctx.openReset(user);
                } },
            ...{ class: "icon-text-button" },
        });
        const __VLS_36 = {}.LockKeyhole;
        /** @type {[typeof __VLS_components.LockKeyhole, ]} */ ;
        // @ts-ignore
        const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({}));
        const __VLS_38 = __VLS_37({}, ...__VLS_functionalComponentArgsRest(__VLS_37));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeTab === 'account'))
                        return;
                    if (!(__VLS_ctx.activeTab === 'users'))
                        return;
                    __VLS_ctx.toggleUser(user);
                } },
            ...{ class: "icon-text-button" },
        });
        (user.is_active ? '禁用' : '启用');
    }
    if (!__VLS_ctx.users.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "list-empty" },
        });
    }
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "settings-grid" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        ...{ class: "settings-panel" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    const __VLS_40 = {}.ShieldCheck;
    /** @type {[typeof __VLS_components.ShieldCheck, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({}));
    const __VLS_42 = __VLS_41({}, ...__VLS_functionalComponentArgsRest(__VLS_41));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-info-list" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        ...{ class: "settings-panel" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-env-list" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.code, __VLS_intrinsicElements.code)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.code, __VLS_intrinsicElements.code)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.code, __VLS_intrinsicElements.code)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.code, __VLS_intrinsicElements.code)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({
        ...{ class: "settings-hint" },
    });
}
if (__VLS_ctx.showUserModal) {
    /** @type {[typeof ModalShell, typeof ModalShell, ]} */ ;
    // @ts-ignore
    const __VLS_44 = __VLS_asFunctionalComponent(ModalShell, new ModalShell({
        ...{ 'onClose': {} },
        title: (__VLS_ctx.editingUser ? '编辑用户' : '新建用户'),
        subtitle: "用户可以登录平台，具体发布权限由角色决定",
        size: "small",
    }));
    const __VLS_45 = __VLS_44({
        ...{ 'onClose': {} },
        title: (__VLS_ctx.editingUser ? '编辑用户' : '新建用户'),
        subtitle: "用户可以登录平台，具体发布权限由角色决定",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_44));
    let __VLS_47;
    let __VLS_48;
    let __VLS_49;
    const __VLS_50 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.showUserModal))
                return;
            __VLS_ctx.showUserModal = false;
        }
    };
    __VLS_46.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-body settings-modal-body" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-grid" },
    });
    if (!__VLS_ctx.editingUser) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field full" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            placeholder: "例如 zhangsan",
        });
        (__VLS_ctx.userForm.username);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        placeholder: "例如 张三",
    });
    (__VLS_ctx.userForm.display_name);
    if (!__VLS_ctx.editingUser) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-field full" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            type: "password",
            placeholder: "至少 8 位",
        });
        (__VLS_ctx.userForm.password);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.userForm.role),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "admin",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "release_manager",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "developer",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "viewer",
    });
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
                if (!(__VLS_ctx.showUserModal))
                    return;
                __VLS_ctx.showUserModal = false;
            } },
        ...{ class: "ghost-button" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.saveUser) },
        ...{ class: "primary-button" },
        disabled: (__VLS_ctx.saving),
    });
    (__VLS_ctx.saving ? '保存中...' : '保存用户');
    var __VLS_46;
}
if (__VLS_ctx.showResetModal) {
    /** @type {[typeof ModalShell, typeof ModalShell, ]} */ ;
    // @ts-ignore
    const __VLS_51 = __VLS_asFunctionalComponent(ModalShell, new ModalShell({
        ...{ 'onClose': {} },
        title: "重置用户密码",
        subtitle: (`为 ${__VLS_ctx.resetUser?.display_name} 设置新密码`),
        size: "small",
    }));
    const __VLS_52 = __VLS_51({
        ...{ 'onClose': {} },
        title: "重置用户密码",
        subtitle: (`为 ${__VLS_ctx.resetUser?.display_name} 设置新密码`),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_51));
    let __VLS_54;
    let __VLS_55;
    let __VLS_56;
    const __VLS_57 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.showResetModal))
                return;
            __VLS_ctx.showResetModal = false;
        }
    };
    __VLS_53.slots.default;
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
        type: "password",
        placeholder: "至少 8 位",
    });
    (__VLS_ctx.resetForm.new_password);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-field full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "password",
    });
    (__VLS_ctx.resetForm.confirm_password);
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
                if (!(__VLS_ctx.showResetModal))
                    return;
                __VLS_ctx.showResetModal = false;
            } },
        ...{ class: "ghost-button" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.resetPassword) },
        ...{ class: "primary-button" },
        disabled: (__VLS_ctx.saving),
    });
    var __VLS_53;
}
/** @type {__VLS_StyleScopedClasses['content']} */ ;
/** @type {__VLS_StyleScopedClasses['compact']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-page']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-row']} */ ;
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-notice']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-error']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['role-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['account-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['avatar']} */ ;
/** @type {__VLS_StyleScopedClasses['large']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-form']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['spin']} */ ;
/** @type {__VLS_StyleScopedClasses['user-table']} */ ;
/** @type {__VLS_StyleScopedClasses['user-table-head']} */ ;
/** @type {__VLS_StyleScopedClasses['user-row-item']} */ ;
/** @type {__VLS_StyleScopedClasses['role-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['user-status']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['user-date']} */ ;
/** @type {__VLS_StyleScopedClasses['user-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-text-button']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-text-button']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-text-button']} */ ;
/** @type {__VLS_StyleScopedClasses['list-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-info-list']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-env-list']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-hint']} */ ;
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
/** @type {__VLS_StyleScopedClasses['error-text']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-foot']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost-button']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-modal-body']} */ ;
/** @type {__VLS_StyleScopedClasses['form-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['error-text']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-foot']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost-button']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-button']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            KeyRound: KeyRound,
            LockKeyhole: LockKeyhole,
            Pencil: Pencil,
            RefreshCw: RefreshCw,
            ShieldCheck: ShieldCheck,
            UserPlus: UserPlus,
            Users: Users,
            ModalShell: ModalShell,
            auth: auth,
            users: users,
            activeTab: activeTab,
            loading: loading,
            saving: saving,
            message: message,
            error: error,
            showUserModal: showUserModal,
            editingUser: editingUser,
            showResetModal: showResetModal,
            resetUser: resetUser,
            passwordForm: passwordForm,
            userForm: userForm,
            resetForm: resetForm,
            isAdmin: isAdmin,
            roleLabel: roleLabel,
            formatDate: formatDate,
            loadUsers: loadUsers,
            changePassword: changePassword,
            openCreateUser: openCreateUser,
            openEditUser: openEditUser,
            saveUser: saveUser,
            toggleUser: toggleUser,
            openReset: openReset,
            resetPassword: resetPassword,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
