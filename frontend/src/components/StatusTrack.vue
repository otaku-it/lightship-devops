<script setup lang="ts">
const props = defineProps<{ stage: number; status: string }>()

function segmentClass(index: number) {
  if (props.status === 'success' || props.status === 'simulated' || index < props.stage) return 'done'
  if (props.status === 'running' && index === props.stage) return 'active'
  if (props.status === 'failed' && index === props.stage) return 'active failed'
  return ''
}
</script>

<template>
  <div>
    <div class="status-track"><i v-for="index in 4" :key="index" class="track-segment" :class="segmentClass(index)" /></div>
    <div class="status-caption">{{ status === 'success' ? '真实发布成功' : status === 'simulated' ? '仅模拟完成' : status === 'failed' ? '发布失败' : status === 'running' ? '执行中' : '等待执行' }}</div>
  </div>
</template>
