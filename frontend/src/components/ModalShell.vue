<script setup lang="ts">
import { X } from 'lucide-vue-next'

defineProps<{ title: string; subtitle?: string; size?: 'small' | 'normal' }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <div class="overlay" @mousedown.self="$emit('close')">
    <section class="modal" :class="{ small: size === 'small' }">
      <header class="modal-head">
        <div><h2>{{ title }}</h2><p v-if="subtitle">{{ subtitle }}</p></div>
        <button class="icon-button" @click="$emit('close')"><X /></button>
      </header>
      <slot />
    </section>
  </div>
</template>

