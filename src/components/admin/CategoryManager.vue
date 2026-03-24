<template>
  <div class="category-manager">
    <div class="manager-header">
      <div class="manager-copy">
        <span class="manager-kicker">Structure</span>
        <div>
          <h2>分类管理</h2>
          <p>维护导航分区、排序顺序与展示入口，点击卡片可直接切到对应站点列表。</p>
        </div>
      </div>
      <div class="header-actions">
        <button @click="showAddModal = true" class="add-btn">
          添加分类
        </button>
        <button @click="$emit('save')" :disabled="loading" class="save-btn">
          {{ loading ? '保存中...' : '保存到 GitHub' }}
        </button>
      </div>
    </div>

    <!-- 分类列表 -->
    <div class="categories-list">
      <div
        v-for="(category, index) in localCategories"
        :key="category.id"
        class="category-item clickable"
        @click="$emit('viewSites', category.id)"
      >
        <div class="category-main">
          <div class="category-meta">
            <div class="category-header">
              <div class="category-info">
                <button type="button" class="category-icon" @click.stop="editCategory(category)">
                  {{ category.icon }}
                </button>
                <div class="category-details">
                  <div class="category-title-row">
                    <h3 @click.stop="editCategory(category)">{{ category.name }}</h3>
                    <span class="order-badge">#{{ formatOrder((category.order ?? 0) + 1) }}</span>
                  </div>
                  <p>{{ category.sites?.length || 0 }} 个站点，可点击切换到站点管理继续维护入口内容</p>
                </div>
              </div>
              <button type="button" class="view-sites-btn" @click.stop="$emit('viewSites', category.id)">
                查看站点
              </button>
            </div>
            <div class="category-actions">
              <button @click.stop="moveCategory(index, -1)" :disabled="index === 0" class="move-btn">
                上移
              </button>
              <button @click.stop="moveCategory(index, 1)" :disabled="index === localCategories.length - 1" class="move-btn">
                下移
              </button>
              <button @click.stop="editCategory(category)" class="edit-btn">
                编辑
              </button>
              <button @click.stop="deleteCategory(category.id)" class="delete-btn">
                删除
              </button>
            </div>
          </div>

          <div class="sites-preview" :class="{ 'empty-preview': !category.sites || category.sites.length === 0 }">
            <div class="preview-header">
              <div>
                <span class="preview-kicker">Preview</span>
                <h4 class="preview-title">站点预览</h4>
              </div>
              <span class="preview-count">{{ category.sites?.length || 0 }} Sites</span>
            </div>

            <div v-if="category.sites && category.sites.length > 0" class="sites-grid">
              <div
                v-for="site in category.sites.slice(0, 4)"
                :key="site.id"
                class="site-preview"
              >
                <img :src="site.icon" :alt="site.name" @error="handleImageError">
                <span>{{ site.name }}</span>
              </div>
              <div v-if="category.sites.length > 4" class="more-sites">
                +{{ category.sites.length - 4 }} 更多入口
              </div>
            </div>

            <div v-else class="empty-state">
              <span class="empty-icon">＋</span>
              <p>该分类还没有站点，点击右侧按钮即可继续添加。</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加/编辑分类弹窗 -->
    <div v-if="showAddModal || editingCategory" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ editingCategory ? '编辑分类' : '添加分类' }}</h3>
          <button @click="closeModal" class="close-btn">✕</button>
        </div>

        <form @submit.prevent="saveCategory" class="category-form">
          <div class="form-group">
            <label>分类图标:</label>
            <div class="icon-input">
              <input
                v-model="formData.icon"
                placeholder="输入emoji图标"
                class="form-input icon-preview"
              >
              <div class="emoji-suggestions">
                <span
                  v-for="emoji in emojiSuggestions"
                  :key="emoji"
                  @click="formData.icon = emoji"
                  class="emoji-item"
                >
                  {{ emoji }}
                </span>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>分类名称:</label>
            <input
              v-model="formData.name"
              required
              placeholder="请输入分类名称"
              class="form-input"
            >
          </div>

          <div class="form-group">
            <label>排序顺序:</label>
            <input
              v-model.number="formData.order"
              type="number"
              required
              placeholder="数字越小排序越靠前"
              class="form-input"
            >
          </div>

          <div class="form-actions">
            <button type="button" @click="closeModal" class="cancel-btn">取消</button>
            <button type="submit" class="submit-btn">
              {{ editingCategory ? '更新' : '添加' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  categories: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update', 'save', 'viewSites'])

// 本地分类数据
const localCategories = ref([])

// 弹窗状态
const showAddModal = ref(false)
const editingCategory = ref(null)

// 表单数据
const formData = ref({
  icon: '📁',
  name: '',
  order: 0
})

// Emoji建议
const emojiSuggestions = [
  '📁', '🛠️', '🎨', '📚', '👥', '⚙️', '🎮', '💼',
  '☁️', '🔧', '📊', '🎵', '📱', '💻', '🌐', '🔍'
]

const sortCategories = (categories) => {
  return [...categories].sort((current, next) => (current.order ?? 0) - (next.order ?? 0))
}

const formatOrder = (value) => {
  return String(value).padStart(2, '0')
}

// 监听props变化
watch(() => props.categories, (newCategories) => {
  localCategories.value = sortCategories(JSON.parse(JSON.stringify(newCategories)))
}, { immediate: true, deep: true })

// 手动同步到父组件的函数，避免无限循环
const syncToParent = () => {
  emit('update', localCategories.value)
}

// 移动分类
const moveCategory = (index, direction) => {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= localCategories.value.length) return

  const categories = [...localCategories.value]
  const item = categories.splice(index, 1)[0]
  categories.splice(newIndex, 0, item)

  // 重新排序
  categories.forEach((category, idx) => {
    category.order = idx
  })

  localCategories.value = categories
  syncToParent()
}

// 编辑分类
const editCategory = (category) => {
  editingCategory.value = category
  formData.value = {
    icon: category.icon,
    name: category.name,
    order: category.order
  }
}

// 删除分类
const deleteCategory = (categoryId) => {
  if (confirm('确定要删除这个分类吗？这将同时删除分类下的所有站点。')) {
    localCategories.value = localCategories.value.filter(cat => cat.id !== categoryId)
    syncToParent()
  }
}

// 保存分类
const saveCategory = () => {
  if (editingCategory.value) {
    // 更新现有分类
    const index = localCategories.value.findIndex(cat => cat.id === editingCategory.value.id)
    if (index !== -1) {
      localCategories.value[index] = {
        ...localCategories.value[index],
        ...formData.value
      }
    }
  } else {
    // 添加新分类
    const newCategory = {
      id: `category-${Date.now()}`,
      ...formData.value,
      sites: []
    }
    localCategories.value.push(newCategory)
  }

  localCategories.value = sortCategories(localCategories.value)
  syncToParent()
  closeModal()
}

// 关闭弹窗
const closeModal = () => {
  showAddModal.value = false
  editingCategory.value = null
  formData.value = {
    icon: '📁',
    name: '',
    order: localCategories.value.length
  }
}

// 处理图片错误
const handleImageError = (event) => {
  // 使用品牌 favicon 作为兜底图标
  event.target.src = '/favicon.svg'
  event.target.onerror = null // 防止无限循环
}
</script>

<style scoped>
.category-manager {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.manager-copy {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 620px;
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
  gap: 15px;
}

.categories-list {
  display: grid;
  gap: 20px;
}

.category-item {
  border: 1px solid var(--admin-line);
  border-radius: 30px;
  padding: 24px;
  background:
    radial-gradient(circle at top right, rgba(var(--admin-accent-rgb), 0.1), transparent 26%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(250, 245, 236, 0.94));
  box-shadow: 0 20px 36px rgba(16, 38, 58, 0.06);
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
}

.category-item.clickable {
  cursor: pointer;
}

.category-item.clickable:hover {
  transform: translateY(-3px);
  box-shadow: 0 28px 44px rgba(16, 38, 58, 0.1);
  border-color: rgba(var(--admin-accent-rgb), 0.2);
}

.category-main {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.92fr);
  gap: 24px;
  align-items: stretch;
}

.category-meta {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 18px;
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.category-info {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  min-width: 0;
}

.category-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 78px;
  height: 78px;
  flex-shrink: 0;
  padding: 0;
  border: 1px solid rgba(var(--admin-accent-rgb), 0.12);
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 249, 238, 0.98), rgba(245, 238, 225, 0.92));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
  font-size: 34px;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.category-icon:hover {
  transform: translateY(-2px);
  border-color: rgba(var(--admin-accent-rgb), 0.24);
  box-shadow: 0 14px 24px rgba(16, 38, 58, 0.1);
}

.category-details {
  min-width: 0;
}

.category-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.category-details h3 {
  margin: 0;
  color: var(--admin-text);
  cursor: pointer;
  font-size: 28px;
  line-height: 1.12;
  transition: color 0.2s ease;
}

.category-details h3:hover {
  color: var(--admin-accent-strong);
}

.category-details p {
  margin: 12px 0 0;
  color: var(--admin-text-soft);
  font-size: 14px;
  line-height: 1.75;
}

.category-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.order-badge {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(var(--admin-accent-rgb), 0.14);
  background: rgba(var(--admin-accent-rgb), 0.08);
  color: var(--admin-accent-strong);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.view-sites-btn {
  min-height: 42px;
  padding: 0 16px;
  border: 1px solid rgba(24, 52, 73, 0.12);
  border-radius: 14px;
  background: rgba(24, 52, 73, 0.96);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.view-sites-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 24px rgba(24, 52, 73, 0.16);
}

.sites-preview {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
  min-height: 100%;
  padding: 18px;
  border: 1px solid rgba(16, 38, 58, 0.08);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.72);
}

.preview-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.preview-kicker {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(var(--admin-accent-rgb), 0.08);
  color: var(--admin-accent-strong);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.preview-title {
  margin: 8px 0 0;
  color: var(--admin-text);
  font-size: 18px;
}

.preview-count {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(24, 52, 73, 0.08);
  color: var(--admin-slate);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sites-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.site-preview {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 10px;
  min-height: 108px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(16, 38, 58, 0.08);
  background: rgba(255, 255, 255, 0.9);
}

.site-preview img {
  width: 40px;
  height: 40px;
  object-fit: contain;
  border-radius: 14px;
  background: rgba(255, 252, 247, 0.96);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.site-preview span {
  display: -webkit-box;
  overflow: hidden;
  color: var(--admin-text);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
  text-align: left;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.more-sites {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 108px;
  padding: 14px;
  border-radius: 18px;
  border: 1px dashed rgba(var(--admin-accent-rgb), 0.22);
  background: rgba(var(--admin-accent-rgb), 0.08);
  color: var(--admin-accent-strong);
  font-size: 13px;
  font-weight: 800;
  text-align: center;
}

.empty-preview {
  justify-content: center;
}

.empty-state {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-height: 132px;
  padding: 18px;
  border: 1px dashed rgba(var(--admin-accent-rgb), 0.2);
  border-radius: 20px;
  background: rgba(var(--admin-accent-rgb), 0.06);
}

.empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.86);
  color: var(--admin-accent-strong);
  font-size: 18px;
  font-weight: 700;
}

.empty-state p {
  margin: 0;
  color: var(--admin-text-soft);
  font-size: 14px;
  line-height: 1.7;
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
  width: min(520px, calc(100% - 32px));
  max-width: 500px;
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
  color: var(--admin-text);
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

.category-form {
  padding: 20px;
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

.form-input {
  width: 100%;
  padding: 10px;
  font-size: 14px;
}

.icon-input {
  position: relative;
}

.icon-preview {
  font-size: 20px;
  text-align: center;
}

.emoji-suggestions {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
  margin-top: 10px;
  padding: 12px;
  background: rgba(16, 38, 58, 0.04);
  border-radius: 18px;
}

.emoji-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  cursor: pointer;
  border-radius: 10px;
  transition: transform 0.2s ease, background-color 0.2s ease;
}

.emoji-item:hover {
  transform: translateY(-1px);
  background: rgba(var(--admin-accent-rgb), 0.12);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid rgba(16, 38, 58, 0.08);
}

/* 响应式设计 */
@media (max-width: 1100px) {
  .category-main {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .manager-copy {
    max-width: none;
  }

  .category-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .category-actions {
    flex-wrap: wrap;
  }

  .view-sites-btn {
    width: 100%;
    justify-content: center;
  }

  .sites-grid {
    grid-template-columns: 1fr;
  }

  .category-details h3 {
    font-size: 24px;
  }

  .category-item {
    padding: 20px;
    border-radius: 24px;
  }

  .emoji-suggestions {
    grid-template-columns: repeat(6, 1fr);
  }
}
</style>
