<script setup lang="ts">
import { computed, ref } from 'vue'
import { data } from '../../posts/posts.data.mts'
import { withBase } from 'vitepress'

interface Post {
  title: string
  date: string
  author: string
  url: string
  excerpt: string
  series?: string
  seriesOrder?: number
}

interface StageGroup {
  name: string
  posts: Post[]
}

interface Collection {
  title: string
  posts: Post[]
  stages: StageGroup[]
  latestDate: string
}

const posts = data as Post[]

// 合集默认折叠显示前 6 篇，点击展开全部
const PREVIEW_COUNT = 6
const expandedSet = ref<Record<string, boolean>>({})

function toggleExpand(title: string) {
  expandedSet.value = { ...expandedSet.value, [title]: !expandedSet.value[title] }
}
function isExpanded(title: string) {
  return !!expandedSet.value[title]
}

// 根据 seriesOrder 划分阶段
function getStage(order: number): string {
  if (order <= 18) return '第一阶段：Agent Core'
  if (order <= 22) return '第二阶段：Memory & Knowledge'
  if (order <= 28) return '第三阶段：Infrastructure'
  return '第四阶段：Multi-Agent'
}

// 按 series 分组：有 series 的归入合集，合集内部按阶段分子组
const grouped = computed(() => {
  const seriesMap = new Map<string, Post[]>()
  const standalonePosts: Post[] = []

  for (const p of posts) {
    if (p.series) {
      if (!seriesMap.has(p.series)) seriesMap.set(p.series, [])
      seriesMap.get(p.series)!.push(p)
    } else {
      standalonePosts.push(p)
    }
  }

  const collectionList: Collection[] = []
  for (const [title, seriesPosts] of seriesMap) {
    seriesPosts.sort((a, b) => (a.seriesOrder || 0) - (b.seriesOrder || 0))

    // 按阶段分组
    const stageMap = new Map<string, Post[]>()
    for (const p of seriesPosts) {
      const stage = getStage(p.seriesOrder || 0)
      if (!stageMap.has(stage)) stageMap.set(stage, [])
      stageMap.get(stage)!.push(p)
    }
    const stages: StageGroup[] = []
    for (const [name, stagePosts] of stageMap) {
      stages.push({ name, posts: stagePosts })
    }

    collectionList.push({
      title,
      posts: seriesPosts,
      stages,
      latestDate: seriesPosts.reduce((max, p) => p.date > max ? p.date : max, ''),
    })
  }
  collectionList.sort((a, b) => b.latestDate.localeCompare(a.latestDate))

  standalonePosts.sort((a, b) => b.date.localeCompare(a.date))

  return { collections: collectionList, standalone: standalonePosts }
})

// 截取摘要
function shortExcerpt(text: string, len = 80) {
  return text.length > len ? text.slice(0, len) + '...' : text
}
</script>

<template>
  <div class="post-feed">
    <!-- 合集卡片 -->
    <div
      v-for="col in grouped.collections"
      :key="col.title"
      class="collection-card"
    >
      <div class="collection-header">
        <span class="collection-icon">📂</span>
        <span class="collection-title">{{ col.title }}</span>
        <span class="collection-count">{{ col.posts.length }} 篇</span>
      </div>

      <!-- 内容区，折叠时限制高度 -->
      <div :class="['collection-body', { 'is-collapsed': !isExpanded(col.title) }]">
        <div
          v-for="stage in col.stages"
          :key="stage.name"
          class="stage-group"
        >
          <div class="stage-header">{{ stage.name }} <span class="stage-count">{{ stage.posts.length }} 篇</span></div>
          <div class="collection-posts">
            <a
              v-for="p in isExpanded(col.title) ? stage.posts : stage.posts.slice(0, Math.ceil(PREVIEW_COUNT / col.stages.length))"
              :key="p.url"
              :href="withBase(p.url)"
              class="collection-post-item"
            >
              <span class="cp-order">{{ p.seriesOrder }}</span>
              <div class="cp-content">
                <span class="cp-title">{{ p.title }}</span>
                <span class="cp-excerpt">{{ shortExcerpt(p.excerpt, 60) }}</span>
              </div>
              <span class="cp-date">{{ p.date }}</span>
            </a>
          </div>
        </div>
      </div>

      <div class="collection-toggle-wrap">
        <button class="collection-toggle-btn" @click="toggleExpand(col.title)">
          <span v-if="!isExpanded(col.title)">展开全部 {{ col.posts.length }} 篇</span>
          <span v-else>收起</span>
        </button>
      </div>
    </div>

    <!-- 独立单帖卡片 -->
    <a
      v-for="post in grouped.standalone"
      :key="post.url"
      :href="withBase(post.url)"
      class="post-card"
    >
      <p class="post-title">{{ post.title }}</p>
      <p class="post-date">{{ post.date }} · {{ post.author }}</p>
      <p class="post-excerpt">{{ shortExcerpt(post.excerpt) }}</p>
    </a>
  </div>
</template>

<style scoped>
/* ===== 布局 ===== */
.post-feed {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 24px;
  margin-top: 32px;
  align-items: start;
}

/* ===== 合集卡片 ===== */
.collection-card {
  border: 1px solid var(--vp-c-brand-soft);
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: border-color 0.25s, box-shadow 0.25s;
}

.collection-card:hover {
  border-color: var(--vp-c-brand);
  box-shadow: 0 2px 16px rgba(0,0,0,0.08);
}

.collection-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  flex-shrink: 0;
}

.collection-icon {
  font-size: 18px;
}

.collection-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  flex: 1;
}

.collection-count {
  font-size: 12px;
  color: var(--vp-c-text-3);
  background: var(--vp-c-bg-soft);
  padding: 2px 10px;
  border-radius: 10px;
}

/* 内容区 */
.collection-body {
  flex: 1;
  min-height: 0;
}

.collection-body.is-collapsed {
  max-height: 200px;
  overflow: hidden;
}

/* 阶段子分组 */
.stage-group {
  border-bottom: 1px solid var(--vp-c-divider);
}

.stage-group:last-child {
  border-bottom: none;
}

.stage-header {
  padding: 10px 20px 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg);
}

.stage-count {
  font-size: 11px;
  font-weight: 400;
  color: var(--vp-c-text-3);
}

/* 合集内小帖子 */
.collection-posts {
  padding: 6px 0;
}

.collection-post-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 20px;
  text-decoration: none;
  color: inherit;
  transition: background 0.15s;
}

.collection-post-item:hover {
  background: var(--vp-c-bg);
}

.collection-post-item:hover .cp-title {
  color: var(--vp-c-brand);
}

.cp-order {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand);
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
  margin-top: 1px;
}

.cp-content {
  flex: 1;
  min-width: 0;
}

.cp-title {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  transition: color 0.15s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.cp-excerpt {
  display: block;
  font-size: 12px;
  color: var(--vp-c-text-3);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-date {
  font-size: 12px;
  color: var(--vp-c-text-3);
  flex-shrink: 0;
  margin-top: 2px;
}

/* 展开/收起按钮 */
.collection-toggle-wrap {
  padding: 12px 20px;
  text-align: center;
  border-top: 1px solid var(--vp-c-divider);
  margin-top: auto;
  flex-shrink: 0;
}

.collection-toggle-btn {
  display: inline-block;
  padding: 6px 24px;
  font-size: 13px;
  color: var(--vp-c-brand);
  background: transparent;
  border: 1px solid var(--vp-c-brand);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.collection-toggle-btn:hover {
  background: var(--vp-c-brand);
  color: #fff;
}

/* ===== 独立单帖卡片 ===== */
.post-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 24px;
  min-height: 280px;
  transition: border-color 0.25s, transform 0.25s;
  background: var(--vp-c-bg-soft);
  text-decoration: none;
  color: inherit;
}

.post-card:hover {
  border-color: var(--vp-c-brand);
  transform: translateY(-2px);
}

.post-card .post-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--vp-c-text-1);
}

.post-card:hover .post-title {
  color: var(--vp-c-brand);
}

.post-card .post-date {
  font-size: 13px;
  color: var(--vp-c-text-3);
  margin-bottom: 12px;
}

.post-card .post-excerpt {
  font-size: 14px;
  color: var(--vp-c-text-2);
  line-height: 1.6;
  margin: 0;
  flex: 1;
}
</style>
