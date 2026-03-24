<template>
  <div class="site-manager">
    <div class="manager-header">
      <h2>🌐 站点管理</h2>
      <div class="header-actions">
        <select v-model="selectedCategoryId" class="category-filter">
          <option value="">所有分类</option>
          <option v-for="category in localCategories" :key="category.id" :value="category.id">
            {{ category.icon }} {{ category.name }}
          </option>
        </select>
        <button @click="openAddModal" class="add-btn">
          ➕ 添加站点
        </button>
        <button @click="handleSave" :disabled="loading" class="save-btn">
          {{ loading ? '保存中...' : '💾 保存到GitHub' }}
        </button>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-number">{{ totalSites }}</span>
        <span class="stat-label">总站点数</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">{{ localCategories.length }}</span>
        <span class="stat-label">分类数</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">{{ filteredSites.length }}</span>
        <span class="stat-label">当前显示</span>
      </div>
      <div class="stat-info">
        💡 提示：选择分类后可拖拽排序，拖到页面边缘会自动滚动
      </div>
    </div>

    <!-- 站点列表 -->
    <div class="sites-list">
      <draggable
        v-model="currentPageSites"
        v-bind="dragOptions"
        @end="onDragEnd"
        item-key="id"
        tag="div"
        class="draggable-list"
        :class="{ 'pagination-disabled': !selectedCategoryId }"
      >
        <template #item="{ element: site }">
          <div
            class="site-item"
            :class="{ 'draggable-item': selectedCategoryId }"
          >
            <div class="drag-handle" v-if="selectedCategoryId" title="拖拽排序">
              ⋮⋮
            </div>
            <div class="site-info">
              <div class="site-icon">
                <img :src="getIconDisplayUrl(site.icon)" :alt="site.name" @error="handleImageError">
              </div>
              <div class="site-details">
                <h3>{{ site.name }}</h3>
                <p class="site-description">{{ site.description }}</p>
                <a :href="site.url" target="_blank" rel="noopener noreferrer" class="site-url">
                  {{ site.url }}
                </a>
                <span class="site-category">
                  {{ getCategoryName(site.categoryId) }}
                </span>
              </div>
            </div>
            <div class="site-actions">
              <button @click="editSite(site)" class="edit-btn">
                ✏️ 编辑
              </button>
              <button @click="deleteSite(site)" class="delete-btn">
                🗑️ 删除
              </button>
            </div>
          </div>
        </template>
      </draggable>

      <!-- 提示 -->
      <div v-if="!selectedCategoryId" class="pagination-notice">
        💡 请选择具体分类以启用拖拽排序功能
      </div>

      <!-- 拖拽帮助 -->
      <div v-if="selectedCategoryId && filteredSites.length > 5" class="drag-help">
        🖱️ 拖拽到页面顶部或底部边缘可自动滚动
      </div>
    </div>



    <!-- 添加/编辑站点弹窗 -->
    <div v-if="showAddModal || editingSite" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>
            {{ editingSite ? '编辑站点' : '添加站点' }}
            <span v-if="!editingSite && formData.categoryId" class="category-hint">
              → {{ getCategoryName(formData.categoryId) }}
            </span>
          </h3>
          <button @click="closeModal" class="close-btn">✕</button>
        </div>

        <form @submit.prevent="saveSite" class="site-form">
          <div class="form-row">
            <div class="form-group">
              <label>站点名称 *:</label>
              <input
                v-model="formData.name"
                required
                placeholder="请输入站点名称"
                class="form-input"
              >
            </div>
            <div class="form-group">
              <label>所属分类 *:</label>
              <select v-model="formData.categoryId" required class="form-input">
                <option value="">请选择分类</option>
                <option v-for="category in localCategories" :key="category.id" :value="category.id">
                  {{ category.icon }} {{ category.name }}
                  <span v-if="category.id === selectedCategoryId">(当前筛选)</span>
                </option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>站点地址 *:</label>
            <input
              v-model="formData.url"
              type="url"
              required
              placeholder="https://example.com"
              class="form-input"
            >
          </div>

          <div class="form-group">
            <label>站点描述:</label>
            <textarea
              v-model="formData.description"
              placeholder="请输入站点描述"
              class="form-textarea"
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label>站点图标:</label>
            <div class="icon-input-group">
              <input
                v-model="formData.icon"
                placeholder="图标URL或使用自动获取"
                class="form-input"
              >
              <button type="button" @click="autoDetectIcon" class="auto-icon-btn">
                🔍 自动获取
              </button>
            </div>
            <div class="icon-preview" v-if="formData.icon">
              <img :src="getIconDisplayUrl(formData.icon)" alt="图标预览" @error="iconError = true">
            </div>
          </div>

          <div class="form-actions">
            <button type="button" @click="closeModal" class="cancel-btn">取消</button>
            <button type="submit" class="submit-btn">
              {{ editingSite ? '更新' : '添加' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useGitHubAPI } from '../../apis/useGitHubAPI.js'
import draggable from 'vuedraggable'

const props = defineProps({
  categories: {
    type: Array,
    default: () => []
  },
  initialSelectedCategoryId: {
    type: String,
    default: ''
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update', 'save', 'upload-icons'])

// GitHub API
const { uploadBinaryFile } = useGitHubAPI()

// 本地分类数据
const localCategories = ref([])

// 图标数据缓存 - 用于存储待上传的图标
const pendingIcons = ref(new Map())

// 图标预览缓存 - 用于在编辑期间显示图标
const iconPreviews = ref(new Map())

// 筛选
const selectedCategoryId = ref('')

// 弹窗状态
const showAddModal = ref(false)
const editingSite = ref(null)
const iconError = ref(false)

// 表单数据
const formData = ref({
  name: '',
  url: '',
  description: '',
  icon: '',
  categoryId: ''
})

// 监听props变化
watch(() => props.categories, (newCategories) => {
  localCategories.value = JSON.parse(JSON.stringify(newCategories))
}, { immediate: true, deep: true })

// 监听选中分类变化
watch(() => props.initialSelectedCategoryId, (newCategoryId) => {
  if (newCategoryId) {
    selectedCategoryId.value = newCategoryId
  }
}, { immediate: true })

// 手动同步到父组件的函数，避免无限循环
const syncToParent = () => {
  emit('update', localCategories.value)
}

// 计算属性
const allSites = computed(() => {
  const sites = []
  localCategories.value.forEach(category => {
    if (category.sites) {
      category.sites.forEach(site => {
        sites.push({
          ...site,
          categoryId: category.id
        })
      })
    }
  })
  return sites
})

const totalSites = computed(() => allSites.value.length)

const filteredSites = computed(() => {
  if (!selectedCategoryId.value) {
    return allSites.value
  }
  return allSites.value.filter(site => site.categoryId === selectedCategoryId.value)
})

// 当前显示的站点（用于拖拽排序）
const currentPageSites = computed({
  get() {
    return filteredSites.value
  },
  set(newSites) {
    // 拖拽排序后更新站点顺序
    updateSitesOrder(newSites)
  }
})

// 拖拽配置
const dragOptions = computed(() => {
  return {
    animation: 200,
    group: "sites",
    disabled: !selectedCategoryId.value, // 只有选择了具体分类才能拖拽
    ghostClass: "sortable-ghost",
    // 启用拖拽时自动滚动
    scroll: true,
    forceAutoScrollFallback: true, // 强制启用滚动回退
    scrollSensitivity: 100, // 距离边缘100px时开始滚动
    scrollSpeed: 15, // 滚动速度
    bubbleScroll: true // 支持嵌套滚动
  }
})

// 获取分类名称
const getCategoryName = (categoryId) => {
  const category = localCategories.value.find(cat => cat.id === categoryId)
  return category ? `${category.icon} ${category.name}` : '未分类'
}

// 获取图标显示URL - 优先使用预览缓存
const getIconDisplayUrl = (iconPath) => {
  if (!iconPath) return ''

  // 如果有预览缓存，使用预览URL
  if (iconPreviews.value.has(iconPath)) {
    return iconPreviews.value.get(iconPath)
  }

  // 否则使用原始路径
  return iconPath
}

// 编辑站点
const editSite = (site) => {
  editingSite.value = site
  showAddModal.value = false // 确保添加弹窗关闭
  formData.value = {
    name: site.name,
    url: site.url,
    description: site.description,
    icon: site.icon,
    categoryId: site.categoryId
  }
  iconError.value = false
}

// 删除站点
const deleteSite = (site) => {
  if (confirm(`确定要删除站点"${site.name}"吗？`)) {
    const category = localCategories.value.find(cat => cat.id === site.categoryId)
    if (category && category.sites) {
      category.sites = category.sites.filter(s => s.id !== site.id)
      syncToParent()
    }
  }
}

// 拖拽排序：更新站点顺序
const updateSitesOrder = (newSites) => {
  if (!selectedCategoryId.value) {
    // 如果是显示所有分类，拖拽排序会比较复杂，暂时不支持
    console.warn('暂不支持跨分类拖拽排序')
    return
  }

  // 找到当前分类
  const category = localCategories.value.find(cat => cat.id === selectedCategoryId.value)
  if (!category) return

  // 更新该分类的站点顺序
  category.sites = newSites.map(site => ({
    id: site.id,
    name: site.name,
    url: site.url,
    description: site.description,
    icon: site.icon
  }))

  syncToParent()
}

// 拖拽结束事件
const onDragEnd = (event) => {
  console.log('拖拽排序完成:', event)
}



// 通用图标测试函数
const testImage = async (imageUrl) => {
  console.log(`🔍 开始检测图标: ${imageUrl}`)

  // 判断是否为同域名或用户直接输入的本站URL
  const isSameDomain = imageUrl.startsWith(window.location.origin) ||
                      imageUrl.startsWith('/') ||
                      imageUrl.startsWith('./') ||
                      !imageUrl.startsWith('http')

  // 对于同域名的URL，可以使用fetch进行详细检测
  if (isSameDomain) {
    console.log(`📡 同域名资源，使用fetch检测: ${imageUrl}`)
    try {
      // 先检查文件大小，避免加载空的或无效的favicon
      const response = await fetch(imageUrl, { method: 'HEAD' })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 无法访问图标`)
      }

      // 检查Content-Length，如果过小认为可能是空文件或无效图标
      const contentLength = response.headers.get('content-length')
      if (contentLength && parseInt(contentLength) < 100) {
        throw new Error(`文件过小 (${contentLength} bytes)，可能是空的或无效图标`)
      }

      // 如果没有Content-Length，尝试实际下载并检查大小
      if (!contentLength) {
        const fullResponse = await fetch(imageUrl)
        if (!fullResponse.ok) {
          throw new Error(`HTTP ${fullResponse.status}: 下载失败`)
        }

        const arrayBuffer = await fullResponse.arrayBuffer()
        if (arrayBuffer.byteLength < 100) {
          throw new Error(`下载文件过小 (${arrayBuffer.byteLength} bytes)，可能是空的或无效图标`)
        }
      }

      // 大小检查通过后，验证是否能作为图片正常加载
      return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          console.log(`✅ 同域名图标检测成功`)
          resolve(imageUrl)
        }
        img.onerror = () => reject(new Error('图标格式无效或无法显示'))
        img.src = imageUrl
      })
    } catch (fetchError) {
      console.log(`❌ 同域名fetch失败: ${fetchError.message}`)
      throw fetchError
    }
  }

  // 对于跨域URL（包括所有favicon服务），优先使用Image检测避免CORS问题
  console.log(`📸 跨域资源，使用Image检测: ${imageUrl}`)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      // 检查图片尺寸，过小可能是错误页面或无效图标
      if (img.naturalWidth < 1 || img.naturalHeight < 1) {
        console.log(`❌ 图片尺寸无效: ${img.naturalWidth}x${img.naturalHeight}`)
        reject(new Error(`图片尺寸无效 (${img.naturalWidth}x${img.naturalHeight})，可能是无效图标`))
        return
      }
      console.log(`✅ 跨域图标检测成功，尺寸: ${img.naturalWidth}x${img.naturalHeight}`)
      resolve(imageUrl)
    }
    img.onerror = () => {
      console.log(`❌ 图片加载失败: ${imageUrl}`)
      reject(new Error('无法加载图标或图标不存在'))
    }
    // 对于跨域图片，不设置crossOrigin以避免额外的CORS检查
    img.src = imageUrl
  })
}

// 使用Canvas方法下载图标（备用方案）
const downloadIconViaCanvas = async (iconUrl, domain) => {
  console.log(`🎨 使用Canvas方法下载: ${iconUrl}`)

  return new Promise((resolve, reject) => {
    const img = new Image()

    // 设置跨域属性（如果图标服务支持CORS）
    img.crossOrigin = 'anonymous'

    img.onload = async () => {
      try {
        // 检查图片尺寸
        if (img.naturalWidth < 1 || img.naturalHeight < 1) {
          reject(new Error(`图片尺寸无效 (${img.naturalWidth}x${img.naturalHeight})`))
          return
        }

        console.log(`✅ 图片加载成功，尺寸: ${img.naturalWidth}x${img.naturalHeight}`)

        // 创建canvas并绘制图片
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)

        // 将canvas转换为blob
        canvas.toBlob(async (blob) => {
          if (!blob) {
            reject(new Error('Canvas转换为Blob失败'))
            return
          }

          // 将blob转换为arrayBuffer
          const arrayBuffer = await blob.arrayBuffer()

          // 检查文件大小
          if (arrayBuffer.byteLength < 100) {
            reject(new Error(`图标文件过小 (${arrayBuffer.byteLength} bytes)`))
            return
          }

          // 创建本地文件路径和文件名
          const fileName = `${domain}.ico`
          const localPath = `/sitelogo/${fileName}`

          // 创建data URL用于编辑期间的预览
          const dataUrl = URL.createObjectURL(blob)

          // 将图标数据缓存到内存中，等待后续上传
          pendingIcons.value.set(domain, {
            arrayBuffer,
            fileName,
            localPath,
            domain
          })

          // 缓存预览URL，用于编辑期间显示
          const oldPreview = iconPreviews.value.get(localPath)
          if (oldPreview) {
            URL.revokeObjectURL(oldPreview)
          }
          iconPreviews.value.set(localPath, dataUrl)

          console.log(`✅ Canvas下载成功: ${localPath}，文件大小: ${arrayBuffer.byteLength} bytes`)
          resolve(localPath)
        }, 'image/png', 1.0) // 使用PNG格式，质量100%

      } catch (error) {
        reject(new Error(`Canvas处理失败: ${error.message}`))
      }
    }

    img.onerror = () => {
      reject(new Error(`图片加载失败: ${iconUrl}`))
    }

    // 加载图片
    img.src = iconUrl
  })
}

// 下载图标并缓存
const downloadAndCacheIcon = async (iconUrl, domain) => {
  console.log(`📥 开始下载图标: ${iconUrl}`)

  // 优先尝试fetch直接下载
  try {
    const response = await fetch(iconUrl, {
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Accept': 'image/*,*/*;q=0.8'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()

    if (arrayBuffer.byteLength < 100) {
      throw new Error(`图标文件过小 (${arrayBuffer.byteLength} bytes)`)
    }

    // 创建本地文件路径和文件名
    const fileName = `${domain}.ico`
    const localPath = `/sitelogo/${fileName}`

    // 创建data URL用于编辑期间的预览
    const blob = new Blob([arrayBuffer], { type: 'image/x-icon' })
    const dataUrl = URL.createObjectURL(blob)

    // 将图标数据缓存到内存中，等待后续上传
    pendingIcons.value.set(domain, {
      arrayBuffer,
      fileName,
      localPath,
      domain
    })

    // 缓存预览URL，用于编辑期间显示
    const oldPreview = iconPreviews.value.get(localPath)
    if (oldPreview) {
      URL.revokeObjectURL(oldPreview)
    }
    iconPreviews.value.set(localPath, dataUrl)

    console.log(`✅ Fetch下载成功: ${localPath}，文件大小: ${arrayBuffer.byteLength} bytes`)
    return localPath
  } catch (fetchError) {
    console.warn(`⚠️ Fetch下载失败: ${fetchError.message}，尝试Canvas方法`)

    // 如果fetch失败，使用Canvas方法
    try {
      return await downloadIconViaCanvas(iconUrl, domain)
    } catch (canvasError) {
      console.error(`❌ Canvas下载也失败: ${canvasError.message}`)
      throw new Error(`所有下载方法都失败: Fetch(${fetchError.message}), Canvas(${canvasError.message})`)
    }
  }
}

// 上传所有待处理的图标到GitHub（串行上传避免冲突）
const uploadPendingIconsToGitHub = async () => {
  const icons = Array.from(pendingIcons.value.values())
  if (icons.length === 0) {
    console.log('没有待上传的图标')
    return
  }

  console.log(`开始串行上传 ${icons.length} 个图标到GitHub...`)

  const uploadResults = []

  // 串行上传，避免并发冲突
  for (const icon of icons) {
    try {
      const githubPath = `public/sitelogo/${icon.fileName}`
      const message = `chore: 添加站点图标 ${icon.fileName}`

      console.log(`📤 上传图标: ${icon.fileName}`)
      await uploadBinaryFile(githubPath, icon.arrayBuffer, message)
      console.log(`✅ 图标已上传到GitHub: ${githubPath}`)

      // 上传成功后从待处理列表中移除
      pendingIcons.value.delete(icon.domain)
      uploadResults.push({ success: true, fileName: icon.fileName })
    } catch (error) {
      console.error(`❌ 上传图标 ${icon.fileName} 失败:`, error)
      uploadResults.push({ success: false, fileName: icon.fileName, error: error.message })

      // 如果是SHA冲突，抛出错误停止上传，否则继续上传其他图标
      if (error.message.includes('but expected')) {
        throw new Error(`GitHub文件冲突: ${error.message}`)
      }
    }
  }

  // 检查上传结果
  const successCount = uploadResults.filter(r => r.success).length
  const failCount = uploadResults.filter(r => !r.success).length

  console.log(`📊 上传结果: 成功 ${successCount}/${icons.length}`)

  if (failCount > 0) {
    const failedFiles = uploadResults.filter(r => !r.success).map(r => r.fileName)
    throw new Error(`部分图标上传失败: ${failedFiles.join(', ')}`)
  }

  console.log('✅ 所有图标上传完成')
}

// 获取favicon图标
const tryFallbackServices = async (domain) => {
  // 首先尝试icon服务
  // 支持多个favicon服务轮询尝试
  const iconServiceUrls = [
    `https://www.faviconextractor.com/favicon/${domain}`,
    `https://www.google.com/s2/favicons?sz=128&domain_url=https://${domain}`
  ]

  for (const iconServiceUrl of iconServiceUrls) {
    try {
      console.log(`🔍 尝试图标服务:`, iconServiceUrl)

      // 先测试图标是否可用
      // await testImage(iconServiceUrl)
      // console.log(`✅ 图标测试通过: ${iconServiceUrl}`)

      // 下载并缓存到内存（包含降级策略）
      try {
        const localPath = await downloadAndCacheIcon(iconServiceUrl, domain)
        formData.value.icon = localPath
        iconError.value = false
        console.log(`✅ 成功下载并缓存图标: ${iconServiceUrl}`)
        return
      } catch (error) {
        console.log(`❌ 图标服务失败:`, iconServiceUrl, error.message)
      }
    } catch (error) {
      console.log(`❌ 图标服务失败:`, iconServiceUrl, error.message)
      // 继续尝试下一个服务
    }
  }

  const fallbackUrl = `https://${domain}/favicon.ico`

  try {
    console.log(`🔍 尝试标准路径:`, fallbackUrl)

    // 先测试图标是否可用
    await testImage(fallbackUrl)
    formData.value.icon = fallbackUrl
    iconError.value = false
    console.log(`✅ 直接使用标准favicon.ico URL`)
    return
    // // 下载并缓存到内存（包含降级策略）
    // try {
    //   const localPath = await downloadAndCacheIcon(fallbackUrl, domain)
    //   formData.value.icon = localPath
    //   iconError.value = false
    //   console.log(`✅ 标准路径下载并缓存成功`)
    //   return
    // } catch (downloadError) {
    //   console.warn(`⚠️ 标准路径所有下载方法都失败，但图标可用，直接使用URL: ${downloadError.message}`)
    //   // 如果所有下载方法都失败但测试通过，直接使用URL
    //   formData.value.icon = fallbackUrl
    //   iconError.value = false
    //   console.log(`✅ 直接使用标准favicon.ico URL`)
    //   return
    // }
  } catch (error) {
    console.log(`❌ 标准路径也失败:`, error.message)
    console.error('❌ 无法获取网站图标')
    alert('❌ 无法获取网站图标，请手动输入图标URL。\n\n💡 建议使用网站的 favicon.ico 或其他图标链接。')
  }
}

// 自动检测图标
const autoDetectIcon = async () => {
  if (!formData.value.url) {
    alert('请先输入站点地址')
    return
  }

  try {
    const url = new URL(formData.value.url)
    await tryFallbackServices(url.host)
  } catch (error) {
    alert('URL格式不正确')
    console.error('URL 解析错误:', error)
  }
}

// 保存站点
const saveSite = () => {
  const category = localCategories.value.find(cat => cat.id === formData.value.categoryId)
  if (!category) {
    alert('请选择有效的分类')
    return
  }

  if (!category.sites) {
    category.sites = []
  }

  if (editingSite.value) {
    // 更新现有站点
    const originalCategory = localCategories.value.find(cat =>
      cat.sites && cat.sites.some(s => s.id === editingSite.value.id)
    )

    const updatedSite = {
      id: editingSite.value.id,
      name: formData.value.name,
      url: formData.value.url,
      description: formData.value.description,
      icon: formData.value.icon
    }

    // 检查是否更改了分类
    if (originalCategory && originalCategory.id === formData.value.categoryId) {
      // 没有更改分类，在原位置更新，保持顺序
      const siteIndex = originalCategory.sites.findIndex(s => s.id === editingSite.value.id)
      if (siteIndex !== -1) {
        originalCategory.sites[siteIndex] = updatedSite
      }
    } else {
      // 更改了分类，从原分类移除并添加到新分类
      if (originalCategory && originalCategory.sites) {
        originalCategory.sites = originalCategory.sites.filter(s => s.id !== editingSite.value.id)
      }
      category.sites.push(updatedSite)
    }
  } else {
    // 添加新站点
    const newSite = {
      id: `site-${Date.now()}`,
      name: formData.value.name,
      url: formData.value.url,
      description: formData.value.description,
      icon: formData.value.icon
    }
    category.sites.push(newSite)
  }

  syncToParent()
  closeModal()
}

// 打开添加站点弹窗
const openAddModal = () => {
  showAddModal.value = true
  // 设置默认分类为当前选中的分类，如果没有选中则使用第一个分类
  const defaultCategoryId = selectedCategoryId.value || (localCategories.value[0]?.id || '')
  formData.value = {
    name: '',
    url: '',
    description: '',
    icon: '',
    categoryId: defaultCategoryId
  }
  iconError.value = false
}

// 关闭弹窗
const closeModal = () => {
  showAddModal.value = false
  editingSite.value = null
  formData.value = {
    name: '',
    url: '',
    description: '',
    icon: '',
    categoryId: ''
  }
  iconError.value = false
}

// 处理图片错误
const handleImageError = (event) => {
  // 使用品牌 favicon 作为兜底图标
  event.target.src = '/favicon.svg'
  event.target.onerror = null // 防止无限循环
}

// 处理保存操作
const handleSave = async () => {
  try {
    // 先上传待处理的图标文件（只有真正下载缓存的图标）
    if (pendingIcons.value.size > 0) {
      console.log(`📤 开始上传 ${pendingIcons.value.size} 个缓存的图标...`)
      await uploadPendingIconsToGitHub()
      console.log(`✅ 所有图标上传完成`)
    } else {
      console.log(`ℹ️ 没有需要上传的图标（可能都使用了外部URL）`)
    }

    // 然后保存站点数据
    emit('save')
  } catch (error) {
    console.error('保存失败:', error)
    alert(`保存失败: ${error.message}`)
  }
}

// 监听分类变化
watch(selectedCategoryId, () => {
  console.log('分类切换:', selectedCategoryId.value)
})
</script>

<style scoped>
.site-manager {
  padding: 20px 0;
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e9ecef;
}

.manager-header h2 {
  color: #2c3e50;
  margin: 0;
  font-size: 24px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.category-filter {
  padding: 8px 12px;
  border: 2px solid #e1e1e1;
  border-radius: 4px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.add-btn, .save-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.add-btn {
  background: #27ae60;
  color: white;
}

.add-btn:hover {
  background: #219a52;
}

.save-btn {
  background: #3498db;
  color: white;
}

.save-btn:hover:not(:disabled) {
  background: #2980b9;
}

.save-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.stats-bar {
  display: grid;
  grid-template-columns: repeat(3, 1fr) 2fr;
  gap: 20px;
  margin-bottom: 30px;
  align-items: center;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.stat-number {
  font-size: 24px;
  font-weight: 600;
  color: #3498db;
}

.stat-label {
  font-size: 12px;
  color: #7f8c8d;
  margin-top: 5px;
}

.stat-info {
  display: flex;
  align-items: center;
  padding: 12px 15px;
  background: linear-gradient(135deg, #e8f5e8, #f0f8ff);
  border-radius: 8px;
  border-left: 4px solid #27ae60;
  color: #2c3e50;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.sites-list {
  margin-bottom: 30px;
}

.draggable-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}



.pagination-notice {
  text-align: center;
  padding: 20px;
  background: #e8f5e8;
  border: 1px solid #4caf50;
  border-radius: 8px;
  color: #2e7d32;
  font-size: 14px;
  margin-top: 20px;
}

.drag-help {
  text-align: center;
  padding: 12px 20px;
  background: #e3f2fd;
  border: 1px solid #2196f3;
  border-radius: 6px;
  color: #1565c0;
  font-size: 13px;
  margin-top: 15px;
  opacity: 0.9;
}

.pagination-disabled .site-item {
  opacity: 0.8;
  cursor: default;
}

.pagination-disabled .site-item:hover {
  transform: none;
  background: #f8f9fa;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.site-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.site-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.draggable-item {
  cursor: move;
  position: relative;
}

.draggable-item:hover {
  background: #f1f3f4;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
}

.draggable-item.sortable-chosen {
  background: #e3f2fd;
  border-color: #2196f3;
  transform: rotate(3deg);
  box-shadow: 0 8px 20px rgba(33, 150, 243, 0.3);
}

.draggable-item.sortable-ghost {
  opacity: 0.5;
  background: #e8f5e8;
  border: 2px dashed #4caf50;
}

.drag-handle {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: #95a5a6;
  font-size: 16px;
  font-weight: bold;
  cursor: grab;
  padding: 8px 4px;
  border-radius: 4px;
  transition: all 0.3s ease;
  user-select: none;
}

.drag-handle:hover {
  color: #3498db;
  background: rgba(52, 152, 219, 0.1);
}

.drag-handle:active {
  cursor: grabbing;
  color: #2980b9;
}

.draggable-item .site-info {
  margin-left: 30px;
}

.site-info {
  display: flex;
  align-items: center;
  gap: 15px;
  flex: 1;
}

.site-icon {
  width: 48px;
  height: 48px;
  background: white;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e9ecef;
  flex-shrink: 0;
}

.site-icon img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.site-details {
  flex: 1;
}

.site-details h3 {
  margin: 0 0 5px 0;
  color: #2c3e50;
  font-size: 16px;
}

.site-description {
  margin: 0 0 5px 0;
  color: #7f8c8d;
  font-size: 14px;
}

.site-url {
  color: #3498db;
  text-decoration: none;
  font-size: 13px;
  display: block;
  margin-bottom: 5px;
}

.site-url:hover {
  text-decoration: underline;
}

.site-category {
  display: inline-block;
  background: #3498db;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.site-actions {
  display: flex;
  gap: 10px;
}

.edit-btn, .delete-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.3s ease;
}

.edit-btn {
  background: #f39c12;
  color: white;
}

.edit-btn:hover {
  background: #e67e22;
}

.delete-btn {
  background: #e74c3c;
  color: white;
}

.delete-btn:hover {
  background: #c0392b;
}



/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.category-hint {
  font-size: 14px;
  color: #3498db;
  background: #e8f4fd;
  padding: 4px 8px;
  border-radius: 12px;
  font-weight: 400;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #7f8c8d;
  padding: 5px;
  border-radius: 4px;
  transition: background-color 0.3s ease;
}

.close-btn:hover {
  background: #f8f9fa;
}

.site-form {
  padding: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #555;
  font-weight: 500;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 10px;
  border: 2px solid #e1e1e1;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.3s ease;
}

.form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: #3498db;
}

.form-textarea {
  resize: vertical;
  font-family: inherit;
}

.icon-input-group {
  display: flex;
  gap: 10px;
}

.auto-icon-btn {
  padding: 10px 15px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
  transition: background-color 0.3s ease;
}

.auto-icon-btn:hover {
  background: #2980b9;
}

.icon-preview {
  margin-top: 10px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-preview img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e9ecef;
}

.cancel-btn, .submit-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.3s ease;
}

.cancel-btn {
  background: #95a5a6;
  color: white;
}

.cancel-btn:hover {
  background: #7f8c8d;
}

.submit-btn {
  background: #27ae60;
  color: white;
}

.submit-btn:hover {
  background: #219a52;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .manager-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }

  .header-actions {
    flex-wrap: wrap;
    width: 100%;
  }

  .stats-bar {
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  }

  .stat-info {
    grid-column: 1 / -1;
    margin-top: 10px;
    font-size: 12px;
    padding: 10px;
  }

  .site-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }

  .site-actions {
    align-self: flex-end;
    flex-wrap: wrap;
    gap: 8px;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .icon-input-group {
    flex-direction: column;
  }

  .modal-header h3 {
    font-size: 18px;
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }

  .category-hint {
    font-size: 12px;
    padding: 2px 6px;
  }

  .draggable-item .site-info {
    margin-left: 20px;
  }

  .drag-handle {
    left: 4px;
    font-size: 14px;
    padding: 6px 2px;
  }

  .pagination-notice {
    padding: 15px;
    font-size: 13px;
  }

  .drag-help {
    padding: 10px 15px;
    font-size: 12px;
    margin-top: 10px;
  }
}
</style>
