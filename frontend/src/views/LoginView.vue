<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, LockKeyhole, ShipWheel, UserRound } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const auth = useAuthStore()
const router = useRouter()

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await auth.login(username.value, password.value)
    await router.push('/')
  } catch (exception: any) {
    error.value = exception.response?.data?.detail || '登录失败，请检查服务是否启动'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-aside">
      <div class="login-brand"><span><ShipWheel /></span><div><strong>轻舟</strong><small>Lightship DevOps</small></div></div>
      <div class="login-message"><span class="eyebrow">Ship software with confidence</span><h1>把每一次发布<br />变成清晰的航线</h1><p>统一管理 Java、前端与 Python 项目的构建、部署、验证和回滚。</p></div>
      <div class="login-track"><i v-for="n in 18" :key="n" :class="{ active: n < 14 }" /></div>
    </section>
    <section class="login-form-wrap">
      <form class="login-form" @submit.prevent="submit">
        <div class="eyebrow">Internal delivery platform</div><h2>登录轻舟</h2><p>使用平台管理员账号进入发布控制台。</p>
        <label>用户名</label><div class="login-input"><UserRound /><input v-model="username" autocomplete="username" /></div>
        <label>密码</label><div class="login-input"><LockKeyhole /><input v-model="password" type="password" autocomplete="current-password" /></div>
        <span v-if="error" class="error-text">{{ error }}</span>
        <button class="primary-button login-submit" :disabled="loading">{{ loading ? '正在登录...' : '进入控制台' }}<ArrowRight /></button>
        <small>首次启动账号来自后端环境变量，请立即修改默认密码。</small>
      </form>
    </section>
  </main>
</template>
