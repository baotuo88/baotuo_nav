<template>
  <div class="system-settings">
    <div class="settings-header">
      <div class="settings-copy">
        <span class="settings-kicker">System</span>
        <div>
          <h2>系统设置</h2>
          <p>维护 GitHub 集成状态、品牌资源与运行环境，让后台配置和线上部署保持一致。</p>
        </div>
      </div>
      <div class="settings-summary">
        <article class="summary-card">
          <span class="summary-value">{{ connectionStatus?.connected ? 'ON' : 'OFF' }}</span>
          <span class="summary-label">GitHub Sync</span>
        </article>
        <article class="summary-card">
          <span class="summary-value summary-value-text">{{ currentTitle || '宝拓导航' }}</span>
          <span class="summary-label">Site Title</span>
        </article>
        <article class="summary-card">
          <span class="summary-value summary-value-text">{{ searchEngineOptions.find(opt => opt.value === currentSearchEngine)?.label || 'Bing' }}</span>
          <span class="summary-label">Search Engine</span>
        </article>
      </div>
    </div>

    <!-- GitHub连接状态 -->
    <div class="settings-section">
      <div class="section-heading">
        <span class="section-kicker">Connection</span>
        <div>
          <h3>GitHub 集成状态</h3>
          <p>检查仓库连接、当前权限和后台服务端配置是否生效。</p>
        </div>
      </div>
      <div class="github-status" :class="{ connected: connectionStatus?.connected }">
        <div class="status-info">
          <div class="status-indicator">
            <span class="status-dot" :class="{ active: connectionStatus?.connected }"></span>
            <span class="status-text">
              {{ connectionStatus?.connected ? 'GitHub 连接正常' : 'GitHub 连接失败' }}
            </span>
          </div>
          <div v-if="connectionStatus?.connected" class="repo-info">
            <p><strong>仓库:</strong> {{ connectionStatus.repo }}</p>
            <p><strong>权限:</strong>
              <span v-if="connectionStatus.permissions?.push" class="permission-badge success">写入权限</span>
              <span v-else class="permission-badge warning">只读权限</span>
            </p>
          </div>
          <div v-else-if="connectionStatus?.error" class="error-info">
            <p>错误信息: {{ connectionStatus.error }}</p>
          </div>
        </div>
        <div class="status-actions">
          <button @click="testConnection" :disabled="testing" class="test-btn">
            {{ testing ? '测试中...' : '重新测试连接' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 网站设置 -->
    <div class="settings-section">
      <div class="section-heading">
        <span class="section-kicker">Brand</span>
        <div>
          <h3>网站设置</h3>
          <p>统一维护站点标题、默认搜索引擎和品牌 Logo 资源。</p>
        </div>
      </div>
      <div class="website-settings">
        <!-- 网站标题设置 -->
        <div class="setting-group">
          <label>网站标题:</label>
          <div class="title-input-group">
            <input
              v-model="websiteTitle"
              type="text"
              placeholder="请输入网站标题"
              class="title-input"
              maxlength="50"
            >
            <button
              @click="saveTitleToGitHub"
              :disabled="titleSaving || !websiteTitle.trim()"
              class="save-title-btn"
            >
              {{ titleSaving ? '保存中...' : '保存标题' }}
            </button>
          </div>
          <p class="setting-description">当前标题: {{ currentTitle || '未设置' }}</p>
        </div>

        <!-- 默认搜索引擎设置 -->
        <div class="setting-group">
          <label>默认搜索引擎:</label>
          <div class="search-engine-input-group">
            <select v-model="searchEngine" class="search-engine-select">
              <option
                v-for="option in searchEngineOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
            <button
              @click="saveSearchEngineToGitHub"
              :disabled="searchEngineSaving || searchEngine === currentSearchEngine"
              class="save-search-engine-btn"
            >
              {{ searchEngineSaving ? '保存中...' : '保存设置' }}
            </button>
          </div>
          <p class="setting-description">当前搜索引擎: {{ searchEngineOptions.find(opt => opt.value === currentSearchEngine)?.label || '未设置' }}</p>
        </div>

        <!-- Logo设置 -->
        <div class="setting-group">
          <label>网站Logo:</label>
          <div class="logo-upload-area">
            <div class="logo-preview">
              <img
                v-if="logoPreview"
                :src="logoPreview"
                alt="Logo预览"
                class="logo-preview-img"
              >
              <img
                v-else-if="currentLogo"
                :src="currentLogo"
                alt="当前Logo"
                class="logo-preview-img"
              >
              <div v-else class="logo-placeholder">
                <span>Logo</span>
                <p>暂无品牌图形</p>
              </div>
            </div>
            <div class="logo-upload-controls">
              <input
                ref="logoFileInput"
                type="file"
                accept="image/png"
                @change="handleLogoSelect"
                style="display: none"
              >
              <button @click="selectLogo" class="select-logo-btn">
                选择 PNG 文件
              </button>
              <button
                @click="saveLogoToGitHub"
                :disabled="logoSaving || !selectedLogoFile"
                class="save-logo-btn"
                v-if="selectedLogoFile"
              >
                {{ logoSaving ? '上传中...' : '上传 Logo' }}
              </button>
            </div>
          </div>
          <p class="setting-description">仅支持PNG格式，建议尺寸: 128x128px</p>
        </div>
      </div>
    </div>

    <!-- 服务端环境变量配置 -->
    <div class="settings-section">
      <div class="section-heading">
        <span class="section-kicker">Runtime</span>
        <div>
          <h3>服务端环境变量</h3>
          <p>确认管理员密钥、GitHub 仓库配置和分支设置是否已在服务端生效。</p>
        </div>
      </div>
      <div class="env-config">
        <div class="config-item">
          <label>管理员密钥 (ADMIN_PASSWORD):</label>
          <div class="config-value">
            <span v-if="envConfig.adminPasswordConfigured" class="value-set">已配置</span>
            <span v-else class="value-missing">未配置</span>
          </div>
        </div>
        <div class="config-item">
          <label>GitHub Token (GITHUB_TOKEN):</label>
          <div class="config-value">
            <span v-if="envConfig.githubTokenConfigured" class="value-set">已配置</span>
            <span v-else class="value-missing">未配置</span>
          </div>
        </div>
        <div class="config-item">
          <label>GitHub 仓库所有者 (GITHUB_OWNER):</label>
          <div class="config-value">
            <span class="value-display">{{ envConfig.githubOwner || '默认: baotuo88' }}</span>
          </div>
        </div>
        <div class="config-item">
          <label>GitHub 仓库名称 (GITHUB_REPO):</label>
          <div class="config-value">
            <span class="value-display">{{ envConfig.githubRepo || '默认: baotuo_nav' }}</span>
          </div>
        </div>
        <div class="config-item">
          <label>GitHub 分支 (GITHUB_BRANCH):</label>
          <div class="config-value">
            <span class="value-display">{{ envConfig.githubBranch || '默认: master' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 配置说明 -->
    <div class="settings-section">
      <div class="section-heading">
        <span class="section-kicker">Guide</span>
        <div>
          <h3>配置说明</h3>
          <p>按照以下顺序创建 Token、配置环境变量并完成部署安全检查。</p>
        </div>
      </div>
      <div class="config-guide">
        <div class="guide-step">
          <h4>1. 获取 GitHub Personal Access Token</h4>
          <ol>
            <li>访问 <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">GitHub Settings → Developer settings → Personal access tokens</a></li>
            <li>点击 "Generate new token" → "Generate new token (fine-grained token)"</li>
            <li>设置 Token 名称，选择过期时间，仓库只选择 baotuo_nav，避免 token 泄露影响你其他工程</li>
            <li>
              <strong>在 <span class="guide-emphasis">Repository permissions (仓库权限)</span> 部分，勾选以下权限：</strong>
              <ul>
                <li>
                  <code>Contents</code> - <strong>Read and write</strong> ✅<br>
                  <span class="guide-note">用于读取和修改 <code>src/mock/mock_data.js</code> 文件，这是管理系统的核心功能</span>
                </li>
                <li>
                  <code>Metadata</code> - <strong>Read</strong> ✅<br>
                  <span class="guide-note">用于访问仓库基本信息，GitHub API 的基础权限</span>
                </li>
              </ul>
              <div class="guide-subnote">
                <strong>在 <span class="guide-emphasis">Account permissions (账户权限)</span> 部分：</strong><br>
                <span class="guide-note">不需要勾选任何账户权限，我们只操作特定仓库，不需要账户级别的权限。</span>
              </div>
            </li>
            <li>点击 "Generate token" 并复制 Token</li>
          </ol>
        </div>

        <div class="guide-step">
          <h4>2. 配置环境变量</h4>
          <p>
            <strong>如果你在 <span class="guide-emphasis">自己的服务器</span> 部署：</strong><br>
            在项目根目录创建 <code>.env</code> 文件，添加以下配置：
          </p>
          <p>
            <strong>如果你使用 <span class="guide-emphasis">Vercel</span> 或 <span class="guide-emphasis">Cloudflare Pages</span> 部署：</strong><br>
            请在对应平台的「环境变量」设置界面，添加下方这些变量，无需在项目中创建 <code>.env</code> 文件。
          </p>
          <div class="code-block">
            <pre><code># 服务端管理员登录密码
ADMIN_PASSWORD=your_admin_password_here

# 建议单独设置会话签名密钥
ADMIN_SESSION_SECRET=replace_with_a_long_random_string

# GitHub Token
GITHUB_TOKEN=your_github_token_here
GITHUB_OWNER=baotuo88
GITHUB_REPO=baotuo_nav
GITHUB_BRANCH=master

# 可选：前台访问锁，仅用于公开站点的简单访问门槛
VITE_OPEN_LOCK=true
VITE_OPEN_LOCK_PASSWORD=your_public_lock_password</code></pre>
          </div>
          <p class="setting-description">敏感值请使用服务端环境变量，不要再放到 <code>VITE_*</code> 中。</p>
        </div>

        <div class="guide-step">
          <h4>3. 安全注意事项</h4>
          <ul>
            <li>🔒 <strong>不要</strong>将 <code>.env</code> 文件提交到 Git 仓库</li>
            <li>🔑 GitHub Token 具有写入权限，请妥善保管</li>
            <li>🧱 管理员密码和 GitHub Token 只应存在于服务端环境变量</li>
            <li>🚫 定期更新和轮换 Token</li>
            <li>📝 在生产环境中，建议使用更安全的密钥管理方案</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 系统信息 -->
    <div class="settings-section">
      <div class="section-heading">
        <span class="section-kicker">Info</span>
        <div>
          <h3>系统信息</h3>
          <p>当前后台运行环境、浏览器信息和构建时间概览。</p>
        </div>
      </div>
      <div class="system-info">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Vue 版本:</span>
            <span class="info-value">{{ systemInfo.vueVersion }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">构建工具:</span>
            <span class="info-value">Vite</span>
          </div>
          <div class="info-item">
            <span class="info-label">部署时间:</span>
            <span class="info-value">{{ systemInfo.buildTime }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">浏览器:</span>
            <span class="info-value">{{ systemInfo.userAgent }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 自定义弹框 -->
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
import { ref, onMounted } from 'vue'
import { useGitHubAPI } from '../../apis/useGitHubAPI.js'
import CustomDialog from './CustomDialog.vue'

const {
  getServerConfig,
  verifyGitHubConnection,
  loadCategoriesFromGitHub,
  saveCategoriesToGitHub,
  uploadBinaryFile
} = useGitHubAPI()

// 连接状态
const connectionStatus = ref(null)
const testing = ref(false)

// 环境变量配置
const envConfig = ref({
  adminPasswordConfigured: false,
  githubTokenConfigured: false,
  githubOwner: '',
  githubRepo: '',
  githubBranch: '',
  githubConfigured: false
})

// 系统信息
const systemInfo = ref({
  vueVersion: '',
  buildTime: '',
  userAgent: ''
})

// 网站设置
const websiteTitle = ref('')
const currentTitle = ref('')
const titleSaving = ref(false)

// 搜索引擎设置
const searchEngine = ref('bing')
const currentSearchEngine = ref('bing')
const searchEngineSaving = ref(false)

// 搜索引擎选项
const searchEngineOptions = [
  { value: 'google', label: 'Google' },
  { value: 'baidu', label: '百度' },
  { value: 'bing', label: 'Bing' },
  { value: 'duckduckgo', label: 'DuckDuckGo' }
]

// Logo设置
const logoFileInput = ref(null)
const selectedLogoFile = ref(null)
const logoPreview = ref('')
const currentLogo = ref('/logo.png')
const logoSaving = ref(false)

// 自定义弹框状态
const dialogVisible = ref(false)
const dialogType = ref('success')
const dialogTitle = ref('')
const dialogMessage = ref('')
const dialogDetails = ref([])

// 显示弹框
const showDialog = (type, title, message, details = []) => {
  dialogType.value = type
  dialogTitle.value = title
  dialogMessage.value = message
  dialogDetails.value = details
  dialogVisible.value = true
}

// 关闭弹框
const closeDialog = () => {
  dialogVisible.value = false
}

// 测试GitHub连接
const testConnection = async () => {
  testing.value = true
  try {
    connectionStatus.value = await verifyGitHubConnection()
  } catch (error) {
    connectionStatus.value = {
      connected: false,
      error: error.message
    }
  } finally {
    testing.value = false
  }
}

// 检查环境变量配置
const checkEnvConfig = async () => {
  try {
    envConfig.value = await getServerConfig()
  } catch (error) {
    console.error('读取服务端环境变量失败:', error)
    envConfig.value = {
      adminPasswordConfigured: false,
      githubTokenConfigured: false,
      githubOwner: '',
      githubRepo: '',
      githubBranch: '',
      githubConfigured: false
    }
  }
}

// 获取系统信息
const getSystemInfo = () => {
  systemInfo.value = {
    vueVersion: '3.x',
    buildTime: new Date().toLocaleString('zh-CN'),
    userAgent: navigator.userAgent
  }
}

// 加载当前网站设置
const loadWebsiteSettings = async () => {
  try {
    const data = await loadCategoriesFromGitHub()
    currentTitle.value = data.title || '宝拓导航'
    websiteTitle.value = currentTitle.value

    // 加载搜索引擎设置
    currentSearchEngine.value = data.search || 'bing'
    searchEngine.value = currentSearchEngine.value
  } catch (error) {
    console.error('加载网站设置失败，回退到本地数据:', error)

    try {
      const { mockData } = await import('../../mock/mock_data.js')
      currentTitle.value = mockData.title || '宝拓导航'
      websiteTitle.value = currentTitle.value
      currentSearchEngine.value = mockData.search || 'bing'
      searchEngine.value = currentSearchEngine.value
    } catch (localError) {
      console.error('本地网站设置加载失败:', localError)
      currentTitle.value = '宝拓导航'
      websiteTitle.value = '宝拓导航'
      currentSearchEngine.value = 'bing'
      searchEngine.value = 'bing'
    }
  }
}

// 保存标题到GitHub
const saveTitleToGitHub = async () => {
  if (!websiteTitle.value.trim()) {
    showDialog(
      'error',
      '❌ 输入错误',
      '请输入网站标题',
      []
    )
    return
  }

  titleSaving.value = true
  try {
    // 加载当前数据
    const data = await loadCategoriesFromGitHub()

    // 更新标题
    data.title = websiteTitle.value.trim()

    // 保存到GitHub
    await saveCategoriesToGitHub(data)

    currentTitle.value = websiteTitle.value.trim()
    showDialog(
      'success',
      '🎉 网站标题保存成功',
      '您的网站标题已成功保存到GitHub仓库！',
      [
        '• 更改将在 2-3 分钟内自动部署到线上',
        '• 部署完成后，您可以在前台页面看到最新标题',
        '• 如有问题，请检查Vercel或CFpage是否触发自动部署'
      ]
    )
  } catch (error) {
    console.error('保存标题失败:', error)
    showDialog(
      'error',
      '❌ 保存失败',
      '网站标题保存过程中发生错误，请重试',
      [`• 错误详情: ${error.message}`]
    )
  } finally {
    titleSaving.value = false
  }
}

// 保存搜索引擎设置到GitHub
const saveSearchEngineToGitHub = async () => {
  searchEngineSaving.value = true
  try {
    // 加载当前数据
    const data = await loadCategoriesFromGitHub()

    // 更新搜索引擎
    data.search = searchEngine.value

    // 保存到GitHub
    await saveCategoriesToGitHub(data)

    currentSearchEngine.value = searchEngine.value
    showDialog(
      'success',
      '🎉 默认搜索引擎保存成功',
      '您的默认搜索引擎设置已成功保存到GitHub仓库！',
      [
        '• 更改将在 2-3 分钟内自动部署到线上',
        '• 部署完成后，用户访问网站时将默认使用新的搜索引擎',
        '• 如有问题，请检查Vercel或CFpage是否触发自动部署'
      ]
    )
  } catch (error) {
    console.error('保存搜索引擎设置失败:', error)
    showDialog(
      'error',
      '❌ 保存失败',
      '默认搜索引擎设置保存过程中发生错误，请重试',
      [`• 错误详情: ${error.message}`]
    )
  } finally {
    searchEngineSaving.value = false
  }
}

// 选择Logo文件
const selectLogo = () => {
  logoFileInput.value?.click()
}

// 处理Logo文件选择
const handleLogoSelect = (event) => {
  const file = event.target.files[0]
  if (!file) return

  // 验证文件类型
  if (file.type !== 'image/png') {
    showDialog(
      'error',
      '❌ 文件格式错误',
      '请选择PNG格式的图片文件',
      []
    )
    return
  }

  // 验证文件大小 (限制为2MB)
  if (file.size > 2 * 1024 * 1024) {
    showDialog(
      'error',
      '❌ 文件过大',
      '图片文件大小不能超过2MB',
      [`• 当前文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`]
    )
    return
  }

  selectedLogoFile.value = file

  // 创建预览
  const reader = new FileReader()
  reader.onload = (e) => {
    logoPreview.value = e.target.result
  }
  reader.readAsDataURL(file)
}

// 保存Logo到GitHub
const saveLogoToGitHub = async () => {
  if (!selectedLogoFile.value) {
    showDialog(
      'error',
      '❌ 未选择文件',
      '请先选择Logo文件',
      []
    )
    return
  }

  logoSaving.value = true
  try {
    // 读取文件为ArrayBuffer
    const arrayBuffer = await selectedLogoFile.value.arrayBuffer()

    // 上传到GitHub
    const githubPath = 'public/logo.png'
    const message = `chore: 更新网站Logo - ${new Date().toLocaleString('zh-CN')}`

    await uploadBinaryFile(githubPath, arrayBuffer, message)

    // 更新当前Logo显示
    currentLogo.value = logoPreview.value

    // 清理选择的文件
    selectedLogoFile.value = null
    logoPreview.value = ''
    logoFileInput.value.value = ''

    showDialog(
      'success',
      '🎉 Logo上传成功',
      '您的网站Logo已成功保存到GitHub仓库！',
      [
        '• 更改将在 2-3 分钟内自动部署到线上',
        '• 部署完成后，刷新页面即可看到新Logo',
        '• 如有问题，请检查Vercel或CFpage是否触发自动部署'
      ]
    )
  } catch (error) {
    console.error('上传Logo失败:', error)
    showDialog(
      'error',
      '❌ 上传失败',
      'Logo上传过程中发生错误，请重试',
      [`• 错误详情: ${error.message}`]
    )
  } finally {
    logoSaving.value = false
  }
}

// 组件挂载时执行
onMounted(async () => {
  await checkEnvConfig()
  getSystemInfo()
  await testConnection()
  await loadWebsiteSettings()
})
</script>

<style scoped>
.system-settings {
  display: flex;
  flex-direction: column;
  gap: 26px;
}

.system-settings > .settings-header {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.95fr);
  gap: 20px;
  align-items: stretch;
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.settings-copy {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.settings-kicker,
.section-kicker {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(var(--admin-accent-rgb), 0.1);
  border: 1px solid rgba(var(--admin-accent-rgb), 0.14);
  color: var(--admin-accent-strong);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.settings-copy p {
  margin: 8px 0 0;
  color: var(--admin-text-soft);
  font-size: 14px;
  line-height: 1.7;
}

.settings-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 118px;
  padding: 18px;
  border-radius: 24px;
  border: 1px solid var(--admin-line);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(250, 245, 236, 0.92));
  box-shadow: 0 16px 28px rgba(16, 38, 58, 0.05);
}

.summary-value {
  color: var(--admin-slate);
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.summary-value-text {
  font-size: 20px;
  line-height: 1.15;
}

.summary-label {
  margin-top: 8px;
  color: var(--admin-text-soft);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.settings-section {
  padding: 24px;
  border-radius: 30px;
  border: 1px solid var(--admin-line);
  background:
    radial-gradient(circle at top right, rgba(var(--admin-accent-rgb), 0.08), transparent 24%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(250, 245, 236, 0.94));
  box-shadow: 0 22px 38px rgba(16, 38, 58, 0.06);
}

.section-heading {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 18px;
}

.section-heading p {
  margin: 8px 0 0;
  color: var(--admin-text-soft);
  font-size: 14px;
  line-height: 1.7;
}

.github-status {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  padding: 22px;
  border-radius: 24px;
  border: 1px solid var(--admin-line);
  background: rgba(255, 255, 255, 0.78);
}

.github-status.connected {
  border-color: rgba(47, 143, 98, 0.18);
  background:
    radial-gradient(circle at top right, rgba(47, 143, 98, 0.12), transparent 30%),
    rgba(255, 255, 255, 0.82);
}

.status-info {
  min-width: 0;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #c15f4b;
  box-shadow: 0 0 0 6px rgba(193, 95, 75, 0.12);
}

.status-dot.active {
  background: #2f8f62;
  box-shadow: 0 0 0 6px rgba(47, 143, 98, 0.12);
}

.status-text {
  color: var(--admin-text);
  font-size: 16px;
  font-weight: 700;
}

.repo-info p,
.error-info p {
  margin: 8px 0 0;
  color: var(--admin-text-soft);
  font-size: 14px;
  line-height: 1.7;
}

.error-info p {
  color: #b35643;
}

.permission-badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.permission-badge.success {
  background: rgba(47, 143, 98, 0.12);
  color: #2f8f62;
}

.permission-badge.warning {
  background: rgba(var(--admin-accent-rgb), 0.14);
  color: var(--admin-accent-strong);
}

.status-actions {
  display: flex;
  align-items: center;
}

.website-settings {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.setting-group,
.config-item,
.guide-step,
.info-item {
  border: 1px solid var(--admin-line);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.64);
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 100%;
  padding: 20px;
  border-radius: 24px;
}

.setting-group label,
.config-item label,
.info-label {
  color: var(--admin-text);
  font-weight: 700;
}

.setting-description {
  margin: 0;
  color: var(--admin-text-soft);
  font-size: 13px;
  line-height: 1.6;
}

.title-input-group,
.search-engine-input-group {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.logo-upload-area {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.logo-preview {
  width: 132px;
  height: 132px;
  border-radius: 24px;
  border: 1px dashed rgba(var(--admin-accent-rgb), 0.22);
  background: rgba(255, 252, 247, 0.94);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.logo-preview-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.logo-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--admin-text-soft);
  text-align: center;
}

.logo-placeholder span {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.logo-placeholder p {
  margin: 8px 0 0;
  font-size: 13px;
}

.logo-upload-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.env-config {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 14px;
  justify-content: space-between;
  min-height: 136px;
  padding: 18px;
  border-radius: 22px;
}

.config-value {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.value-set,
.value-missing {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.value-set {
  background: rgba(47, 143, 98, 0.12);
  color: #2f8f62;
}

.value-missing {
  background: rgba(188, 86, 67, 0.12);
  color: #b35643;
}

.value-display {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 12px;
  background: rgba(16, 38, 58, 0.06);
  color: var(--admin-slate);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
}

.config-guide {
  display: grid;
  gap: 14px;
}

.guide-step {
  padding: 20px;
  border-radius: 24px;
}

.guide-step h4 {
  margin: 0 0 14px;
  color: var(--admin-text);
  font-size: 17px;
}

.guide-step p,
.guide-step li {
  color: var(--admin-text-soft);
  line-height: 1.7;
}

.guide-step ol,
.guide-step ul {
  margin: 12px 0 0 20px;
}

.guide-step a {
  color: var(--admin-accent-strong);
  text-decoration: none;
}

.guide-step a:hover {
  text-decoration: underline;
}

.guide-emphasis {
  color: var(--admin-accent-strong);
}

.guide-note {
  color: var(--admin-text-soft);
  font-size: 13px;
}

.guide-subnote {
  margin-top: 8px;
}

.guide-step code {
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(16, 38, 58, 0.06);
  color: var(--admin-slate);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
}

.code-block {
  margin: 16px 0;
  padding: 16px;
  border-radius: 20px;
  border: 1px solid rgba(16, 38, 58, 0.08);
  background: #183449;
  color: #f7f2e8;
  overflow-x: auto;
}

.code-block pre {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.system-info {
  padding: 0;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  min-height: 88px;
  padding: 18px;
  border-radius: 22px;
}

.info-value {
  max-width: 60%;
  overflow: hidden;
  color: var(--admin-text-soft);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1100px) {
  .settings-header,
  .website-settings,
  .env-config,
  .info-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .settings-summary {
    grid-template-columns: 1fr;
  }

  .github-status {
    grid-template-columns: 1fr;
  }

  .title-input-group,
  .search-engine-input-group,
  .logo-upload-area {
    grid-template-columns: 1fr;
  }

  .logo-upload-controls {
    align-items: stretch;
  }

  .config-item,
  .info-item {
    min-height: auto;
  }

  .info-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .info-value {
    max-width: none;
    text-align: left;
    white-space: normal;
    word-break: break-word;
  }
}
</style>
