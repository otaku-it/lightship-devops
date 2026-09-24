import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Bell, Box, ChevronRight, Folder, Gauge, History, Layers3, Plus, Search, Server, Settings, ShipWheel, Activity, } from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import { api } from '../api/client';
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const search = ref('');
const searchInput = ref(null);
const searchProjects = ref([]);
const searchReleases = ref([]);
const searchLoading = ref(false);
const nav = [
    { to: '/', name: 'dashboard', label: '总览', icon: Gauge },
    { to: '/projects', name: 'projects', label: '项目', icon: Folder },
    { to: '/releases', name: 'releases', label: '发布记录', icon: History },
    { to: '/environments', name: 'environments', label: '发布环境', icon: Server },
    { to: '/services', name: 'services', label: '服务状态', icon: Activity },
];
const canOperate = computed(() => ['admin', 'release_manager', 'developer'].includes(auth.role));
const canViewAudit = computed(() => ['admin', 'release_manager'].includes(auth.role));
const titles = { dashboard: '发布总览', projects: '项目管理', releases: '发布记录', environments: '发布环境', services: '服务状态', settings: '平台设置', artifacts: '制品库', audit: '审计日志' };
const title = computed(() => titles[String(route.name)] || '轻舟');
const searchResults = computed(() => {
    const keyword = search.value.trim().toLowerCase();
    if (!keyword)
        return [];
    const projects = searchProjects.value
        .filter((item) => `${item.name} ${item.description} ${item.repository_url}`.toLowerCase().includes(keyword))
        .slice(0, 5)
        .map((item) => ({ kind: 'project', id: item.id, title: item.name, detail: item.description || item.repository_url, to: `/projects?search=${encodeURIComponent(item.name)}` }));
    const releases = searchReleases.value
        .filter((item) => `${item.release_no} ${item.version} ${item.project_name} ${item.environment_name} ${item.status}`.toLowerCase().includes(keyword))
        .slice(0, 8)
        .map((item) => ({ kind: 'release', id: item.id, title: item.release_no, detail: `${item.project_name} · v${item.version} · ${item.environment_name}`, to: `/releases?release_id=${item.id}` }));
    return [...projects, ...releases];
});
async function loadSearchData() {
    searchLoading.value = true;
    try {
        const [projects, releases] = await Promise.all([api.get('/projects'), api.get('/releases')]);
        searchProjects.value = projects.data;
        searchReleases.value = releases.data;
    }
    catch {
        searchProjects.value = [];
        searchReleases.value = [];
    }
    finally {
        searchLoading.value = false;
    }
}
function selectSearchResult(to) {
    search.value = '';
    router.push(to);
}
function handleSearchShortcut(event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInput.value?.focus();
    }
    else if (event.key === 'Escape' && document.activeElement === searchInput.value) {
        search.value = '';
        searchInput.value?.blur();
    }
    else if (event.key === 'Enter' && document.activeElement === searchInput.value && searchResults.value[0]) {
        selectSearchResult(searchResults.value[0].to);
    }
}
onMounted(() => {
    auth.syncMe().catch(() => undefined);
    loadSearchData();
    window.addEventListener('keydown', handleSearchShortcut);
});
onBeforeUnmount(() => window.removeEventListener('keydown', handleSearchShortcut));
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "app-shell" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({
    ...{ class: "sidebar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "brand" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "brand-mark" },
});
const __VLS_0 = {}.ShipWheel;
/** @type {[typeof __VLS_components.ShipWheel, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "brand-title" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "brand-sub" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "workspace-switch" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({});
const __VLS_4 = {}.ChevronRight;
/** @type {[typeof __VLS_components.ChevronRight, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({}));
const __VLS_6 = __VLS_5({}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "nav-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.nav, __VLS_intrinsicElements.nav)({
    ...{ class: "nav-list" },
});
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.nav))) {
    const __VLS_8 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        key: (item.name),
        to: (item.to),
        ...{ class: "nav-item" },
        ...{ class: ({ active: __VLS_ctx.route.name === item.name }) },
    }));
    const __VLS_10 = __VLS_9({
        key: (item.name),
        to: (item.to),
        ...{ class: "nav-item" },
        ...{ class: ({ active: __VLS_ctx.route.name === item.name }) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_11.slots.default;
    const __VLS_12 = ((item.icon));
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({}));
    const __VLS_14 = __VLS_13({}, ...__VLS_functionalComponentArgsRest(__VLS_13));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (item.label);
    var __VLS_11;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.router.push('/artifacts');
        } },
    ...{ class: "nav-item" },
    ...{ class: ({ active: __VLS_ctx.route.name === 'artifacts' }) },
});
const __VLS_16 = {}.Box;
/** @type {[typeof __VLS_components.Box, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({}));
const __VLS_18 = __VLS_17({}, ...__VLS_functionalComponentArgsRest(__VLS_17));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
if (__VLS_ctx.canViewAudit) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.canViewAudit))
                    return;
                __VLS_ctx.router.push('/audit');
            } },
        ...{ class: "nav-item" },
        ...{ class: ({ active: __VLS_ctx.route.name === 'audit' }) },
    });
    const __VLS_20 = {}.Layers3;
    /** @type {[typeof __VLS_components.Layers3, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({}));
    const __VLS_22 = __VLS_21({}, ...__VLS_functionalComponentArgsRest(__VLS_21));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "nav-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.nav, __VLS_intrinsicElements.nav)({
    ...{ class: "nav-list" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.router.push('/settings');
        } },
    ...{ class: "nav-item" },
    ...{ class: ({ active: __VLS_ctx.route.name === 'settings' }) },
});
const __VLS_24 = {}.Settings;
/** @type {[typeof __VLS_components.Settings, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({}));
const __VLS_26 = __VLS_25({}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "sidebar-foot" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "runner-health" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "runner-health-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "runner-health-value" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "runner-bars" },
});
for (const [h, i] of __VLS_getVForSourceType(([9, 14, 20, 13, 23, 18, 25, 11, 20, 16, 22, 18]))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.i)({
        key: (i),
        ...{ class: "on" },
        ...{ style: ({ height: `${h}px` }) },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.auth.logout) },
    ...{ class: "user-row user-button" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "avatar" },
});
(__VLS_ctx.auth.displayName.slice(0, 2).toUpperCase());
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.auth.displayName);
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.auth.role);
__VLS_asFunctionalElement(__VLS_intrinsicElements.main, __VLS_intrinsicElements.main)({
    ...{ class: "main" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ class: "topbar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "page-title" },
});
(__VLS_ctx.title);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "breadcrumb" },
});
(__VLS_ctx.title);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "search-box" },
});
const __VLS_28 = {}.Search;
/** @type {[typeof __VLS_components.Search, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({}));
const __VLS_30 = __VLS_29({}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onFocus: (__VLS_ctx.loadSearchData) },
    ref: "searchInput",
    placeholder: "搜索项目、版本或发布单",
});
(__VLS_ctx.search);
/** @type {typeof __VLS_ctx.searchInput} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "shortcut" },
});
if (__VLS_ctx.search.trim()) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "global-search-results" },
    });
    if (__VLS_ctx.searchLoading) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "global-search-empty" },
        });
    }
    else if (__VLS_ctx.searchResults.length) {
        for (const [item] of __VLS_getVForSourceType((__VLS_ctx.searchResults))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.search.trim()))
                            return;
                        if (!!(__VLS_ctx.searchLoading))
                            return;
                        if (!(__VLS_ctx.searchResults.length))
                            return;
                        __VLS_ctx.selectSearchResult(item.to);
                    } },
                key: (`${item.kind}-${item.id}`),
                ...{ class: "global-search-result" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "global-search-kind" },
                ...{ class: (item.kind) },
            });
            (item.kind === 'project' ? '项目' : '发布');
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            (item.title);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
            (item.detail);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "global-search-arrow" },
            });
        }
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "global-search-empty" },
        });
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ class: "icon-button" },
});
const __VLS_32 = {}.Bell;
/** @type {[typeof __VLS_components.Bell, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({}));
const __VLS_34 = __VLS_33({}, ...__VLS_functionalComponentArgsRest(__VLS_33));
if (__VLS_ctx.canOperate) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.canOperate))
                    return;
                __VLS_ctx.router.push('/releases?create=1');
            } },
        ...{ class: "primary-button" },
    });
    const __VLS_36 = {}.Plus;
    /** @type {[typeof __VLS_components.Plus, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({}));
    const __VLS_38 = __VLS_37({}, ...__VLS_functionalComponentArgsRest(__VLS_37));
}
const __VLS_40 = {}.RouterView;
/** @type {[typeof __VLS_components.RouterView, typeof __VLS_components.routerView, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({}));
const __VLS_42 = __VLS_41({}, ...__VLS_functionalComponentArgsRest(__VLS_41));
/** @type {__VLS_StyleScopedClasses['app-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['brand']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-mark']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-title']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-sub']} */ ;
/** @type {__VLS_StyleScopedClasses['workspace-switch']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-label']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-list']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-label']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-list']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-foot']} */ ;
/** @type {__VLS_StyleScopedClasses['runner-health']} */ ;
/** @type {__VLS_StyleScopedClasses['runner-health-head']} */ ;
/** @type {__VLS_StyleScopedClasses['runner-health-value']} */ ;
/** @type {__VLS_StyleScopedClasses['runner-bars']} */ ;
/** @type {__VLS_StyleScopedClasses['on']} */ ;
/** @type {__VLS_StyleScopedClasses['user-row']} */ ;
/** @type {__VLS_StyleScopedClasses['user-button']} */ ;
/** @type {__VLS_StyleScopedClasses['avatar']} */ ;
/** @type {__VLS_StyleScopedClasses['main']} */ ;
/** @type {__VLS_StyleScopedClasses['topbar']} */ ;
/** @type {__VLS_StyleScopedClasses['page-title']} */ ;
/** @type {__VLS_StyleScopedClasses['breadcrumb']} */ ;
/** @type {__VLS_StyleScopedClasses['search-box']} */ ;
/** @type {__VLS_StyleScopedClasses['shortcut']} */ ;
/** @type {__VLS_StyleScopedClasses['global-search-results']} */ ;
/** @type {__VLS_StyleScopedClasses['global-search-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['global-search-result']} */ ;
/** @type {__VLS_StyleScopedClasses['global-search-kind']} */ ;
/** @type {__VLS_StyleScopedClasses['global-search-arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['global-search-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-button']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-button']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Bell: Bell,
            Box: Box,
            ChevronRight: ChevronRight,
            Layers3: Layers3,
            Plus: Plus,
            Search: Search,
            Settings: Settings,
            ShipWheel: ShipWheel,
            route: route,
            router: router,
            auth: auth,
            search: search,
            searchInput: searchInput,
            searchLoading: searchLoading,
            nav: nav,
            canOperate: canOperate,
            canViewAudit: canViewAudit,
            title: title,
            searchResults: searchResults,
            loadSearchData: loadSearchData,
            selectSearchResult: selectSearchResult,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
