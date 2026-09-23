<script setup lang="ts">
import { ArrowLeft, Box, CheckCircle2, ClipboardList, LockKeyhole, Rocket, ShieldCheck, Sparkles } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const isAudit = route.name === 'audit'
const title = isAudit ? '审计日志' : '制品库'
const eyebrow = isAudit ? 'AUDIT LOG' : 'ARTIFACT REPOSITORY'
const description = isAudit ? '统一记录登录、发布、服务器操作和配置变更，后续支持按用户、项目、时间和操作类型检索。' : '统一保存和管理构建制品、Docker 镜像及 Compose 发布包，后续支持版本匹配、下载、清理和追溯。'
const features = isAudit
  ? [{ icon: LockKeyhole, title: '登录与权限日志', detail: '记录登录、退出、密码修改、角色和账号状态变化。' }, { icon: Rocket, title: '发布与服务操作', detail: '记录发布、回滚、暂停、启用、重启服务及执行结果。' }, { icon: ClipboardList, title: '配置变更追踪', detail: '记录项目、环境、目标服务器和平台配置的修改前后差异。' }]
  : [{ icon: Box, title: '制品版本管理', detail: '保存 Jar、Wheel、前端静态包、Docker 镜像和 Compose 包。' }, { icon: CheckCircle2, title: '制品匹配发布', detail: '根据项目、分支、版本和环境选择准确制品，避免发布错包。' }, { icon: ShieldCheck, title: '留痕与清理策略', detail: '关联发布记录并支持保留周期、下载权限和旧版本清理。' }]
</script>

<template>
  <div class="content compact coming-soon-page">
    <div class="hero-row"><div><div class="eyebrow">{{ eyebrow }}</div><h1>{{ title }}</h1><p>{{ description }}</p></div><button class="secondary-button" @click="router.back()"><ArrowLeft />返回上一页</button></div>
    <section class="coming-soon-card"><div class="coming-soon-icon"><Sparkles /></div><span class="coming-soon-pill">待开发</span><h2>{{ title }}正在规划中</h2><p>当前版本先保留入口，不执行模拟数据，也不会把未实现的能力伪装成可用功能。</p><div class="coming-soon-features"><article v-for="feature in features" :key="feature.title"><span><component :is="feature.icon" /></span><div><strong>{{ feature.title }}</strong><small>{{ feature.detail }}</small></div></article></div><div class="coming-soon-note"><ShieldCheck /><span>已有的项目、发布、环境和服务状态功能不受影响，后续模块会复用现有权限和审计体系。</span></div></section>
  </div>
</template>
