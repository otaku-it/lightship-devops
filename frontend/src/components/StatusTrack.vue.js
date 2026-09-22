const props = defineProps();
function segmentClass(index) {
    if (props.status === 'success' || props.status === 'simulated' || index < props.stage)
        return 'done';
    if (props.status === 'running' && index === props.stage)
        return 'active';
    if (props.status === 'failed' && index === props.stage)
        return 'active failed';
    return '';
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "status-track" },
});
for (const [index] of __VLS_getVForSourceType((4))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.i)({
        key: (index),
        ...{ class: "track-segment" },
        ...{ class: (__VLS_ctx.segmentClass(index)) },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "status-caption" },
});
(__VLS_ctx.status === 'success' ? '真实发布成功' : __VLS_ctx.status === 'simulated' ? '仅模拟完成' : __VLS_ctx.status === 'failed' ? '发布失败' : __VLS_ctx.status === 'running' ? '执行中' : '等待执行');
/** @type {__VLS_StyleScopedClasses['status-track']} */ ;
/** @type {__VLS_StyleScopedClasses['track-segment']} */ ;
/** @type {__VLS_StyleScopedClasses['status-caption']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            segmentClass: segmentClass,
        };
    },
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
