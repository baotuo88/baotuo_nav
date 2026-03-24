<template>
  <AccessLock
    v-if="isLocked && !isUnlocked"
    :password="unlockPassword"
    :unlocking="unlocking"
    :error-message="unlockError"
    @update:password="unlockPassword = $event"
    @unlock="handleUnlock"
  />

  <div v-else class="nav-home">
    <HomeSidebar
      :categories="displayCategories"
      :title="title"
      :active-category-id="activeCategoryId"
      :active-category="activeCategory"
      :active-index-label="activeCategoryIndexLabel"
      :progress-percent="activeCategoryProgress"
      :repo-url="repoUrl"
      @select-category="scrollToCategory"
    />

    <main class="main-content">
      <SearchHeader
        ref="searchHeaderRef"
        :title="title"
        :categories="displayCategories"
        :total-sites="totalSiteCount"
        :selected-engine="selectedEngine"
        :active-category="activeCategory"
        :active-category-id="activeCategoryId"
        :search-engines="searchEngines"
        :search-query="searchQuery"
        :show-mobile-menu="showMobileMenu"
        :is-dark-mode="themeStore.isDarkMode"
        :github-logo="githubLogo"
        @update:selected-engine="selectedEngine = $event"
        @update:search-query="searchQuery = $event"
        @search="handleSearch"
        @toggle-theme="themeStore.toggleTheme()"
        @toggle-mobile-menu="toggleMobileMenu"
        @close-mobile-menu="closeMobileMenu"
        @select-category="scrollToCategoryMobile"
        @open-github="openGitHub"
      />

      <div ref="contentAreaRef" class="content-area" @scroll="handleContentScroll">
        <div class="content-shell">
          <div v-if="loading" class="loading">
            <div class="loading-spinner"></div>
            <p>加载中...</p>
          </div>

          <div v-else-if="error" class="error">
            <p>{{ error }}</p>
            <button @click="fetchCategories" class="retry-btn">重试</button>
          </div>

          <div v-else class="categories-container">
            <CategorySection
              v-for="(category, index) in displayCategories"
              :key="category.id"
              :category="category"
              :section-index="index"
              @image-error="handleImageError"
              @site-click="handleSiteClick"
            />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, onMounted, onUnmounted, watch } from 'vue'
import { useNavigation } from '@/apis/useNavigation.js'
import { useThemeStore } from '@/stores/theme.js'
import AccessLock from '@/components/home/AccessLock.vue'
import HomeSidebar from '@/components/home/HomeSidebar.vue'
import SearchHeader from '@/components/home/SearchHeader.vue'
import CategorySection from '@/components/home/CategorySection.vue'
import googleLogo from '@/assets/goolge.png'
import baiduLogo from '@/assets/baidu.png'
import bingLogo from '@/assets/bing.png'
import duckLogo from '@/assets/duck.png'
import githubLogo from '@/assets/github.png'

const { categories, title, defaultSearchEngine, loading, error, fetchCategories } = useNavigation()
const themeStore = useThemeStore()

const searchQuery = ref('')
const selectedEngine = ref('bing')
const showMobileMenu = ref(false)
const activeCategoryId = ref('')
const isLocked = ref(false)
const isUnlocked = ref(false)
const unlockPassword = ref('')
const unlocking = ref(false)
const unlockError = ref('')
const contentAreaRef = ref(null)
const searchHeaderRef = ref(null)

const repoUrl = 'https://github.com/baotuo88/baotuo_nav'
const FAVORITES_CATEGORY_ID = 'my-favorites'
const FAVORITES_CATEGORY_NAME = '我的常用'
const FAVORITES_STORAGE_KEY = 'btnav-site-activity'
const FAVORITES_LIMIT = 5
const siteActivity = ref({})

const isFavoritesCategory = (category) => {
  return category?.id === FAVORITES_CATEGORY_ID || category?.name === FAVORITES_CATEGORY_NAME
}

const getSiteKey = (site) => {
  if (!site || typeof site !== 'object') {
    return ''
  }

  if (site.url) {
    try {
      const parsedUrl = new URL(site.url)
      const normalizedPath = parsedUrl.pathname.replace(/\/+$/, '') || '/'
      return `${parsedUrl.origin}${normalizedPath}`.toLowerCase()
    } catch {
      // noop
    }
  }

  return `${site.id || site.name || ''}`.trim().toLowerCase()
}

const normalizeSiteActivity = (rawValue) => {
  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    return {}
  }

  const normalizedValue = {}

  Object.entries(rawValue).forEach(([siteKey, activity]) => {
    if (!siteKey) {
      return
    }

    if (typeof activity === 'number' && Number.isFinite(activity) && activity > 0) {
      normalizedValue[siteKey] = {
        count: Math.max(1, Math.floor(activity)),
        updatedAt: 0
      }
      return
    }

    if (!activity || typeof activity !== 'object' || Array.isArray(activity)) {
      return
    }

    const count = Number(activity.count)
    if (!Number.isFinite(count) || count <= 0) {
      return
    }

    const updatedAt = Number(activity.updatedAt)

    normalizedValue[siteKey] = {
      count: Math.max(1, Math.floor(count)),
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0
    }
  })

  return normalizedValue
}

const readSiteActivity = () => {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const rawValue = window.localStorage.getItem(FAVORITES_STORAGE_KEY)
    return normalizeSiteActivity(rawValue ? JSON.parse(rawValue) : {})
  } catch (error) {
    console.warn('读取站点点击记录失败，已跳过我的常用统计。', error)
    return {}
  }
}

const persistSiteActivity = (activity) => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(activity))
  } catch (error) {
    console.warn('保存站点点击记录失败，已跳过本次我的常用统计。', error)
  }
}

const baseCategories = computed(() => {
  return Array.isArray(categories.value) ? categories.value : []
})

const fallbackFavoritesCategory = computed(() => {
  return baseCategories.value.find(isFavoritesCategory) || null
})

const uniqueSites = computed(() => {
  const sitesByKey = new Map()
  const orderedCategories = [
    ...baseCategories.value.filter((category) => !isFavoritesCategory(category)),
    ...baseCategories.value.filter(isFavoritesCategory)
  ]

  orderedCategories.forEach((category) => {
    ;(category.sites || []).forEach((site) => {
      const siteKey = getSiteKey(site)

      if (!siteKey || sitesByKey.has(siteKey)) {
        return
      }

      sitesByKey.set(siteKey, {
        ...site,
        siteKey
      })
    })
  })

  return Array.from(sitesByKey.values())
})

const favoriteSites = computed(() => {
  const selectedSites = []
  const usedSiteKeys = new Set()

  const appendSite = (site) => {
    const siteKey = site?.siteKey || getSiteKey(site)

    if (!siteKey || usedSiteKeys.has(siteKey) || selectedSites.length >= FAVORITES_LIMIT) {
      return
    }

    const normalizedSite = { ...site }
    delete normalizedSite.siteKey

    selectedSites.push(normalizedSite)
    usedSiteKeys.add(siteKey)
  }

  const trackedSites = uniqueSites.value
    .filter((site) => (siteActivity.value[site.siteKey]?.count || 0) > 0)
    .sort((leftSite, rightSite) => {
      const leftActivity = siteActivity.value[leftSite.siteKey] || { count: 0, updatedAt: 0 }
      const rightActivity = siteActivity.value[rightSite.siteKey] || { count: 0, updatedAt: 0 }

      if (rightActivity.count !== leftActivity.count) {
        return rightActivity.count - leftActivity.count
      }

      if (rightActivity.updatedAt !== leftActivity.updatedAt) {
        return rightActivity.updatedAt - leftActivity.updatedAt
      }

      return leftSite.name.localeCompare(rightSite.name, 'zh-Hans-CN')
    })

  trackedSites.forEach(appendSite)
  ;(fallbackFavoritesCategory.value?.sites || []).forEach(appendSite)
  uniqueSites.value.forEach(appendSite)

  return selectedSites.slice(0, FAVORITES_LIMIT)
})

const displayCategories = computed(() => {
  if (baseCategories.value.length === 0) {
    return []
  }

  const dynamicFavoritesCategory = {
    ...(fallbackFavoritesCategory.value || {
      id: FAVORITES_CATEGORY_ID,
      name: FAVORITES_CATEGORY_NAME,
      icon: '💥',
      order: -1
    }),
    sites: favoriteSites.value
  }

  if (baseCategories.value.some(isFavoritesCategory)) {
    return baseCategories.value.map((category) => {
      return isFavoritesCategory(category) ? dynamicFavoritesCategory : category
    })
  }

  return [dynamicFavoritesCategory, ...baseCategories.value]
})

const activeCategory = computed(() => {
  if (!Array.isArray(displayCategories.value) || displayCategories.value.length === 0) {
    return null
  }

  return displayCategories.value.find((category) => category.id === activeCategoryId.value) || displayCategories.value[0]
})

const activeCategoryIndex = computed(() => {
  if (!activeCategory.value) {
    return -1
  }

  return displayCategories.value.findIndex((category) => category.id === activeCategory.value.id)
})

const activeCategoryIndexLabel = computed(() => {
  const index = Math.max(activeCategoryIndex.value, 0) + 1
  return String(index).padStart(2, '0')
})

const totalSiteCount = computed(() => {
  if (!Array.isArray(displayCategories.value) || displayCategories.value.length === 0) {
    return 0
  }

  return displayCategories.value.reduce((count, category) => count + (category.sites?.length || 0), 0)
})

const activeCategoryProgress = computed(() => {
  if (!Array.isArray(displayCategories.value) || displayCategories.value.length === 0) {
    return 0
  }

  return Math.max(16, Math.round(((Math.max(activeCategoryIndex.value, 0) + 1) / displayCategories.value.length) * 100))
})

const searchEngines = {
  google: {
    url: 'https://www.google.com/search?q=',
    icon: googleLogo,
    placeholder: 'Google (点 logo 切换搜索引擎)'
  },
  baidu: {
    url: 'https://www.baidu.com/s?wd=',
    icon: baiduLogo,
    placeholder: '百度一下（点 logo 切换搜索引擎）'
  },
  bing: {
    url: 'https://www.bing.com/search?q=',
    icon: bingLogo,
    placeholder: 'Bing (点 logo 切换搜索引擎)'
  },
  duckduckgo: {
    url: 'https://duckduckgo.com/?q=',
    icon: duckLogo,
    placeholder: 'DuckDuckGo (点 logo 切换搜索引擎)'
  }
}

// 自定义固定时间滚动函数
const smoothScrollTo = (container, targetTop, duration = 600) => {
  const startTop = container.scrollTop
  const distance = targetTop - startTop
  let startTime = null

  const animateScroll = (currentTime) => {
    if (startTime === null) startTime = currentTime
    const timeElapsed = currentTime - startTime
    const progress = Math.min(timeElapsed / duration, 1)

    // 使用缓动函数 (easeInOutCubic)
    const ease = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2

    container.scrollTop = startTop + distance * ease

    if (progress < 1) {
      requestAnimationFrame(animateScroll)
    }
  }

  requestAnimationFrame(animateScroll)
}

const updateActiveCategoryFromScroll = () => {
  const container = contentAreaRef.value
  if (!container || !displayCategories.value.length) {
    return
  }

  const sections = Array.from(container.querySelectorAll('.category-section'))
  if (!sections.length) {
    return
  }

  const isMobile = window.innerWidth <= 768
  const offset = isMobile ? 22 : 22
  const currentScroll = container.scrollTop + offset

  let currentSectionId = sections[0].id.replace('category-', '')

  for (const section of sections) {
    if (section.offsetTop <= currentScroll) {
      currentSectionId = section.id.replace('category-', '')
    } else {
      break
    }
  }

  activeCategoryId.value = currentSectionId
}

const handleContentScroll = () => {
  updateActiveCategoryFromScroll()
}

const shouldIgnoreGlobalShortcut = () => {
  const activeElement = document.activeElement
  if (!activeElement) {
    return false
  }

  const tagName = activeElement.tagName
  return activeElement.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)
}

const handleGlobalShortcut = (event) => {
  if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
    if (shouldIgnoreGlobalShortcut()) {
      return
    }

    event.preventDefault()
    searchHeaderRef.value?.focusSearchInput()
    return
  }

  if (event.key === 'Escape' && showMobileMenu.value) {
    closeMobileMenu()
  }
}

// 滚动到指定分类
const scrollToCategory = (categoryId) => {
  const element = document.getElementById(`category-${categoryId}`)
  const container = contentAreaRef.value

  if (element && container) {
    activeCategoryId.value = categoryId
    const isMobile = window.innerWidth <= 768
    const scrollOffset = isMobile ? 14 : 18
    const targetTop = element.offsetTop - scrollOffset

    // 使用固定时间滚动（600毫秒）
    smoothScrollTo(container, Math.max(0, targetTop), 600)
  }
}

// 检查是否启用锁定功能
const checkLockStatus = () => {
  const openLock = `${import.meta.env.VITE_OPEN_LOCK || ''}`.trim().toLowerCase()
  const lockPassword = `${import.meta.env.VITE_OPEN_LOCK_PASSWORD || ''}`.trim()
  const lockEnabled = openLock !== '' && !['0', 'false', 'off', 'no'].includes(openLock)

  if (lockEnabled && lockPassword) {
    isLocked.value = true
    const savedUnlock = localStorage.getItem('nav_unlocked')
    if (savedUnlock === 'true') {
      isUnlocked.value = true
    }
  } else {
    if (lockEnabled && !lockPassword) {
      console.warn('已启用 VITE_OPEN_LOCK，但未配置 VITE_OPEN_LOCK_PASSWORD，已跳过前台访问锁。')
    }
    isLocked.value = false
    isUnlocked.value = true
  }
}

// 处理解锁
const handleUnlock = async () => {
  unlocking.value = true
  unlockError.value = ''

  try {
    const lockPassword = `${import.meta.env.VITE_OPEN_LOCK_PASSWORD || ''}`.trim()

    if (!lockPassword) {
      throw new Error('访问密钥未配置')
    }

    if (unlockPassword.value === lockPassword) {
      isUnlocked.value = true
      localStorage.setItem('nav_unlocked', 'true')
      unlockPassword.value = ''
    } else {
      throw new Error('访问密钥错误，请重新输入')
    }
  } catch (error) {
    unlockError.value = error.message
  } finally {
    unlocking.value = false
  }
}

// 处理搜索
const handleSearch = () => {
  if (!searchQuery.value.trim()) return

  const engine = searchEngines[selectedEngine.value]
  const url = engine.url + encodeURIComponent(searchQuery.value)
  window.open(url, '_blank')
}

// 处理图片加载错误
const handleImageError = (event) => {
  // 使用品牌 favicon 作为兜底图标
  event.target.src = '/favicon.svg'
  event.target.onerror = null // 防止无限循环
}

// 移动端菜单控制
const toggleMobileMenu = () => {
  showMobileMenu.value = !showMobileMenu.value
  // 控制body滚动
  if (showMobileMenu.value) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
}

const closeMobileMenu = () => {
  showMobileMenu.value = false
  // 恢复body滚动
  document.body.style.overflow = ''
}

// 移动端分类滚动
const scrollToCategoryMobile = (categoryId) => {
  closeMobileMenu() // 先关闭菜单

  // 稍微延迟一下再滚动，确保菜单关闭动画完成
  setTimeout(() => {
    scrollToCategory(categoryId)
  }, 200)
}

// 打开GitHub项目页面
const openGitHub = () => {
  window.open(repoUrl, '_blank')
}

const handleSiteClick = (site) => {
  const siteKey = getSiteKey(site)

  if (!siteKey) {
    return
  }

  const nextActivity = {
    ...siteActivity.value,
    [siteKey]: {
      count: (siteActivity.value[siteKey]?.count || 0) + 1,
      updatedAt: Date.now()
    }
  }

  siteActivity.value = nextActivity
  persistSiteActivity(nextActivity)
}

// 组件挂载时获取数据
onMounted(async () => {
  checkLockStatus() // 检查锁定状态
  siteActivity.value = readSiteActivity()
  window.addEventListener('keydown', handleGlobalShortcut)
  await fetchCategories()
  // 设置默认搜索引擎
  selectedEngine.value = defaultSearchEngine.value
  await nextTick()
  updateActiveCategoryFromScroll()
})

// 组件卸载时清理样式
onUnmounted(() => {
  // 确保卸载时恢复body滚动
  document.body.style.overflow = ''
  window.removeEventListener('keydown', handleGlobalShortcut)
})

watch(displayCategories, async (newCategories) => {
  if (!Array.isArray(newCategories) || newCategories.length === 0) {
    activeCategoryId.value = ''
    return
  }

  if (!activeCategoryId.value) {
    activeCategoryId.value = newCategories[0].id
  }

  await nextTick()
  updateActiveCategoryFromScroll()
}, { flush: 'post' })
</script>

<style>
/* 锁定界面样式 */
.lock-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2c3e50;
  padding: 20px;
  z-index: 9999;
}

.lock-box {
  background: white;
  padding: 40px;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.lock-box h1 {
  color: #2d3748;
  margin-bottom: 8px;
  font-size: 28px;
  font-weight: 600;
}

.lock-description {
  color: #718096;
  margin-bottom: 30px;
  font-size: 16px;
}

.lock-box .form-group {
  margin-bottom: 20px;
  text-align: left;
}

.lock-box .form-group label {
  display: block;
  margin-bottom: 8px;
  color: #4a5568;
  font-weight: 500;
  font-size: 14px;
}

.lock-box .form-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  transition: all 0.3s ease;
  background: #fff;
}

.lock-box .form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.unlock-btn {
  width: 100%;
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 10px;
}

.unlock-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
}

.unlock-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.lock-box .error-message {
  margin-top: 15px;
  padding: 12px;
  background: #fed7d7;
  color: #c53030;
  border-radius: 8px;
  font-size: 14px;
  border: 1px solid #feb2b2;
}

.nav-home {
  display: flex;
  min-height: 100vh;
  background-color: #f5f7fa;
}

/* 左侧边栏样式 */
.sidebar {
  display: flex;
  flex-direction: column;
  width: 280px;
  background-color: #2c3e50;
  color: white;
  padding: 0;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
  height: 100vh;
  overflow: hidden;
  flex-shrink: 0;
}

.logo-section {
  display: flex;
  align-items: center;
  padding-left: 20px;
  padding-top: 13px;
  padding-bottom: 13px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo {
  width: 55px;
  height: 55px;
  border-radius: 12px;
  margin-right: 15px;
}

.site-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
  color: white;
}

.category-nav {
  flex: 1;
  min-height: 0;
  padding: 20px 0;
  overflow-y: auto;
}

.nav-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 20px 15px;
  color: #bdc3c7;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.category-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.category-item {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.category-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
  box-shadow: inset 4px 0 0 #3498db;
}

.category-icon {
  font-size: 18px;
  margin-right: 12px;
  width: 20px;
  text-align: center;
}

.category-name {
  font-size: 15px;
  font-weight: 500;
}

/* 左侧边栏底部 */
.sidebar-footer {
  padding: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.github-link {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  color: #bdc3c7;
  text-decoration: none;
  padding: 12px 14px;
  border-radius: 12px;
  transition: all 0.3s ease;
  font-size: 14px;
}

.github-link:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  transform: translateY(-1px);
}

.github-link svg {
  flex-shrink: 0;
  margin-top: 1px;
  transition: transform 0.3s ease;
}

.github-link:hover svg {
  transform: scale(1.1);
}

.github-link-copy {
  line-height: 1.45;
}

/* 右侧主内容区样式 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.search-header {
  background: white;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 15px;
}

.search-container {
  display: flex;
  max-width: 600px;
  margin: 0 auto;
  gap: 0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  flex: 1;
}

@media (max-width: 768px) {
  .search-container {
    margin: 0;
    max-width: none;
  }
}

.search-engine-selector {
  position: relative;
  display: flex;
  align-items: center;
  background: #f8f9fa;
  border-right: 1px solid #e9ecef;
  transition: background-color 0.2s ease;
}

.search-engine-selector:hover {
  background: #e9ecef;
}

.engine-logo {
  width: 24px;
  height: 24px;
  margin: 8px;
  object-fit: contain;
  pointer-events: none;
  border-radius: 4px;
}

.engine-select {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  border: none;
  outline: none;
  background: transparent;
}

.search-input {
  flex: 1;
  border: none;
  padding: 12px 16px;
  font-size: 16px;
  outline: none;
  background: white;
}

.search-input::placeholder {
  color: #95a5a6;
}

/* 移动端菜单按钮 */
.mobile-menu-btn {
  display: none;
  background: none;
  border: none;
  color: #2c3e50;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.mobile-menu-btn:hover {
  background: #f8f9fa;
}

/* 移动端菜单 */
.mobile-menu {
  position: fixed;
  top: 0;
  right: -100%;
  width: 240px;
  height: 100vh;
  background: white;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
  z-index: 1001;
  transition: right 0.3s ease;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

.mobile-menu.active {
  right: 0;
}

.mobile-menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
  background: #2c3e50;
  color: white;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mobile-menu-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.header-github-icon {
  width: 30px;
  height: 30px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.3s ease;
  opacity: 0.8;
}

.header-github-icon:hover {
  opacity: 1;
  transform: scale(1.1);
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.mobile-category-list {
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 1;
  overflow-y: auto;
  padding-bottom: 160px; /* 增加底部内边距确保最后一项完全可见 */
}

.mobile-category-item {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid #f8f9fa;
}

.mobile-category-item:hover {
  background: #f8f9fa;
}

.mobile-category-item .category-icon {
  font-size: 20px;
  margin-right: 12px;
  width: 24px;
  text-align: center;
}

.mobile-category-item .category-name {
  font-size: 16px;
  font-weight: 500;
  color: #2c3e50;
  flex: 1;
}

.mobile-site-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(23, 42, 60, 0.06);
  color: #6f7a84;
  font-size: 12px;
  font-weight: 700;
}

.mobile-category-item.active {
  background: rgba(188, 141, 70, 0.12);
}

.mobile-category-item.active .category-name {
  color: #172a3c;
  font-weight: 700;
}

.mobile-category-item.active .mobile-site-count {
  background: rgba(188, 141, 70, 0.16);
  color: #8e6326;
}



/* 移动端菜单遮罩 */
.mobile-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
}

.mobile-menu-overlay.active {
  opacity: 1;
  visibility: visible;
}

/* 内容区域样式 */
.content-area {
  flex: 1;
  padding: 30px;
  padding-bottom: 400px;
  overflow-y: auto;
}

.loading, .error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 260px;
  color: #7f8c8d;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #ecf0f1;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.retry-btn {
  margin-top: 10px;
  padding: 8px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.categories-container {
  max-width: 1200px;
  margin: 0 auto;
}

.category-section {
  margin-bottom: 50px;
}

.category-title {
  font-size: 32px;
  font-weight: 600;
  margin-bottom: 25px;
  color: #2c3e50;
  display: flex;
  align-items: center;
}

.category-title .category-icon {
  font-size: 32px;
  margin-right: 16px;
}

.category-title .category-name {
  margin-left: 10px;
  font-size: 26px;
}

.sites-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.site-card {
  display: flex;
  align-items: center;
  background: white;
  border-radius: 12px;
  padding: 20px;
  text-decoration: none;
  color: inherit;
  transition: all 0.3s ease;
  border: 1px solid #e9ecef;
  position: relative;
  overflow: hidden;
}

.site-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(155, 89, 182, 0.1));
  opacity: 0;
  transition: opacity 0.3s ease;
}

.site-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.site-card:hover::before {
  opacity: 1;
}

.site-icon {
  width: 48px;
  height: 48px;
  margin-right: 16px;
  border-radius: 8px;
  overflow: hidden;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.site-icon img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.site-info {
  flex: 1;
  position: relative;
  z-index: 1;
}

.site-name {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 5px 0;
  color: #2c3e50;
}

.site-description {
  font-size: 14px;
  color: #7f8c8d;
  margin: 0;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 页面底部 */
.page-footer {
  margin-top: 60px;
  padding: 40px 0;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
  border-top: 3px solid #3498db;
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
  gap: 30px;
}

.footer-info h3 {
  color: #2c3e50;
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.footer-info p {
  color: #7f8c8d;
  font-size: 14px;
  margin: 0;
  line-height: 1.5;
}

.footer-links {
  display: flex;
  gap: 15px;
}

.footer-link {
  display: flex;
  align-items: center;
  color: #3498db;
  text-decoration: none;
  padding: 8px 16px;
  border-radius: 20px;
  background: white;
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
  font-size: 14px;
  font-weight: 500;
}

.footer-link:hover {
  background: #3498db;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

.footer-link svg {
  margin-right: 6px;
  transition: transform 0.3s ease;
}

.footer-link:hover svg {
  transform: scale(1.1);
}

.footer-bottom {
  border-top: 1px solid #e9ecef;
  padding-top: 20px;
  text-align: center;
}

.footer-bottom p {
  color: #7f8c8d;
  font-size: 13px;
  margin: 5px 0;
  line-height: 1.4;
}

.footer-bottom a {
  color: #3498db;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s ease;
}

.footer-bottom a:hover {
  color: #2980b9;
  text-decoration: underline;
}

.footer-tech {
  font-size: 12px !important;
  opacity: 0.8;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .nav-home {
    flex-direction: column;
    height: 100vh;
    height: 100svh; /* 使用动态视口高度 */
    overflow: hidden;
  }

  .sidebar {
    display: none; /* 在移动端隐藏左侧边栏 */
  }

  .main-content {
    flex: 1;
    height: 100vh;
    height: 100svh; /* 使用动态视口高度，更准确 */
    margin-left: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .search-header {
    padding: 15px 20px;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 500;
    background: white;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }

  .content-area {
    flex: 1;
    padding: 20px 15px;
    padding-top: 100px; /* 为固定的搜索框留出空间 */
    padding-bottom: 300px; /* 增加底部padding确保内容可以完全滚动 */
    overflow-y: auto;
    -webkit-overflow-scrolling: touch; /* iOS平滑滚动 */
  }

  .mobile-menu-btn {
    display: block; /* 在移动端显示菜单按钮 */
    flex-shrink: 0;
  }

  .sites-grid {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .site-card {
    padding: 12px;
    flex-direction: column;
    text-align: center;
  }

  .site-card .site-icon {
    margin-right: 0;
    margin-bottom: 8px;
  }

  .site-card .site-name {
    font-size: 15px;
  }

  .site-card .site-description {
    font-size: 12px;
  }

  .category-title {
    font-size: 24px;
    margin-bottom: 20px;
  }

  .category-title .category-icon {
    font-size: 28px;
    margin-right: 12px;
  }

  .category-title .category-name {
    font-size: 22px;
  }

  /* 移动端页面底部 */
  .page-footer {
    margin-top: 40px;
    padding: 30px 20px;
  }

  .footer-content {
    flex-direction: column;
    gap: 20px;
    text-align: center;
  }

  .footer-links {
    justify-content: center;
  }

  .footer-bottom {
    padding-top: 15px;
  }

  .footer-bottom p {
    font-size: 12px;
  }
}

/* 主题切换按钮样式 */
.theme-toggle-btn {
  background: none;
  border: none;
  color: #2c3e50;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
}

.theme-toggle-btn:hover {
  background: #f8f9fa;
  transform: scale(1.1);
}

/* 暗色模式样式 */
.dark .nav-home {
  background-color: #1a1a1a;
}

.dark .sidebar {
  background-color: #1e293b;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.3);
}

.dark .search-header {
  background: #1e293b;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.dark .theme-toggle-btn {
  color: #e2e8f0;
}

.dark .theme-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.dark .mobile-menu-btn {
  color: #e2e8f0;
}

.dark .mobile-menu-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.dark .search-container {
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.dark .search-engine-selector {
  background: #374151;
  border-right: 1px solid #4b5563;
}

.dark .search-engine-selector:hover {
  background: #4b5563;
}

.dark .search-input {
  background: #374151;
  color: #e2e8f0;
  border: none;
}

.dark .search-input::placeholder {
  color: #9ca3af;
}

.dark .engine-select {
  background: #374151;
  color: #e2e8f0;
}

.dark .engine-select option {
  background: #374151;
  color: #e2e8f0;
}

.dark .content-area {
  background: #1a1a1a;
}

.dark .site-card {
  background: #374151;
  border: 1px solid #4b5563;
  color: #e2e8f0;
}

.dark .site-card:hover {
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
}

.dark .site-card::before {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15));
}

.dark .site-name {
  color: #e2e8f0;
}

.dark .site-description {
  color: #9ca3af;
}

.dark .site-icon {
  background: #4b5563;
}

.dark .category-title {
  color: #e2e8f0;
}

.dark .mobile-menu {
  background: #1e293b;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.3);
}

.dark .mobile-category-item {
  border-bottom: 1px solid #374151;
}

.dark .mobile-category-item:hover {
  background: #374151;
}

.dark .mobile-category-item .category-name {
  color: #e2e8f0;
}

.dark .page-footer {
  background: linear-gradient(135deg, #1e293b 0%, #374151 100%);
  border-top: 3px solid #3b82f6;
}

.dark .footer-info h3 {
  color: #e2e8f0;
}

.dark .footer-info p {
  color: #9ca3af;
}

.dark .footer-link {
  background: #374151;
  border: 1px solid #4b5563;
  color: #3b82f6;
}

.dark .footer-link:hover {
  background: #3b82f6;
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.dark .footer-bottom p {
  color: #9ca3af;
}

.dark .footer-bottom a {
  color: #3b82f6;
}

.dark .footer-bottom a:hover {
  color: #60a5fa;
}

.dark .loading,
.dark .error {
  color: #9ca3af;
}

.dark .retry-btn {
  background: #3b82f6;
  color: white;
}

.dark .retry-btn:hover {
  background: #2563eb;
}

/* 锁定界面暗色模式 */
.dark .lock-container {
  background: #0f172a;
}

.dark .lock-box {
  background: #1e293b;
  color: #e2e8f0;
}

.dark .lock-box h1 {
  color: #e2e8f0;
}

.dark .lock-description {
  color: #94a3b8;
}

.dark .lock-box .form-group label {
  color: #cbd5e1;
}

.dark .lock-box .form-input {
  background: #374151;
  border: 2px solid #4b5563;
  color: #e2e8f0;
}

.dark .lock-box .form-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.dark .unlock-btn {
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
}

.dark .unlock-btn:hover:not(:disabled) {
  box-shadow: 0 10px 30px rgba(59, 130, 246, 0.4);
}

/* 宝拓导航品牌视觉 */
.nav-home {
  --nav-surface: #f4f0e8;
  --nav-surface-strong: #fffdf8;
  --nav-border: rgba(20, 38, 54, 0.08);
  --nav-border-strong: rgba(188, 141, 70, 0.24);
  --nav-shadow: 0 18px 38px rgba(20, 38, 54, 0.08);
  --nav-text: #172a3c;
  --nav-text-soft: #6e7b87;
  --nav-accent: #bc8d46;
  --nav-accent-soft: rgba(188, 141, 70, 0.14);
  --sidebar-start: #152737;
  --sidebar-end: #0b1823;
  background:
    radial-gradient(circle at top left, rgba(188, 141, 70, 0.09), transparent 24%),
    radial-gradient(circle at 86% 12%, rgba(41, 70, 94, 0.08), transparent 26%),
    linear-gradient(180deg, #f6f2ea 0%, #f2ede4 100%);
}

.sidebar {
  width: 296px;
  background: linear-gradient(180deg, var(--sidebar-start) 0%, var(--sidebar-end) 100%);
  box-shadow: 24px 0 60px rgba(8, 20, 32, 0.18);
}

.logo-section {
  margin: 18px 18px 12px;
  padding: 22px 18px;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: none;
  border-radius: 24px;
  background:
    radial-gradient(circle at top right, rgba(188, 141, 70, 0.24), transparent 34%),
    linear-gradient(160deg, #213748 0%, #162a3b 58%, #0e1b28 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 20px 40px rgba(3, 10, 18, 0.22);
}

.logo {
  width: 60px;
  height: 60px;
  margin-right: 14px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 14px 24px rgba(0, 0, 0, 0.18);
}

.logo-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.brand-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-kicker {
  display: inline-flex;
  width: fit-content;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(188, 141, 70, 0.28);
  background: rgba(188, 141, 70, 0.16);
  color: #f0d4a1;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.site-title {
  color: #ffffff;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.02;
  letter-spacing: 0.02em;
}

.site-subtitle {
  max-width: 188px;
  margin: 0;
  color: rgba(226, 235, 245, 0.54);
  font-size: 11px;
  line-height: 1.2;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.sidebar-focus {
  margin: 0 18px 14px;
  padding: 16px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.focus-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.focus-label {
  color: rgba(228, 235, 240, 0.56);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.focus-index {
  color: #f0d4a1;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.focus-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.focus-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: rgba(188, 141, 70, 0.12);
  font-size: 18px;
}

.focus-copy {
  min-width: 0;
}

.focus-name {
  margin: 0;
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.2;
}

.focus-meta {
  margin: 3px 0 0;
  color: rgba(228, 235, 240, 0.58);
  font-size: 12px;
}

.focus-progress {
  margin-top: 14px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.focus-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #d6b06e, #bc8d46);
  box-shadow: 0 0 18px rgba(188, 141, 70, 0.34);
  transition: width 0.28s ease;
}

.category-nav {
  padding: 8px 12px 18px;
}

.nav-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 2;
  margin: 0 6px 14px;
  padding: 10px 8px 12px;
  backdrop-filter: blur(12px);
  background: linear-gradient(180deg, rgba(17, 32, 46, 0.92), rgba(17, 32, 46, 0.72) 74%, rgba(17, 32, 46, 0));
}

.nav-title {
  margin: 0;
  color: rgba(226, 232, 238, 0.86);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.nav-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(228, 236, 241, 0.68);
  font-size: 12px;
  font-weight: 700;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.category-list-shell {
  position: relative;
  padding-left: 22px;
}

.category-list-rail {
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 11px;
  width: 1px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.22) 12%, rgba(255, 255, 255, 0.08) 88%, rgba(255, 255, 255, 0));
}

.category-item {
  position: relative;
  margin: 3px 6px;
  padding: 0;
  border-radius: 14px;
}

.category-item::before {
  content: '';
  position: absolute;
  top: 50%;
  left: -11px;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  box-shadow: 0 0 0 6px rgba(12, 25, 37, 0.92);
  transform: translateY(-50%);
  transition: all 0.28s ease;
}

.category-action {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  width: 100%;
  padding: 14px;
  font: inherit;
  border: 1px solid transparent;
  border-radius: 16px;
  background: transparent;
  color: rgba(237, 242, 246, 0.9);
  cursor: pointer;
  text-align: left;
  appearance: none;
  transition: all 0.26s ease;
}

.category-action::after {
  content: '';
  position: absolute;
  inset: 1px;
  border-radius: 15px;
  background: radial-gradient(circle at left center, rgba(188, 141, 70, 0.16), rgba(188, 141, 70, 0) 48%);
  opacity: 0;
  transition: opacity 0.28s ease;
  pointer-events: none;
}

.category-action > * {
  position: relative;
  z-index: 1;
}

.nav-ornament {
  width: 4px;
  height: 24px;
  margin-right: 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  transition: all 0.26s ease;
}

.category-item:hover .category-action {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.05);
  transform: translateX(2px);
}

.category-item:hover::before {
  background: rgba(188, 141, 70, 0.52);
}

.category-item:hover .nav-ornament {
  background: rgba(188, 141, 70, 0.48);
}

.category-name {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
  flex: 1;
}

.site-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  margin-left: 10px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(226, 233, 238, 0.72);
  font-size: 12px;
  font-weight: 700;
  transition: all 0.26s ease;
}

.category-item.is-active .category-action {
  border-color: rgba(188, 141, 70, 0.18);
  background: linear-gradient(90deg, rgba(188, 141, 70, 0.18), rgba(255, 255, 255, 0.03));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 12px 24px rgba(5, 13, 21, 0.16);
  transform: translateX(4px);
}

.category-item.is-active::before {
  width: 10px;
  height: 26px;
  border-radius: 999px;
  background: linear-gradient(180deg, #d9b06c, #bc8d46);
  box-shadow: 0 0 18px rgba(188, 141, 70, 0.28), 0 0 0 6px rgba(12, 25, 37, 0.92);
}

.category-item.is-active .category-action::after {
  opacity: 1;
}

.category-item.is-active .nav-ornament {
  height: 30px;
  background: linear-gradient(180deg, #d9b06c, #bc8d46);
  box-shadow: 0 0 18px rgba(188, 141, 70, 0.28);
}

.category-item.is-active .category-name {
  color: #ffffff;
}

.category-item.is-active .site-count {
  background: rgba(188, 141, 70, 0.16);
  color: #f7ddaf;
}

.category-action:focus-visible {
  outline: none;
  border-color: rgba(188, 141, 70, 0.34);
  box-shadow: 0 0 0 3px rgba(188, 141, 70, 0.14);
}

.sidebar-footer {
  padding: 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, rgba(10, 22, 34, 0) 0%, rgba(8, 19, 30, 0.58) 100%);
}

.github-link {
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  color: #edf3f8;
}

.github-link-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 12px;
  background: rgba(188, 141, 70, 0.12);
  color: #f0d4a1;
  transition: all 0.3s ease;
}

.github-link-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.github-link-label {
  color: rgba(226, 233, 238, 0.58);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.github-link-copy {
  color: rgba(244, 247, 250, 0.88);
  font-size: 14px;
  line-height: 1.35;
}

.github-link:hover {
  background: rgba(188, 141, 70, 0.16);
  border-color: rgba(188, 141, 70, 0.22);
  color: #ffffff;
  transform: translateY(-2px);
}

.github-link:hover .github-link-icon {
  background: rgba(255, 255, 255, 0.1);
  color: #ffe0ae;
}

.search-header {
  display: block;
  position: sticky;
  top: 0;
  padding: 16px 24px 12px;
  background: rgba(247, 243, 236, 0.82);
  border-bottom: 1px solid var(--nav-border);
  box-shadow: 0 10px 28px rgba(17, 33, 48, 0.06);
  backdrop-filter: blur(16px);
}

.search-header-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.search-brand-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.search-brand-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.search-brand-kicker {
  display: inline-flex;
  width: fit-content;
  min-height: 24px;
  align-items: center;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(188, 141, 70, 0.16);
  background: linear-gradient(180deg, rgba(255, 249, 239, 0.94), rgba(249, 239, 220, 0.82));
  color: #8f6529;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.search-brand-main {
  min-width: 0;
}

.search-brand-title {
  margin: 0;
  color: var(--nav-text);
  font-size: 24px;
  font-weight: 800;
  line-height: 1.02;
  letter-spacing: -0.02em;
}

.search-brand-copy {
  margin: 6px 0 0;
  max-width: 440px;
  color: rgba(70, 84, 96, 0.8);
  font-size: 13px;
  line-height: 1.45;
}

.search-hero-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  min-width: 300px;
}

.search-hero-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 68px;
  padding: 10px 14px;
  border-radius: 16px;
  border: 1px solid rgba(20, 38, 54, 0.08);
  background: rgba(255, 252, 246, 0.78);
  box-shadow: 0 14px 28px rgba(19, 35, 49, 0.05);
}

.search-hero-card-accent {
  border-color: rgba(188, 141, 70, 0.18);
  background: linear-gradient(180deg, rgba(255, 249, 239, 0.96), rgba(247, 237, 218, 0.84));
}

.search-hero-value {
  color: var(--nav-text);
  font-size: 16px;
  font-weight: 800;
  line-height: 1.1;
}

.search-hero-card-accent .search-hero-value {
  color: #8f6529;
}

.search-hero-label {
  margin-top: 6px;
  color: rgba(70, 84, 96, 0.7);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.header-meta-pills {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex-wrap: wrap;
}

.search-header-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.header-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(20, 38, 54, 0.08);
  background: rgba(255, 252, 246, 0.74);
  color: var(--nav-text);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.header-pill-primary {
  border-color: rgba(188, 141, 70, 0.16);
  background: linear-gradient(180deg, rgba(255, 249, 239, 0.96), rgba(249, 239, 220, 0.88));
  color: #8f6529;
  box-shadow: 0 10px 22px rgba(188, 141, 70, 0.12);
}

.header-pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(180deg, #d4b075, #bc8d46);
  box-shadow: 0 0 0 4px rgba(188, 141, 70, 0.14);
}

.header-pill-engine {
  color: #8f6529;
  font-weight: 800;
}

.header-meta-copy {
  color: rgba(70, 84, 96, 0.8);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.search-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-container {
  flex: 1;
  min-width: 0;
  margin: 0;
  max-width: 780px;
  border: 1px solid rgba(20, 38, 54, 0.1);
  border-radius: 22px;
  background: rgba(255, 252, 246, 0.92);
  box-shadow: 0 16px 34px rgba(19, 35, 49, 0.07);
}

.search-engine-selector {
  background: linear-gradient(180deg, #f6f0e6, #efe7d9);
  border-right: 1px solid rgba(20, 38, 54, 0.08);
}

.search-engine-selector:hover {
  background: linear-gradient(180deg, #f2eadc, #e9ddc8);
}

.engine-logo {
  width: 22px;
  height: 22px;
  margin: 9px 12px;
}

.search-input {
  padding: 13px 16px;
  background: transparent;
  color: var(--nav-text);
}

.search-input::placeholder {
  color: #8b97a2;
}

.search-submit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 16px;
  border: none;
  background: linear-gradient(135deg, #173145 0%, #102334 100%);
  color: #f4f7fa;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.24s ease, background 0.24s ease, box-shadow 0.24s ease;
}

.search-submit-btn:hover {
  transform: translateX(1px);
  background: linear-gradient(135deg, #214158 0%, #173245 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-left: auto;
  flex-shrink: 0;
}

.header-stats-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 16px;
  border: 1px solid rgba(20, 38, 54, 0.08);
  background: rgba(255, 252, 246, 0.84);
  box-shadow: 0 10px 22px rgba(19, 35, 49, 0.05);
}

.header-stats-value {
  color: var(--nav-text);
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
}

.header-stats-label {
  color: rgba(70, 84, 96, 0.72);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.theme-toggle-btn,
.mobile-menu-btn {
  width: 42px;
  height: 42px;
  margin-right: 0;
  border-radius: 12px;
  border: 1px solid var(--nav-border);
  background: rgba(255, 252, 246, 0.92);
  box-shadow: 0 10px 22px rgba(19, 35, 49, 0.06);
  color: var(--nav-text);
}

.theme-toggle-btn:hover,
.mobile-menu-btn:hover {
  background: rgba(188, 141, 70, 0.14);
  border-color: rgba(188, 141, 70, 0.16);
  transform: translateY(-2px);
}

.content-area {
  padding: 18px 24px 320px;
  background:
    radial-gradient(circle at top left, rgba(188, 141, 70, 0.08), transparent 20%),
    linear-gradient(180deg, rgba(251, 248, 242, 0.92) 0%, rgba(242, 237, 228, 0.98) 100%);
}

.content-shell {
  max-width: 1240px;
  margin: 0 auto;
}

.categories-container {
  max-width: none;
}

.category-section {
  --section-accent: #bc8d46;
  --section-accent-rgb: 188, 141, 70;
  --section-panel-top: rgba(255, 251, 243, 0.94);
  --section-panel-bottom: rgba(246, 237, 222, 0.68);
  --section-panel-border: rgba(188, 141, 70, 0.16);
  --section-panel-glow: rgba(188, 141, 70, 0.16);
  position: relative;
  margin-bottom: 36px;
  scroll-margin-top: 112px;
  animation: sectionFadeIn 0.48s ease both;
}

.category-section-shell {
  position: relative;
  overflow: hidden;
  padding: 26px 24px 28px;
  border: 1px solid var(--section-panel-border);
  border-radius: 34px;
  background: linear-gradient(180deg, var(--section-panel-top) 0%, var(--section-panel-bottom) 100%);
  box-shadow:
    0 24px 44px rgba(20, 38, 54, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.54);
}

.category-section-backdrop {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.category-backdrop-blur {
  position: absolute;
  top: -110px;
  right: -30px;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--section-panel-glow), rgba(var(--section-accent-rgb), 0) 72%);
}

.category-backdrop-grid {
  position: absolute;
  right: 24px;
  bottom: 22px;
  width: 168px;
  height: 110px;
  border-radius: 28px;
  opacity: 0.34;
  background-image:
    linear-gradient(rgba(var(--section-accent-rgb), 0.12) 1px, transparent 1px),
    linear-gradient(90deg, rgba(var(--section-accent-rgb), 0.12) 1px, transparent 1px);
  background-size: 14px 14px;
  mask-image: linear-gradient(135deg, transparent 0%, rgba(0, 0, 0, 0.92) 42%);
}

.category-heading {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 26px;
  padding-bottom: 18px;
  border-bottom: 1px solid rgba(var(--section-accent-rgb), 0.1);
}

.category-heading-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 112px;
  padding-bottom: 6px;
}

.category-index {
  color: rgba(var(--section-accent-rgb), 0.82);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.18em;
}

.category-divider {
  display: block;
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, rgba(var(--section-accent-rgb), 0.42), rgba(20, 38, 54, 0));
}

.category-heading-main {
  min-width: 0;
  flex: 1;
}

.category-heading-topline {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.category-eyebrow {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(var(--section-accent-rgb), 0.16);
  background: rgba(var(--section-accent-rgb), 0.08);
  color: rgba(var(--section-accent-rgb), 0.84);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.category-tone-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--section-accent);
  box-shadow: 0 0 0 8px rgba(var(--section-accent-rgb), 0.12);
}

.category-caption {
  margin: 10px 0 0 46px;
  color: var(--nav-text-soft);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.category-heading-side {
  display: flex;
  align-items: center;
  gap: 12px;
}

.category-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 86px;
  min-height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(var(--section-accent-rgb), 0.16);
  background: rgba(var(--section-accent-rgb), 0.08);
  color: rgba(var(--section-accent-rgb), 0.92);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.category-side-mark {
  position: relative;
  width: 42px;
  height: 42px;
  border-radius: 16px;
  flex-shrink: 0;
  border: 1px solid rgba(var(--section-accent-rgb), 0.14);
  background:
    linear-gradient(135deg, rgba(var(--section-accent-rgb), 0.14), rgba(var(--section-accent-rgb), 0.02)),
    rgba(255, 255, 255, 0.26);
}

.category-side-mark::before,
.category-side-mark::after {
  content: '';
  position: absolute;
  inset: 11px;
  border-radius: 11px;
  border: 1px solid rgba(var(--section-accent-rgb), 0.24);
}

.category-side-mark::after {
  inset: 17px;
  border-radius: 999px;
  background: rgba(var(--section-accent-rgb), 0.28);
  border: none;
}

.category-title {
  color: var(--nav-text);
  margin-bottom: 0;
  display: flex;
  align-items: center;
  gap: 14px;
}

.category-title .category-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(var(--section-accent-rgb), 0.14), rgba(255, 255, 255, 0.48));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.62),
    0 12px 22px rgba(var(--section-accent-rgb), 0.12);
  font-size: 28px;
}

.category-title .category-name {
  margin-left: 0;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.category-grid-shell {
  position: relative;
  z-index: 1;
  padding: 4px;
  border-radius: 30px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.34), rgba(var(--section-accent-rgb), 0.05)),
    rgba(255, 255, 255, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.46);
}

.sites-grid {
  gap: 22px;
}

.site-card {
  opacity: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 18px;
  padding: 24px 22px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 253, 248, 0.96) 0%, rgba(251, 248, 242, 0.92) 100%);
  border: 1px solid var(--nav-border);
  box-shadow: var(--nav-shadow);
  animation: cardEnter 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--card-order, 0) * 45ms);
}

.site-card::before {
  background: linear-gradient(135deg, rgba(188, 141, 70, 0.08), rgba(255, 255, 255, 0));
}

.site-card:hover {
  transform: translateY(-4px);
  border-color: var(--nav-border-strong);
  box-shadow: 0 22px 36px rgba(20, 38, 54, 0.12);
}

.site-card-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.site-icon-wrap {
  position: relative;
  flex-shrink: 0;
}

.site-icon-wrap::before {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 22px;
  background: radial-gradient(circle, rgba(188, 141, 70, 0.16), rgba(188, 141, 70, 0) 68%);
}

.site-card:focus-visible {
  outline: none;
  border-color: rgba(188, 141, 70, 0.28);
  box-shadow: 0 0 0 4px rgba(188, 141, 70, 0.14), 0 22px 36px rgba(20, 38, 54, 0.12);
}

.site-icon {
  position: relative;
  width: 62px;
  height: 62px;
  margin-right: 0;
  border-radius: 16px;
  background: linear-gradient(135deg, #f7f0e4, #eef1ee);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.site-info {
  min-width: 0;
}

.site-title-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.site-link-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 12px;
  flex-shrink: 0;
  border: 1px solid rgba(20, 38, 54, 0.08);
  background: rgba(255, 252, 246, 0.7);
  color: #8f6529;
  font-size: 15px;
  font-weight: 800;
  transition: transform 0.24s ease, background 0.24s ease, color 0.24s ease, border-color 0.24s ease;
}

.site-card:hover .site-link-indicator {
  transform: translate(1px, -1px);
  background: rgba(188, 141, 70, 0.14);
  border-color: rgba(188, 141, 70, 0.18);
}

.site-name {
  color: var(--nav-text);
  font-size: 19px;
  font-weight: 700;
  margin: 0;
}

.site-description {
  margin: 8px 0 0;
  color: var(--nav-text-soft);
  font-size: 15px;
  line-height: 1.55;
  white-space: normal;
  overflow: hidden;
  text-overflow: initial;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.site-card-footer {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.site-domain {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(20, 38, 54, 0.08);
  background: rgba(255, 252, 246, 0.74);
  color: rgba(70, 84, 96, 0.72);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.site-open-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(23, 49, 69, 0.08);
  color: var(--nav-text);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: background 0.24s ease, color 0.24s ease, transform 0.24s ease;
}

.site-card:hover .site-open-chip {
  background: var(--nav-text);
  color: #f4f7fa;
  transform: translateX(2px);
}

.loading-spinner {
  border-top-color: var(--nav-accent);
}

.retry-btn {
  border-radius: 999px;
  background: var(--nav-text);
  box-shadow: 0 12px 24px rgba(20, 38, 54, 0.14);
}

@keyframes sectionFadeIn {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes cardEnter {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.mobile-menu {
  background: #fbf7f0;
}

.mobile-menu-header {
  background: linear-gradient(135deg, #182d3f, #112231);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.mobile-category-item:hover {
  background: rgba(188, 141, 70, 0.1);
}

.page-footer {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.82), rgba(247, 241, 228, 0.9));
  border-top: 3px solid var(--nav-accent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.footer-link {
  border: 1px solid var(--nav-border);
  color: var(--nav-text);
}

.footer-link:hover {
  background: var(--nav-text);
  box-shadow: 0 12px 26px rgba(20, 38, 54, 0.2);
}

.footer-bottom a {
  color: #9f6f2f;
}

.category-nav,
.content-area,
.mobile-menu {
  scrollbar-width: thin;
}

.category-nav {
  scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
}

.content-area,
.mobile-menu {
  scrollbar-color: rgba(23, 40, 58, 0.18) transparent;
}

.category-nav::-webkit-scrollbar,
.content-area::-webkit-scrollbar,
.mobile-menu::-webkit-scrollbar {
  width: 10px;
}

.category-nav::-webkit-scrollbar-track,
.content-area::-webkit-scrollbar-track,
.mobile-menu::-webkit-scrollbar-track {
  background: transparent;
}

.category-nav::-webkit-scrollbar-thumb,
.content-area::-webkit-scrollbar-thumb,
.mobile-menu::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background-clip: padding-box;
}

.category-nav::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.18);
}

.content-area::-webkit-scrollbar-thumb,
.mobile-menu::-webkit-scrollbar-thumb {
  background-color: rgba(23, 40, 58, 0.18);
}

.lock-container {
  background:
    radial-gradient(circle at top left, rgba(188, 141, 70, 0.12), transparent 20%),
    linear-gradient(180deg, #162738 0%, #0c1620 100%);
}

.lock-box {
  background: rgba(255, 252, 247, 0.96);
  border: 1px solid rgba(188, 141, 70, 0.16);
  box-shadow: 0 24px 50px rgba(9, 20, 31, 0.24);
}

.lock-box h1 {
  color: var(--nav-text);
}

.lock-description {
  color: var(--nav-text-soft);
}

.lock-box .form-input:focus {
  border-color: var(--nav-accent);
  box-shadow: 0 0 0 4px rgba(188, 141, 70, 0.1);
}

.unlock-btn {
  background: linear-gradient(135deg, #c79a4b 0%, #ac7c32 100%);
  color: #162738;
}

.unlock-btn:hover:not(:disabled) {
  box-shadow: 0 12px 28px rgba(172, 124, 50, 0.28);
}

@media (max-width: 768px) {
  .search-header {
    background: rgba(248, 244, 237, 0.94);
  }

  .search-brand-row {
    flex-direction: column;
    gap: 12px;
  }

  .search-brand-title {
    font-size: 24px;
  }

  .search-brand-copy {
    margin-top: 6px;
    font-size: 13px;
  }

  .search-hero-stats {
    width: 100%;
    min-width: 0;
  }

  .search-hero-card {
    min-height: 72px;
    padding: 12px;
    border-radius: 16px;
  }

  .search-hero-value {
    font-size: 16px;
  }

  .search-header-meta {
    gap: 10px;
    flex-wrap: wrap;
  }

  .header-meta-copy {
    width: 100%;
    order: 2;
  }

  .search-toolbar {
    gap: 10px;
  }

  .search-submit-btn {
    padding: 0 12px;
  }

  .search-submit-btn span {
    display: none;
  }

  .header-actions {
    gap: 10px;
  }

  .content-area {
    padding-top: 16px;
    padding-left: 16px;
    padding-right: 16px;
    padding-bottom: 260px;
  }

  .category-section {
    margin-bottom: 28px;
    scroll-margin-top: 48px;
  }

  .category-heading {
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 18px;
    padding-bottom: 12px;
  }

  .category-heading-meta {
    min-width: auto;
    width: 100%;
    padding-bottom: 0;
  }

  .category-caption {
    margin-left: 42px;
  }

  .category-section-shell {
    padding: 18px 16px 20px;
    border-radius: 26px;
  }

  .category-backdrop-grid {
    width: 112px;
    height: 76px;
    right: 14px;
    bottom: 16px;
  }

  .category-heading-topline {
    margin-bottom: 10px;
  }

  .category-heading-side {
    width: 100%;
    justify-content: space-between;
  }

  .category-side-mark {
    display: none;
  }

  .category-title {
    gap: 12px;
  }

  .category-title .category-icon {
    width: 46px;
    height: 46px;
    border-radius: 16px;
    font-size: 24px;
  }

  .category-title .category-name {
    font-size: 24px;
  }

  .category-grid-shell {
    padding: 0;
    border-radius: 24px;
    background: transparent;
    box-shadow: none;
  }

  .site-card {
    gap: 14px;
    padding: 18px 16px;
    border-radius: 20px;
    text-align: left;
  }

  .site-card-header {
    width: 100%;
    align-items: flex-start;
    gap: 12px;
  }

  .site-icon-wrap::before {
    inset: -6px;
  }

  .site-card .site-icon {
    width: 52px;
    height: 52px;
    margin-bottom: 0;
  }

  .site-title-row {
    gap: 8px;
  }

  .site-link-indicator {
    width: 28px;
    height: 28px;
    font-size: 13px;
  }

  .site-card .site-name {
    font-size: 17px;
  }

  .site-card .site-description {
    margin-top: 6px;
    font-size: 13px;
  }

  .site-card-footer {
    width: 100%;
  }

  .site-domain {
    max-width: calc(100% - 74px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .site-open-chip {
    min-height: 30px;
    padding: 0 10px;
  }

  .theme-toggle-btn {
    margin-right: 0;
  }
}

.dark .nav-home {
  background:
    radial-gradient(circle at top left, rgba(188, 141, 70, 0.1), transparent 24%),
    linear-gradient(180deg, #0c1319 0%, #101922 100%);
}

.dark .sidebar {
  background: linear-gradient(180deg, #0d1822 0%, #081118 100%);
  box-shadow: 24px 0 60px rgba(0, 0, 0, 0.34);
}

.dark .logo-section {
  border-color: rgba(255, 255, 255, 0.07);
  background:
    radial-gradient(circle at top right, rgba(188, 141, 70, 0.18), transparent 34%),
    linear-gradient(160deg, #1b3041 0%, #122434 58%, #0c1824 100%);
}

.dark .search-header {
  background: rgba(11, 18, 25, 0.84);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.dark .header-pill {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(237, 243, 248, 0.88);
}

.dark .search-brand-kicker {
  border-color: rgba(188, 141, 70, 0.22);
  background: linear-gradient(180deg, rgba(188, 141, 70, 0.2), rgba(188, 141, 70, 0.12));
  color: #f0d4a1;
}

.dark .search-brand-title {
  color: #edf3f8;
}

.dark .search-brand-copy {
  color: rgba(222, 230, 236, 0.64);
}

.dark .search-hero-card {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  box-shadow: none;
}

.dark .search-hero-card-accent {
  border-color: rgba(188, 141, 70, 0.24);
  background: linear-gradient(180deg, rgba(188, 141, 70, 0.18), rgba(188, 141, 70, 0.08));
}

.dark .search-hero-value {
  color: #edf3f8;
}

.dark .search-hero-card-accent .search-hero-value {
  color: #f0d4a1;
}

.dark .search-hero-label {
  color: rgba(222, 230, 236, 0.58);
}

.dark .header-pill-primary {
  border-color: rgba(188, 141, 70, 0.24);
  background: linear-gradient(180deg, rgba(188, 141, 70, 0.18), rgba(188, 141, 70, 0.1));
  color: #f0d4a1;
}

.dark .header-pill-dot {
  box-shadow: 0 0 0 4px rgba(188, 141, 70, 0.12);
}

.dark .header-pill-engine {
  color: #f0d4a1;
}

.dark .header-meta-copy {
  color: rgba(222, 230, 236, 0.56);
}

.dark .sidebar-focus {
  border-color: rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
}

.dark .focus-label {
  color: rgba(228, 235, 240, 0.5);
}

.dark .focus-meta {
  color: rgba(228, 235, 240, 0.56);
}

.dark .nav-title-row {
  background: linear-gradient(180deg, rgba(11, 20, 29, 0.94), rgba(11, 20, 29, 0.76) 74%, rgba(11, 20, 29, 0));
}

.dark .category-list-rail {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.16) 12%, rgba(255, 255, 255, 0.06) 88%, rgba(255, 255, 255, 0));
}

.dark .category-item::before {
  background: rgba(255, 255, 255, 0.14);
  box-shadow: 0 0 0 6px rgba(9, 17, 24, 0.92);
}

.dark .category-item.is-active::before {
  background: linear-gradient(180deg, #d9b06c, #bc8d46);
  box-shadow: 0 0 18px rgba(188, 141, 70, 0.28), 0 0 0 6px rgba(9, 17, 24, 0.92);
}

.dark .category-action::after {
  background: radial-gradient(circle at left center, rgba(188, 141, 70, 0.18), rgba(188, 141, 70, 0) 48%);
}

.dark .search-container {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(20, 30, 39, 0.88);
  box-shadow: 0 18px 30px rgba(0, 0, 0, 0.24);
}

.dark .search-engine-selector {
  background: linear-gradient(180deg, #1a2834, #13202b);
  border-right: 1px solid rgba(255, 255, 255, 0.07);
}

.dark .search-engine-selector:hover {
  background: linear-gradient(180deg, #21313f, #182734);
}

.dark .search-input {
  color: #edf3f8;
}

.dark .search-input::placeholder {
  color: rgba(222, 230, 236, 0.54);
}

.dark .search-submit-btn {
  background: linear-gradient(135deg, #c79a4b 0%, #9f6f2f 100%);
  color: #112231;
}

.dark .search-submit-btn:hover {
  background: linear-gradient(135deg, #d3ab63 0%, #b17b32 100%);
}

.dark .header-stats-chip {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  box-shadow: none;
}

.dark .header-stats-value {
  color: #edf3f8;
}

.dark .header-stats-label {
  color: rgba(222, 230, 236, 0.58);
}

.dark .theme-toggle-btn,
.dark .mobile-menu-btn {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  box-shadow: none;
  color: #e7edf2;
}

.dark .theme-toggle-btn:hover,
.dark .mobile-menu-btn:hover {
  background: rgba(188, 141, 70, 0.16);
  border-color: rgba(188, 141, 70, 0.2);
}

.dark .content-area {
  background:
    radial-gradient(circle at top left, rgba(188, 141, 70, 0.1), transparent 24%),
    linear-gradient(180deg, #0d141b 0%, #111a22 100%);
}

.dark .content-area,
.dark .mobile-menu {
  scrollbar-color: rgba(255, 255, 255, 0.14) transparent;
}

.dark .category-section-shell {
  border-color: rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(17, 26, 35, 0.96) 0%, rgba(12, 20, 29, 0.92) 100%);
  box-shadow:
    0 24px 44px rgba(0, 0, 0, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.dark .category-backdrop-blur {
  background: radial-gradient(circle, rgba(var(--section-accent-rgb), 0.18), rgba(var(--section-accent-rgb), 0) 72%);
}

.dark .category-backdrop-grid {
  opacity: 0.2;
}

.dark .category-index {
  color: rgba(var(--section-accent-rgb), 0.92);
}

.dark .category-divider {
  background: linear-gradient(90deg, rgba(var(--section-accent-rgb), 0.42), rgba(255, 255, 255, 0));
}

.dark .category-title,
.dark .site-name {
  color: #edf3f8;
}

.dark .category-eyebrow {
  border-color: rgba(var(--section-accent-rgb), 0.22);
  background: rgba(var(--section-accent-rgb), 0.14);
  color: rgba(242, 247, 250, 0.82);
}

.dark .category-tone-dot {
  box-shadow: 0 0 0 8px rgba(var(--section-accent-rgb), 0.12);
}

.dark .category-caption {
  color: rgba(217, 224, 230, 0.64);
}

.dark .category-side-mark {
  border-color: rgba(var(--section-accent-rgb), 0.18);
  background:
    linear-gradient(135deg, rgba(var(--section-accent-rgb), 0.18), rgba(var(--section-accent-rgb), 0.04)),
    rgba(255, 255, 255, 0.02);
}

.dark .category-side-mark::before {
  border-color: rgba(var(--section-accent-rgb), 0.28);
}

.dark .category-title .category-icon {
  background: linear-gradient(135deg, rgba(var(--section-accent-rgb), 0.18), rgba(255, 255, 255, 0.03));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    0 12px 24px rgba(0, 0, 0, 0.24);
}

.dark .category-grid-shell {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(var(--section-accent-rgb), 0.06)),
    rgba(255, 255, 255, 0.02);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.dark .category-badge {
  border-color: rgba(var(--section-accent-rgb), 0.22);
  background: rgba(var(--section-accent-rgb), 0.14);
  color: rgba(242, 247, 250, 0.84);
}

.dark .site-card {
  background: linear-gradient(180deg, rgba(21, 30, 39, 0.96) 0%, rgba(16, 25, 34, 0.94) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 18px 32px rgba(0, 0, 0, 0.26);
}

.dark .site-card::before {
  background: linear-gradient(135deg, rgba(188, 141, 70, 0.14), rgba(255, 255, 255, 0));
}

.dark .site-card:hover {
  border-color: rgba(188, 141, 70, 0.28);
  box-shadow: 0 24px 40px rgba(0, 0, 0, 0.34);
}

.dark .site-icon {
  background: linear-gradient(135deg, #1f3040, #162433);
}

.dark .site-icon-wrap::before {
  background: radial-gradient(circle, rgba(188, 141, 70, 0.18), rgba(188, 141, 70, 0) 68%);
}

.dark .site-link-indicator {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: #f0d4a1;
}

.dark .site-card:hover .site-link-indicator {
  background: rgba(188, 141, 70, 0.16);
  border-color: rgba(188, 141, 70, 0.22);
}

.dark .site-description {
  color: rgba(217, 224, 230, 0.7);
}

.dark .site-domain {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(217, 224, 230, 0.72);
}

.dark .site-open-chip {
  background: rgba(188, 141, 70, 0.14);
  color: #f0d4a1;
}

.dark .site-card:hover .site-open-chip {
  background: #c79a4b;
  color: #132433;
}

.dark .github-link {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
}

.dark .github-link-label {
  color: rgba(226, 233, 238, 0.54);
}

.dark .github-link-copy {
  color: rgba(244, 247, 250, 0.84);
}

.dark .github-link:hover {
  background: rgba(188, 141, 70, 0.16);
}

.dark .nav-count {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
  color: rgba(226, 233, 238, 0.62);
}

.dark .category-action {
  color: rgba(232, 238, 243, 0.84);
}

.dark .nav-ornament {
  background: rgba(255, 255, 255, 0.08);
}

.dark .category-item:hover .category-action {
  background: rgba(255, 255, 255, 0.04);
}

.dark .category-item.is-active .category-action {
  background: linear-gradient(90deg, rgba(188, 141, 70, 0.18), rgba(255, 255, 255, 0.03));
  border-color: rgba(188, 141, 70, 0.18);
}

.dark .site-count {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(226, 233, 238, 0.72);
}

.dark .category-item.is-active .site-count {
  background: rgba(188, 141, 70, 0.16);
  color: #f0d4a1;
}

.dark .mobile-menu {
  background: #101a23;
}

.dark .mobile-menu-header {
  background: linear-gradient(135deg, #182b3c, #112131);
}

.dark .mobile-category-item:hover {
  background: rgba(188, 141, 70, 0.1);
}

.dark .mobile-site-count {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(222, 230, 236, 0.66);
}

.dark .mobile-category-item.active .category-name {
  color: #f2f6f9;
}

.dark .mobile-category-item.active .mobile-site-count {
  background: rgba(188, 141, 70, 0.16);
  color: #f0d4a1;
}

.dark .page-footer {
  background: linear-gradient(135deg, rgba(17, 30, 41, 0.96), rgba(12, 22, 31, 0.98));
  border-top-color: var(--nav-accent);
}

.dark .footer-link {
  color: #f0d4a1;
}

.dark .footer-link:hover {
  background: var(--nav-accent);
  color: #162738;
}

.dark .footer-bottom a {
  color: #f0d4a1;
}

.dark .retry-btn {
  background: #c79a4b;
  color: #162738;
}

.dark .lock-container {
  background:
    radial-gradient(circle at top left, rgba(188, 141, 70, 0.1), transparent 24%),
    linear-gradient(180deg, #0d161e 0%, #091118 100%);
}

.dark .lock-box {
  background: rgba(20, 31, 42, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.dark .unlock-btn {
  background: linear-gradient(135deg, #c79a4b 0%, #9f6f2f 100%);
  color: #132433;
}

@media (prefers-reduced-motion: reduce) {
  .category-section,
  .site-card {
    animation: none;
  }

  .site-card,
  .site-card:hover,
  .search-submit-btn,
  .theme-toggle-btn,
  .mobile-menu-btn,
  .category-action,
  .site-link-indicator,
  .site-open-chip,
  .category-item::before,
  .github-link,
  .focus-progress span {
    transition: none;
  }

  .site-card {
    opacity: 1;
  }
}
</style>
