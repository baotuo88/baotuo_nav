<template>
  <aside class="sidebar">
    <div class="logo-section">
      <img src="/logo.png" alt="宝拓导航 logo" class="logo" />
      <div class="logo-copy">
        <div class="brand-meta">
          <span class="brand-kicker">BTNAV</span>
        </div>
        <h1 class="site-title">{{ title || '宝拓导航' }}</h1>
        <p class="site-subtitle">Curated Directory</p>
      </div>
    </div>

    <div v-if="activeCategory" class="sidebar-focus">
      <div class="focus-label-row">
        <span class="focus-label">In View</span>
        <span class="focus-index">{{ activeIndexLabel }}</span>
      </div>
      <div class="focus-main">
        <span class="focus-icon">{{ activeCategory.icon }}</span>
        <div class="focus-copy">
          <p class="focus-name">{{ activeCategory.name }}</p>
          <p class="focus-meta">{{ activeCategory.sites?.length || 0 }} 个站点</p>
        </div>
      </div>
      <div class="focus-progress">
        <span :style="{ width: `${progressPercent}%` }"></span>
      </div>
    </div>

    <nav class="category-nav">
      <div class="nav-title-row">
        <h2 class="nav-title">分类导航</h2>
        <span class="nav-count">{{ categories.length }}</span>
      </div>
      <div class="category-list-shell">
        <span class="category-list-rail"></span>
        <ul class="category-list">
          <li
            v-for="category in categories"
            :key="category.id"
            class="category-item"
            :class="{ 'is-active': category.id === activeCategoryId }"
          >
            <button
              type="button"
              class="category-action"
              :aria-current="category.id === activeCategoryId ? 'true' : 'false'"
              @click="$emit('select-category', category.id)"
            >
              <span class="nav-ornament"></span>
              <span class="category-icon">{{ category.icon }}</span>
              <span class="category-name">{{ category.name }}</span>
              <span class="site-count">{{ category.sites?.length || 0 }}</span>
            </button>
          </li>
        </ul>
      </div>
    </nav>

    <div class="sidebar-footer">
      <a
        :href="repoUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="github-link"
        title="查看源代码"
      >
        <span class="github-link-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </span>
        <span class="github-link-body">
          <span class="github-link-label">GitHub 仓库</span>
          <span class="github-link-copy">项目开源中，欢迎 Star 支持</span>
        </span>
      </a>
    </div>
  </aside>
</template>

<script setup>
defineProps({
  categories: {
    type: Array,
    default: () => []
  },
  title: {
    type: String,
    default: ''
  },
  activeCategoryId: {
    type: String,
    default: ''
  },
  activeCategory: {
    type: Object,
    default: null
  },
  activeIndexLabel: {
    type: String,
    default: '01'
  },
  progressPercent: {
    type: Number,
    default: 0
  },
  repoUrl: {
    type: String,
    default: 'https://github.com/baotuo88/baotuo_nav'
  }
})

defineEmits(['select-category'])
</script>
