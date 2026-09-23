import { ArrowLeft, Box, CheckCircle2, ClipboardList, LockKeyhole, Rocket, ShieldCheck, Sparkles } from 'lucide-vue-next';
import { useRoute, useRouter } from 'vue-router';
const route = useRoute();
const router = useRouter();
const isAudit = route.name === 'audit';
const title = isAudit ? '审计日志' : '制品库';
const eyebrow = isAudit ? 'AUDIT LOG' : 'ARTIFACT REPOSITORY';
const description = isAudit ? '统一记录登录、发布、服务器操作和配置变更，后续支持按用户、项目、时间和操作类型检索。' : '统一保存和管理构建制品、Docker 镜像及 Compose 发布包，后续支持版本匹配、下载、清理和追溯。';
const features = isAudit
    ? [{ icon: LockKeyhole, title: '登录与权限日志', detail: '记录登录、退出、密码修改、角色和账号状态变化。' }, { icon: Rocket, title: '发布与服务操作', detail: '记录发布、回滚、暂停、启用、重启服务及执行结果。' }, { icon: ClipboardList, title: '配置变更追踪', detail: '记录项目、环境、目标服务器和平台配置的修改前后差异。' }]
    : [{ icon: Box, title: '制品版本管理', detail: '保存 Jar、Wheel、前端静态包、Docker 镜像和 Compose 包。' }, { icon: CheckCircle2, title: '制品匹配发布', detail: '根据项目、分支、版本和环境选择准确制品，避免发布错包。' }, { icon: ShieldCheck, title: '留痕与清理策略', detail: '关联发布记录并支持保留周期、下载权限和旧版本清理。' }];
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "content compact coming-soon-page" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "hero-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "eyebrow" },
});
(__VLS_ctx.eyebrow);
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
(__VLS_ctx.title);
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
(__VLS_ctx.description);
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.router.back();
        } },
    ...{ class: "secondary-button" },
});
const __VLS_0 = {}.ArrowLeft;
/** @type {[typeof __VLS_components.ArrowLeft, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "coming-soon-card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "coming-soon-icon" },
});
const __VLS_4 = {}.Sparkles;
/** @type {[typeof __VLS_components.Sparkles, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({}));
const __VLS_6 = __VLS_5({}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "coming-soon-pill" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
(__VLS_ctx.title);
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "coming-soon-features" },
});
for (const [feature] of __VLS_getVForSourceType((__VLS_ctx.features))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        key: (feature.title),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    const __VLS_8 = ((feature.icon));
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({}));
    const __VLS_10 = __VLS_9({}, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (feature.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
    (feature.detail);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "coming-soon-note" },
});
const __VLS_12 = {}.ShieldCheck;
/** @type {[typeof __VLS_components.ShieldCheck, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({}));
const __VLS_14 = __VLS_13({}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
/** @type {__VLS_StyleScopedClasses['content']} */ ;
/** @type {__VLS_StyleScopedClasses['compact']} */ ;
/** @type {__VLS_StyleScopedClasses['coming-soon-page']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-row']} */ ;
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['coming-soon-card']} */ ;
/** @type {__VLS_StyleScopedClasses['coming-soon-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['coming-soon-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['coming-soon-features']} */ ;
/** @type {__VLS_StyleScopedClasses['coming-soon-note']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            ArrowLeft: ArrowLeft,
            ShieldCheck: ShieldCheck,
            Sparkles: Sparkles,
            router: router,
            title: title,
            eyebrow: eyebrow,
            description: description,
            features: features,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
