<template>
  <div class="admin-dashboard">
    <header class="admin-header">
      <div class="header-content">
        <h1>🛠️ 宝拓导航管理</h1>
        <div class="header-actions">
          <span class="user-info">管理员会话已验证</span>
          <button @click="logout" class="logout-btn">退出</button>
        </div>
      </div>
    </header>

    <main class="admin-main">
      <div v-if="loading" class="loading-overlay">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <p>正在加载数据...</p>
          <button @click="skipLoading" class="skip-loading-btn">跳过加载</button>
        </div>
      </div>

      <div class="admin-tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'categories' }"
          @click="activeTab = 'categories'"
        >
          📁 分类管理
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'sites' }"
          @click="switchToSiteTab"
        >
          🌐 站点管理
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'settings' }"
          @click="activeTab = 'settings'"
        >
          ⚙️ 系统设置
        </button>
      </div>

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
import { onMounted, ref } from 'vue'
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
  background: #f5f7fa;
}

.admin-header {
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid rgba(16, 38, 58, 0.08);
  background: rgba(255, 250, 241, 0.88);
  box-shadow: 0 10px 30px rgba(16, 38, 58, 0.08);
  backdrop-filter: blur(14px);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
  padding: 15px 30px;
}

.header-content h1 {
  margin: 0;
  color: #10263a;
  font-size: 20px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-info {
  color: #7f8c8d;
  font-size: 14px;
}

.logout-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background: #e74c3c;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s ease;
}

.logout-btn:hover {
  background: #c0392b;
}

.admin-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 30px;
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
  display: flex;
  margin-bottom: 30px;
  padding: 5px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.tab-btn {
  flex: 1;
  padding: 12px 20px;
  border: none;
  border-radius: 4px;
  background: none;
  color: #7f8c8d;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.tab-btn.active {
  background: #10263a;
  color: #fff;
}

.tab-btn:hover:not(.active) {
  background: #f8f9fa;
  color: #2c3e50;
}

.tab-content {
  padding: 30px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
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

@media (max-width: 768px) {
  .header-content {
    padding: 15px 20px;
  }

  .admin-main {
    padding: 20px 15px;
  }

  .tab-content {
    padding: 20px 15px;
  }

  .admin-tabs {
    flex-direction: column;
  }

  .tab-btn {
    margin-bottom: 5px;
  }
}
</style>
