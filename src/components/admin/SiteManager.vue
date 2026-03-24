<template>
  <div class="site-manager">
    <div class="manager-header">
      <div class="manager-copy">
        <span class="manager-kicker">Entries</span>
        <div>
          <h2>站点管理</h2>
          <p>维护每个分类下的站点入口、图标资源与排序顺序，选中分类后可直接拖拽重排。</p>
        </div>
      </div>
      <div class="header-actions">
        <select v-model="selectedCategoryId" class="category-filter">
          <option value="">所有分类</option>
          <option v-for="category in localCategories" :key="category.id" :value="category.id">
            {{ category.icon }} {{ category.name }}
          </option>
        </select>
        <button @click="openAddModal" class="add-btn">
          添加站点
        </button>
        <button @click="handleSave" :disabled="loading" class="save-btn">
          {{ loading ? '保存中...' : '保存到 GitHub' }}
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
        <span class="stat-info-kicker">Workflow</span>
        <p v-if="selectedCategoryId">
          当前已选中 <strong>{{ selectedCategoryLabel }}</strong>，拖拽排序已启用，保存后会同步写回 GitHub。
        </p>
        <p v-else>
          当前显示全部分类。先选择一个具体分类，再启用拖拽排序和精细维护。
        </p>
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
                <div class="site-topline">
                  <span class="site-category">
                    {{ getCategoryName(site.categoryId) }}
                  </span>
                  <span v-if="selectedCategoryId" class="site-order-chip">可拖拽排序</span>
                </div>
                <h3>{{ site.name }}</h3>
                <p class="site-description">{{ site.description || '未填写站点简介' }}</p>
                <a :href="site.url" target="_blank" rel="noopener noreferrer" class="site-url">
                  {{ site.url }}
                </a>
              </div>
            </div>
            <div class="site-actions">
              <button @click="editSite(site)" class="edit-btn">
                编辑
              </button>
              <button @click="deleteSite(site)" class="delete-btn">
                删除
              </button>
            </div>
          </div>
        </template>
      </draggable>

      <!-- 提示 -->
      <div v-if="!selectedCategoryId" class="pagination-notice">
        请选择具体分类以启用拖拽排序功能
      </div>

      <!-- 拖拽帮助 -->
      <div v-if="selectedCategoryId && filteredSites.length > 5" class="drag-help">
        拖拽到页面顶部或底部边缘时会自动滚动，便于长列表重排
      </div>
    </div>



    <!-- 添加/编辑站点弹窗 -->
    <div v-if="showAddModal || editingSite" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>
            {{ editingSite ? '编辑站点' : '添加站点' }}
            <span v-if="!editingSite && formData.categoryId" class="category-hint">
              {{ getCategoryName(formData.categoryId) }}
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
                自动获取图标
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

const selectedCategoryLabel = computed(() => {
  if (!selectedCategoryId.value) {
    return '全部分类'
  }

  const category = localCategories.value.find((item) => item.id === selectedCategoryId.value)
  return category ? `${category.icon} ${category.name}` : '未分类'
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
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.manager-copy {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 680px;
}

.manager-kicker {
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

.manager-copy p {
  margin: 8px 0 0;
  color: var(--admin-text-soft);
  font-size: 14px;
  line-height: 1.7;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.stats-bar {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(280px, 1.3fr);
  gap: 16px;
  align-items: stretch;
}

.stat-item,
.stat-info {
  padding: 18px 20px;
  border-radius: 24px;
  border: 1px solid var(--admin-line);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(250, 245, 236, 0.92));
  box-shadow: 0 16px 28px rgba(16, 38, 58, 0.05);
}

.stat-item {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 112px;
}

.stat-number {
  color: var(--admin-slate);
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.stat-label {
  margin-top: 8px;
  color: var(--admin-text-soft);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.stat-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  background:
    radial-gradient(circle at top right, rgba(var(--admin-accent-rgb), 0.12), transparent 32%),
    linear-gradient(180deg, rgba(24, 52, 73, 0.98), rgba(18, 38, 56, 0.98));
  color: #f7f2e8;
}

.stat-info-kicker {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(var(--admin-accent-rgb), 0.14);
  color: #efd6ad;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.stat-info p {
  margin: 0;
  color: rgba(247, 242, 232, 0.84);
  font-size: 14px;
  line-height: 1.7;
}

.stat-info strong {
  color: #fff;
  font-weight: 700;
}

.sites-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.draggable-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.site-item {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 20px;
  align-items: center;
  padding: 22px 24px;
  border-radius: 28px;
  border: 1px solid var(--admin-line);
  background:
    radial-gradient(circle at top right, rgba(var(--admin-accent-rgb), 0.08), transparent 26%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(250, 245, 236, 0.94));
  box-shadow: 0 20px 34px rgba(16, 38, 58, 0.06);
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
}

.site-item:hover {
  transform: translateY(-2px);
  border-color: rgba(var(--admin-accent-rgb), 0.2);
  box-shadow: 0 28px 42px rgba(16, 38, 58, 0.1);
}

.pagination-disabled .site-item {
  opacity: 0.94;
}

.pagination-disabled .site-item:hover {
  transform: none;
}

.draggable-item {
  cursor: move;
}

.draggable-item.sortable-chosen {
  border-color: rgba(var(--admin-accent-rgb), 0.28);
  box-shadow: 0 24px 42px rgba(16, 38, 58, 0.14);
}

.draggable-item.sortable-ghost {
  opacity: 0.45;
  border-style: dashed;
}

.drag-handle {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 44px;
  border-radius: 12px;
  color: rgba(16, 38, 58, 0.42);
  font-size: 16px;
  font-weight: 800;
  cursor: grab;
  user-select: none;
  transition: color 0.2s ease, background 0.2s ease;
}

.drag-handle:hover {
  color: var(--admin-accent-strong);
  background: rgba(var(--admin-accent-rgb), 0.08);
}

.drag-handle:active {
  cursor: grabbing;
}

.draggable-item .site-info {
  margin-left: 24px;
}

.site-info {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  min-width: 0;
}

.site-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  border-radius: 22px;
  border: 1px solid rgba(var(--admin-accent-rgb), 0.12);
  background: linear-gradient(180deg, rgba(255, 249, 238, 0.98), rgba(245, 238, 225, 0.92));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
}

.site-icon img {
  width: 42px;
  height: 42px;
  object-fit: contain;
}

.site-details {
  min-width: 0;
}

.site-topline {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.site-details h3 {
  margin: 0;
  color: var(--admin-text);
  font-size: 24px;
  line-height: 1.15;
}

.site-description {
  margin: 12px 0 8px;
  color: var(--admin-text-soft);
  font-size: 14px;
  line-height: 1.7;
}

.site-url {
  display: inline-flex;
  max-width: 100%;
  overflow: hidden;
  color: var(--admin-slate);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.site-url:hover {
  color: var(--admin-accent-strong);
}

.site-category,
.site-order-chip {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.site-category {
  background: rgba(24, 52, 73, 0.08);
  color: var(--admin-slate);
}

.site-order-chip {
  background: rgba(var(--admin-accent-rgb), 0.1);
  color: var(--admin-accent-strong);
}

.site-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pagination-notice,
.drag-help {
  padding: 16px 18px;
  border-radius: 20px;
  border: 1px solid var(--admin-line);
  background: rgba(255, 255, 255, 0.72);
  color: var(--admin-text-soft);
  font-size: 13px;
  line-height: 1.6;
  text-align: center;
}

.pagination-notice {
  background: rgba(var(--admin-accent-rgb), 0.08);
  color: var(--admin-accent-strong);
}

.drag-help {
  background: rgba(24, 52, 73, 0.06);
  color: var(--admin-slate);
}

.modal-content {
  width: min(680px, calc(100% - 32px));
}

.modal-header h3 {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.category-hint {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(var(--admin-accent-rgb), 0.1);
  color: var(--admin-accent-strong);
  font-size: 12px;
  font-weight: 700;
}

.site-form {
  padding: 22px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: var(--admin-text);
  font-weight: 700;
}

.form-textarea {
  resize: vertical;
  min-height: 108px;
  font-family: inherit;
}

.icon-input-group {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.auto-icon-btn {
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid rgba(var(--admin-accent-rgb), 0.2);
  border-radius: 14px;
  background: rgba(var(--admin-accent-rgb), 0.1);
  color: var(--admin-accent-strong);
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

.auto-icon-btn:hover {
  transform: translateY(-1px);
  border-color: rgba(var(--admin-accent-rgb), 0.28);
  background: rgba(var(--admin-accent-rgb), 0.14);
}

.icon-preview {
  margin-top: 12px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--admin-line);
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-preview img {
  width: 40px;
  height: 40px;
  object-fit: contain;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid rgba(16, 38, 58, 0.08);
}

@media (max-width: 1100px) {
  .stats-bar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stat-info {
    grid-column: 1 / -1;
  }

  .site-item {
    grid-template-columns: 1fr;
  }

  .site-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 768px) {
  .manager-copy {
    max-width: none;
  }

  .header-actions {
    width: 100%;
  }

  .category-filter {
    width: 100%;
  }

  .stats-bar {
    grid-template-columns: 1fr;
  }

  .site-item {
    padding: 20px;
    border-radius: 24px;
  }

  .site-info {
    flex-direction: column;
  }

  .site-details h3 {
    font-size: 22px;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .icon-input-group {
    grid-template-columns: 1fr;
  }

  .draggable-item .site-info {
    margin-left: 18px;
  }

  .drag-handle {
    left: 6px;
    width: 24px;
  }
}
</style>
