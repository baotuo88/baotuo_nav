<template>
  <header class="search-header">
    <div class="search-header-shell">
      <div class="search-brand-row">
        <div class="search-brand-block">
          <span class="search-brand-kicker">BTNAV INDEX</span>
          <div class="search-brand-main">
            <h2 class="search-brand-title">{{ title || '宝拓导航' }}</h2>
            <p class="search-brand-copy">精选工具与高频站点入口</p>
          </div>
        </div>

        <div class="search-hero-stats">
          <div class="search-hero-card">
            <span class="search-hero-value">{{ categories.length }}</span>
            <span class="search-hero-label">Sections</span>
          </div>
          <div class="search-hero-card">
            <span class="search-hero-value">{{ totalSites }}</span>
            <span class="search-hero-label">Sites</span>
          </div>
          <div class="search-hero-card search-hero-card-accent">
            <span class="search-hero-value">{{ currentEngineLabel }}</span>
            <span class="search-hero-label">Engine</span>
          </div>
        </div>
      </div>

      <div class="search-header-meta">
        <div class="header-meta-pills">
          <span class="header-pill header-pill-primary">
            <span class="header-pill-dot"></span>
            {{ activeCategory?.name || '导航总览' }}
          </span>
          <span class="header-pill">
            <span class="header-pill-engine">{{ currentEngineLabel }}</span>
            Search
          </span>
        </div>
        <span class="header-meta-copy">按 `/` 快速聚焦搜索，回车即可直达</span>
      </div>

      <div class="search-toolbar">
        <div class="search-container">
          <div class="search-engine-selector">
            <img :src="currentEngine.icon" :alt="selectedEngine" class="engine-logo" />
            <select
              class="engine-select"
              :value="selectedEngine"
              @change="$emit('update:selectedEngine', $event.target.value)"
            >
              <option value="google">Google</option>
              <option value="baidu">Baidu</option>
              <option value="bing">Bing</option>
              <option value="duckduckgo">DuckDuckGo</option>
            </select>
          </div>
          <input
            ref="searchInputRef"
            type="text"
            :value="searchQuery"
            :placeholder="currentEngine.placeholder"
            class="search-input"
            @input="$emit('update:searchQuery', $event.target.value)"
            @keyup.enter="$emit('search')"
          />
          <button type="button" class="search-submit-btn" @click="$emit('search')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="currentColor" stroke-width="2"/>
              <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span>搜索</span>
          </button>
        </div>

        <div class="header-actions">
          <button
            class="theme-toggle-btn"
            :title="isDarkMode ? '切换到日间模式' : '切换到夜间模式'"
            @click="$emit('toggle-theme')"
          >
            <svg v-if="!isDarkMode" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 18C8.68629 18 6 15.3137 6 12C6 8.68629 8.68629 6 12 6C15.3137 6 18 8.68629 18 12C18 15.3137 15.3137 18 12 18ZM12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16ZM11 1H13V4H11V1ZM11 20H13V23H11V20ZM3.51472 4.92893L4.92893 3.51472L7.05025 5.63604L5.63604 7.05025L3.51472 4.92893ZM16.9497 18.364L18.364 16.9497L20.4853 19.0711L19.0711 20.4853L16.9497 18.364ZM19.0711 3.51472L20.4853 4.92893L18.364 7.05025L16.9497 5.63604L19.0711 3.51472ZM5.63604 16.9497L7.05025 18.364L4.92893 20.4853L3.51472 19.0711L5.63604 16.9497ZM23 11V13H20V11H23ZM4 11V13H1V11H4Z"/>
            </svg>
            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 7C10 10.866 13.134 14 17 14C18.9584 14 20.729 13.1957 21.9995 11.8995C22 11.933 22 11.9665 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C12.0335 2 12.067 2 12.1005 2.00049C10.8043 3.27098 10 5.04157 10 7ZM4 12C4 16.4183 7.58172 20 12 20C15.0583 20 17.7158 18.2839 19.062 15.7621C18.3945 15.9187 17.7035 16 17 16C12.0294 16 8 11.9706 8 7C8 6.29648 8.08133 5.60547 8.2379 4.938C5.71611 6.28423 4 8.9417 4 12Z"/>
            </svg>
          </button>

          <button class="mobile-menu-btn" @click="$emit('toggle-mobile-menu')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div class="mobile-menu" :class="{ active: showMobileMenu }">
      <div class="mobile-menu-header">
        <div class="header-left">
          <h3>分类导航</h3>
          <img :src="githubLogo" alt="GitHub" class="header-github-icon" @click="$emit('open-github')" />
        </div>
        <button class="close-btn" @click="$emit('close-mobile-menu')">×</button>
      </div>
      <ul class="mobile-category-list">
        <li
          v-for="category in categories"
          :key="category.id"
          class="mobile-category-item"
          :class="{ active: category.id === activeCategoryId }"
          @click="$emit('select-category', category.id)"
        >
          <span class="category-icon">{{ category.icon }}</span>
          <span class="category-name">{{ category.name }}</span>
          <span class="mobile-site-count">{{ category.sites?.length || 0 }}</span>
        </li>
      </ul>
    </div>

    <div class="mobile-menu-overlay" :class="{ active: showMobileMenu }" @click="$emit('close-mobile-menu')"></div>
  </header>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  categories: {
    type: Array,
    default: () => []
  },
  totalSites: {
    type: Number,
    default: 0
  },
  selectedEngine: {
    type: String,
    default: 'bing'
  },
  activeCategory: {
    type: Object,
    default: null
  },
  activeCategoryId: {
    type: String,
    default: ''
  },
  searchEngines: {
    type: Object,
    required: true
  },
  searchQuery: {
    type: String,
    default: ''
  },
  showMobileMenu: {
    type: Boolean,
    default: false
  },
  isDarkMode: {
    type: Boolean,
    default: false
  },
  githubLogo: {
    type: String,
    required: true
  }
})

defineEmits([
  'update:selectedEngine',
  'update:searchQuery',
  'search',
  'toggle-theme',
  'toggle-mobile-menu',
  'close-mobile-menu',
  'select-category',
  'open-github'
])

const searchInputRef = ref(null)

const currentEngine = computed(() => {
  return props.searchEngines[props.selectedEngine] || props.searchEngines.bing
})

const currentEngineLabel = computed(() => {
  const labels = {
    google: 'Google',
    baidu: 'Baidu',
    bing: 'Bing',
    duckduckgo: 'DuckDuckGo'
  }

  return labels[props.selectedEngine] || 'Bing'
})

defineExpose({
  focusSearchInput() {
    searchInputRef.value?.focus()
  }
})
</script>
