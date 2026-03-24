<template>
  <div class="admin-dashboard">
    <header class="admin-header">
      <div class="header-content">
        <div class="header-brand">
          <span class="brand-chip">BTNAV Console</span>
          <div class="header-copy">
            <h1>宝拓导航后台</h1>
            <p>统一管理导航结构、站点入口与服务端配置</p>
          </div>
        </div>
        <div class="header-actions">
          <span class="user-info">
            <span class="session-dot"></span>
            管理员会话已验证
          </span>
          <button @click="logout" class="logout-btn">退出</button>
        </div>
      </div>
    </header>

    <main class="admin-main">
      <section class="admin-overview">
        <div class="overview-copy">
          <span class="overview-kicker">{{ currentTabMeta.kicker }}</span>
          <h2>{{ currentTabMeta.title }}</h2>
          <p>{{ currentTabMeta.description }}</p>
        </div>
        <div class="overview-stats">
          <article class="overview-stat">
            <span class="overview-stat-value">{{ categories.length }}</span>
            <span class="overview-stat-label">分类总数</span>
          </article>
          <article class="overview-stat">
            <span class="overview-stat-value">{{ totalSiteCount }}</span>
            <span class="overview-stat-label">站点入口</span>
          </article>
          <article class="overview-stat">
            <span class="overview-stat-value">{{ serverConfig.githubConfigured ? 'ON' : 'OFF' }}</span>
            <span class="overview-stat-label">GitHub Sync</span>
          </article>
        </div>
      </section>

      <div v-if="loading" class="loading-overlay">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <p>正在加载数据...</p>
          <button @click="skipLoading" class="skip-loading-btn">跳过加载</button>
        </div>
      </div>

      <div class="admin-tabs">
        <button
          v-for="tab in tabOptions"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: activeTab === tab.key }"
          @click="handleTabClick(tab.key)"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-copy">
            <strong>{{ tab.label }}</strong>
            <small>{{ tab.hint }}</small>
          </span>
        </button>
      </div>

      <section class="tab-shell">
        <div v-if="activeTab === 'categories'" class="tab-content">
          <CategoryManager
            :categories="categories"
            :loading="saving"
            @update="handleCategoriesUpdate"
            @save="saveToGitHub"
            @viewSites="switchToSiteManager"
          />
        </div>

        <div v-if="activeTab === 'sites'" class="tab-content">
          <SiteManager
            :categories="categories"
            :initialSelectedCategoryId="selectedCategoryId"
            :loading="saving"
            @update="handleCategoriesUpdate"
            @save="saveToGitHub"
          />
        </div>

        <div v-if="activeTab === 'settings'" class="tab-content">
          <SystemSettings />
        </div>
      </section>
    </main>

    <CustomDialog
      :visible="dialogVisible"
      :type="dialogType"
      :title="dialogTitle"
      :message="dialogMessage"
      :details="dialogDetails"
      @close="closeDialog"
      @confirm="closeDialog"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CategoryManager from '../components/admin/CategoryManager.vue'
import SiteManager from '../components/admin/SiteManager.vue'
import SystemSettings from '../components/admin/SystemSettings.vue'
import CustomDialog from '../components/admin/CustomDialog.vue'
import { useGitHubAPI } from '../apis/useGitHubAPI.js'
import { setAdminSessionAuthenticated } from '../apis/adminSession.js'

const router = useRouter()
const { logoutAdmin, getServerConfig, saveCategoriesToGitHub, loadCategoriesFromGitHub } = useGitHubAPI()

const loading = ref(false)
const saving = ref(false)
const activeTab = ref('categories')
const categories = ref([])
const navTitle = ref('宝拓导航')
const selectedCategoryId = ref('')
const serverConfig = ref({
  githubConfigured: false
})

const dialogVisible = ref(false)
const dialogType = ref('success')
const dialogTitle = ref('')
const dialogMessage = ref('')
const dialogDetails = ref([])

const tabOptions = [
  {
    key: 'categories',
    icon: '🗂️',
    label: '分类管理',
    hint: '结构与分区',
    kicker: 'Structure',
    title: '分类与展示层级',
    description: '维护导航分区顺序、分类名称和展示层级，快速跳转到对应站点列表。'
  },
  {
    key: 'sites',
    icon: '🌐',
    label: '站点管理',
    hint: '入口与排序',
    kicker: 'Entries',
    title: '站点入口与内容维护',
    description: '编辑入口信息、拖拽排序、自动获取图标，并将内容保存回 GitHub。'
  },
  {
    key: 'settings',
    icon: '⚙️',
    label: '系统设置',
    hint: '连接与品牌',
    kicker: 'System',
    title: '系统配置与品牌资产',
    description: '检查 GitHub 集成状态，维护站点标题、搜索引擎和 Logo 资源。'
  }
]

const totalSiteCount = computed(() => {
  return categories.value.reduce((count, category) => count + (category.sites?.length || 0), 0)
})

const currentTabMeta = computed(() => {
  return tabOptions.find((tab) => tab.key === activeTab.value) || tabOptions[0]
})

const createFallbackCategories = () => ([
  {
    id: 'default',
    name: '默认分类',
    icon: '📁',
    order: 0,
    sites: []
  }
])

const resetCategoriesToFallback = () => {
  categories.value = createFallbackCategories()
  navTitle.value = '宝拓导航'
}

const redirectToLogin = async (reason = 'expired') => {
  setAdminSessionAuthenticated(false)
  await router.replace({
    name: 'admin-login',
    query: {
      redirect: '/admin',
      reason
    }
  })
}

const loadLocalData = async () => {
  try {
    const { mockData } = await import('../mock/mock_data.js')
    return {
      categories: Array.isArray(mockData.categories) && mockData.categories.length
        ? mockData.categories
        : createFallbackCategories(),
      title: mockData.title || '宝拓导航',
      search: mockData.search || 'bing'
    }
  } catch (error) {
    console.error('本地数据加载失败:', error)
    return {
      categories: createFallbackCategories(),
      title: '宝拓导航',
      search: 'bing'
    }
  }
}

const refreshServerConfig = async () => {
  try {
    serverConfig.value = await getServerConfig()
  } catch (error) {
    console.error('读取服务端配置失败:', error)
    serverConfig.value = { githubConfigured: false }
  }
}

const handleAuthError = async (error) => {
  if (error?.status !== 401) {
    return false
  }

  resetCategoriesToFallback()
  await redirectToLogin('expired')
  return true
}

const loadCategories = async () => {
  loading.value = true

  try {
    const data = await loadCategoriesFromGitHub()
    categories.value = Array.isArray(data.categories) && data.categories.length
      ? data.categories
      : createFallbackCategories()
    navTitle.value = data.title || '宝拓导航'
  } catch (error) {
    if (await handleAuthError(error)) {
      return
    }

    console.error('GitHub 数据加载失败，回退到本地数据:', error)
    const fallbackData = await loadLocalData()
    categories.value = fallbackData.categories
    navTitle.value = fallbackData.title

    if (serverConfig.value.githubConfigured) {
      showDialog(
        'info',
        '⚠️ 已切换到本地数据',
        '当前无法读取 GitHub 最新数据，后台暂时显示本地部署内容。',
        [
          `• 错误详情: ${error.message}`,
          '• 请在系统设置里检查 GitHub 集成与服务端环境变量'
        ]
      )
    }
  } finally {
    loading.value = false
  }
}

const handleCategoriesUpdate = (newCategories) => {
  categories.value = newCategories
}

const handleTabClick = (tabKey) => {
  if (tabKey === 'sites') {
    switchToSiteTab()
    return
  }

  activeTab.value = tabKey
}

const switchToSiteManager = (categoryId) => {
  selectedCategoryId.value = categoryId
  activeTab.value = 'sites'
}

const switchToSiteTab = () => {
  selectedCategoryId.value = ''
  activeTab.value = 'sites'
}

const showDialog = (type, title, message, details = []) => {
  dialogType.value = type
  dialogTitle.value = title
  dialogMessage.value = message
  dialogDetails.value = details
  dialogVisible.value = true
}

const closeDialog = () => {
  dialogVisible.value = false
}

const skipLoading = async () => {
  loading.value = false

  const fallbackData = await loadLocalData()
  categories.value = fallbackData.categories
  navTitle.value = fallbackData.title

  showDialog(
    'info',
    '⏭️ 已跳过加载',
    '已跳过 GitHub 数据加载，当前使用本地数据',
    [`• 分类数量: ${categories.value.length}`, '• 可在系统设置中重新尝试连接 GitHub']
  )
}

const saveToGitHub = async () => {
  saving.value = true

  try {
    let currentData = {}

    try {
      currentData = await loadCategoriesFromGitHub()
    } catch (error) {
      if (await handleAuthError(error)) {
        return
      }

      console.warn('加载当前数据失败，使用默认值:', error)
    }

    await saveCategoriesToGitHub({
      categories: categories.value,
      title: navTitle.value,
      search: currentData.search || 'bing'
    })

    showDialog(
      'success',
      '🎉 保存成功',
      '您的更改已成功保存到 GitHub 仓库。',
      [
        '• 更改将在 2-3 分钟内自动部署到线上',
        '• 部署完成后，前台页面会显示最新内容',
        '• 如有问题，请检查部署平台是否触发自动部署'
      ]
    )
  } catch (error) {
    if (await handleAuthError(error)) {
      return
    }

    showDialog(
      'error',
      '❌ 保存失败',
      '保存过程中发生错误，请重试',
      [`• 错误详情: ${error.message}`]
    )
  } finally {
    saving.value = false
  }
}

const logout = async () => {
  try {
    await logoutAdmin()
  } catch (error) {
    console.error('退出登录失败:', error)
  }

  resetCategoriesToFallback()
  await redirectToLogin('logout')
}

onMounted(async () => {
  resetCategoriesToFallback()
  await refreshServerConfig()
  await loadCategories()
})
</script>

<style scoped>
.admin-dashboard {
  min-height: 100vh;
  --admin-bg: #f4efe5;
  --admin-panel: rgba(255, 252, 247, 0.94);
  --admin-panel-strong: #fffdf8;
  --admin-line: rgba(16, 38, 58, 0.1);
  --admin-line-strong: rgba(16, 38, 58, 0.16);
  --admin-shadow: 0 24px 50px rgba(16, 38, 58, 0.08);
  --admin-text: #10263a;
  --admin-text-soft: #6d7a84;
  --admin-accent: #bc8d46;
  --admin-accent-strong: #9f722d;
  --admin-accent-rgb: 188, 141, 70;
  --admin-slate: #183449;
  background:
    radial-gradient(circle at top left, rgba(188, 141, 70, 0.14), transparent 20%),
    radial-gradient(circle at top right, rgba(24, 52, 73, 0.08), transparent 24%),
    linear-gradient(180deg, #faf6ef 0%, #f1eadf 100%);
}

.admin-header {
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid var(--admin-line);
  background: rgba(255, 250, 241, 0.82);
  box-shadow: 0 12px 30px rgba(16, 38, 58, 0.06);
  backdrop-filter: blur(18px);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  max-width: 1380px;
  margin: 0 auto;
  padding: 22px 32px;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 18px;
}

.brand-chip {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid rgba(var(--admin-accent-rgb), 0.22);
  background: rgba(var(--admin-accent-rgb), 0.1);
  color: var(--admin-accent-strong);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.header-copy h1 {
  margin: 0;
  color: var(--admin-text);
  font-size: 30px;
  line-height: 1.1;
  font-family: "Avenir Next", "PingFang SC", "Noto Sans SC", sans-serif;
}

.header-copy p {
  margin: 8px 0 0;
  color: var(--admin-text-soft);
  font-size: 14px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.user-info {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid var(--admin-line);
  background: rgba(255, 255, 255, 0.56);
  color: var(--admin-text-soft);
  font-size: 14px;
  font-weight: 600;
}

.session-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #2f8f62;
  box-shadow: 0 0 0 6px rgba(47, 143, 98, 0.14);
}

.logout-btn {
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid rgba(186, 84, 62, 0.14);
  border-radius: 14px;
  background: linear-gradient(135deg, #cd5b43 0%, #b54638 100%);
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.logout-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 24px rgba(181, 70, 56, 0.18);
}

.admin-main {
  max-width: 1380px;
  margin: 0 auto;
  padding: 28px 32px 52px;
}

.admin-overview {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr);
  gap: 24px;
  margin-bottom: 24px;
  padding: 28px 30px;
  border: 1px solid var(--admin-line);
  border-radius: 32px;
  background:
    radial-gradient(circle at top right, rgba(var(--admin-accent-rgb), 0.08), transparent 28%),
    linear-gradient(180deg, rgba(255, 252, 247, 0.96), rgba(247, 240, 229, 0.92));
  box-shadow: var(--admin-shadow);
}

.overview-copy {
  min-width: 0;
}

.overview-kicker {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  margin-bottom: 14px;
  border-radius: 999px;
  background: rgba(var(--admin-accent-rgb), 0.1);
  border: 1px solid rgba(var(--admin-accent-rgb), 0.16);
  color: var(--admin-accent-strong);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.overview-copy h2 {
  margin: 0;
  color: var(--admin-text);
  font-size: 30px;
  line-height: 1.12;
}

.overview-copy p {
  max-width: 640px;
  margin: 12px 0 0;
  color: var(--admin-text-soft);
  font-size: 15px;
  line-height: 1.7;
}

.overview-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.overview-stat {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 124px;
  padding: 18px;
  border: 1px solid var(--admin-line);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.74);
}

.overview-stat-value {
  color: var(--admin-slate);
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.overview-stat-label {
  margin-top: 8px;
  color: var(--admin-text-soft);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(3px);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  border-radius: 12px;
  background: #fff;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  margin-bottom: 20px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.admin-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border: 1px solid var(--admin-line);
  border-radius: 24px;
  background: rgba(255, 252, 247, 0.76);
  color: var(--admin-text-soft);
  cursor: pointer;
  font-size: 14px;
  text-align: left;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.tab-btn.active {
  border-color: rgba(var(--admin-accent-rgb), 0.28);
  background: linear-gradient(135deg, rgba(19, 45, 63, 0.98), rgba(28, 56, 76, 0.98));
  color: #f7f2e8;
  box-shadow: 0 18px 36px rgba(16, 38, 58, 0.16);
}

.tab-btn:hover:not(.active) {
  transform: translateY(-2px);
  border-color: rgba(var(--admin-accent-rgb), 0.24);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 16px 30px rgba(16, 38, 58, 0.07);
}

.tab-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: rgba(var(--admin-accent-rgb), 0.12);
  font-size: 22px;
  flex-shrink: 0;
}

.tab-btn.active .tab-icon {
  background: rgba(var(--admin-accent-rgb), 0.18);
}

.tab-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.tab-copy strong {
  font-size: 15px;
  font-weight: 700;
}

.tab-copy small {
  color: inherit;
  opacity: 0.82;
  font-size: 12px;
  letter-spacing: 0.04em;
}

.tab-shell {
  padding: 26px 28px;
  border: 1px solid var(--admin-line);
  border-radius: 34px;
  background: var(--admin-panel);
  box-shadow: var(--admin-shadow);
}

.tab-content {
  padding: 0;
}

.skip-loading-btn {
  margin-top: 20px;
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  background: #f39c12;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s ease;
}

.skip-loading-btn:hover {
  background: #e67e22;
}

:deep(.category-manager),
:deep(.site-manager),
:deep(.system-settings) {
  padding: 0;
}

:deep(.manager-header),
:deep(.settings-header) {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 28px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--admin-line);
}

:deep(.manager-header h2),
:deep(.settings-header h2) {
  margin: 0;
  color: var(--admin-text);
  font-size: 28px;
  line-height: 1.1;
}

:deep(.settings-header p) {
  margin: 8px 0 0;
  color: var(--admin-text-soft);
}

:deep(.header-actions) {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

:deep(.add-btn),
:deep(.save-btn),
:deep(.test-btn),
:deep(.save-title-btn),
:deep(.save-search-engine-btn),
:deep(.select-logo-btn),
:deep(.save-logo-btn),
:deep(.submit-btn) {
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid transparent;
  border-radius: 14px;
  font-weight: 700;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

:deep(.add-btn),
:deep(.submit-btn),
:deep(.save-logo-btn) {
  background: linear-gradient(135deg, #c99a46 0%, #a9772f 100%);
  color: #fff;
  box-shadow: 0 12px 22px rgba(169, 119, 47, 0.2);
}

:deep(.save-btn),
:deep(.test-btn),
:deep(.save-title-btn),
:deep(.save-search-engine-btn),
:deep(.select-logo-btn) {
  background: #183449;
  color: #fff;
  box-shadow: 0 12px 22px rgba(24, 52, 73, 0.16);
}

:deep(.add-btn:hover:not(:disabled)),
:deep(.save-btn:hover:not(:disabled)),
:deep(.test-btn:hover:not(:disabled)),
:deep(.save-title-btn:hover:not(:disabled)),
:deep(.save-search-engine-btn:hover:not(:disabled)),
:deep(.select-logo-btn:hover:not(:disabled)),
:deep(.save-logo-btn:hover:not(:disabled)),
:deep(.submit-btn:hover:not(:disabled)) {
  transform: translateY(-2px);
}

:deep(.add-btn:disabled),
:deep(.save-btn:disabled),
:deep(.test-btn:disabled),
:deep(.save-title-btn:disabled),
:deep(.save-search-engine-btn:disabled),
:deep(.select-logo-btn:disabled),
:deep(.save-logo-btn:disabled),
:deep(.submit-btn:disabled) {
  opacity: 0.52;
  box-shadow: none;
  cursor: not-allowed;
}

:deep(.move-btn),
:deep(.edit-btn),
:deep(.delete-btn),
:deep(.cancel-btn) {
  min-height: 40px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--admin-line);
  background: rgba(255, 255, 255, 0.82);
  color: var(--admin-text);
  font-weight: 700;
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

:deep(.move-btn:hover:not(:disabled)),
:deep(.edit-btn:hover),
:deep(.delete-btn:hover),
:deep(.cancel-btn:hover) {
  transform: translateY(-1px);
}

:deep(.delete-btn) {
  border-color: rgba(188, 86, 67, 0.2);
  background: rgba(188, 86, 67, 0.08);
  color: #b35643;
}

:deep(.edit-btn) {
  border-color: rgba(var(--admin-accent-rgb), 0.22);
  background: rgba(var(--admin-accent-rgb), 0.1);
  color: var(--admin-accent-strong);
}

:deep(.move-btn:disabled) {
  opacity: 0.4;
}

:deep(.form-input),
:deep(.form-textarea),
:deep(.title-input),
:deep(.search-engine-select),
:deep(.category-filter) {
  border: 1px solid var(--admin-line-strong);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.84);
  color: var(--admin-text);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

:deep(.form-input:focus),
:deep(.form-textarea:focus),
:deep(.title-input:focus),
:deep(.search-engine-select:focus),
:deep(.category-filter:focus) {
  outline: none;
  border-color: rgba(var(--admin-accent-rgb), 0.45);
  box-shadow: 0 0 0 4px rgba(var(--admin-accent-rgb), 0.12);
  background: #fff;
}

:deep(.modal-overlay) {
  background: rgba(16, 38, 58, 0.42);
  backdrop-filter: blur(10px);
}

:deep(.modal-content) {
  border-radius: 28px;
  border: 1px solid var(--admin-line);
  background: rgba(255, 252, 247, 0.98);
  box-shadow: 0 34px 60px rgba(16, 38, 58, 0.18);
}

:deep(.modal-header) {
  border-bottom: 1px solid var(--admin-line);
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
    padding: 18px 20px;
  }

  .admin-main {
    padding: 20px 16px 36px;
  }

  .admin-overview {
    grid-template-columns: 1fr;
    padding: 22px 20px;
  }

  .overview-stats {
    grid-template-columns: 1fr;
  }

  .tab-shell {
    padding: 18px 16px;
  }

  .admin-tabs {
    grid-template-columns: 1fr;
  }

  .tab-btn {
    padding: 16px 18px;
  }

  .header-brand {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }

  .header-copy h1 {
    font-size: 24px;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
  }

  :deep(.manager-header),
  :deep(.settings-header) {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
