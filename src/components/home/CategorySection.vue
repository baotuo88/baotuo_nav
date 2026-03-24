<template>
  <section class="category-section" :id="`category-${category.id}`" :style="getSectionTone(sectionIndex)">
    <div class="category-section-shell">
      <div class="category-section-backdrop" aria-hidden="true">
        <span class="category-backdrop-blur"></span>
        <span class="category-backdrop-grid"></span>
      </div>

      <header class="category-heading">
        <div class="category-heading-meta">
          <span class="category-index">{{ formatSectionIndex(sectionIndex) }}</span>
          <span class="category-divider"></span>
        </div>
        <div class="category-heading-main">
          <div class="category-heading-topline">
            <span class="category-eyebrow">BTNAV Selection</span>
            <span class="category-tone-dot"></span>
          </div>
          <h2 class="category-title">
            <span class="category-icon">{{ category.icon }}</span>
            <span class="category-name">{{ category.name }}</span>
          </h2>
          <p class="category-caption">{{ category.sites?.length || 0 }} 个精选入口</p>
        </div>
        <div class="category-heading-side">
          <span class="category-badge">{{ category.sites?.length || 0 }} Sites</span>
          <span class="category-side-mark"></span>
        </div>
      </header>

      <div class="category-grid-shell">
        <div class="sites-grid">
          <SiteCard
            v-for="(site, index) in category.sites"
            :key="site.id"
            :site="site"
            :card-index="index"
            @image-error="$emit('image-error', $event)"
            @site-click="$emit('site-click', $event)"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import SiteCard from './SiteCard.vue'

defineProps({
  category: {
    type: Object,
    required: true
  },
  sectionIndex: {
    type: Number,
    default: 0
  }
})

defineEmits(['image-error', 'site-click'])

const formatSectionIndex = (index) => {
  return String(index + 1).padStart(2, '0')
}

const sectionTones = [
  {
    accent: '#bc8d46',
    accentRgb: '188, 141, 70',
    panelTop: 'rgba(255, 251, 243, 0.94)',
    panelBottom: 'rgba(246, 237, 222, 0.68)',
    border: 'rgba(188, 141, 70, 0.16)',
    glow: 'rgba(188, 141, 70, 0.16)'
  },
  {
    accent: '#3f617c',
    accentRgb: '63, 97, 124',
    panelTop: 'rgba(248, 251, 255, 0.94)',
    panelBottom: 'rgba(230, 239, 247, 0.68)',
    border: 'rgba(63, 97, 124, 0.16)',
    glow: 'rgba(63, 97, 124, 0.14)'
  },
  {
    accent: '#4f746b',
    accentRgb: '79, 116, 107',
    panelTop: 'rgba(248, 252, 250, 0.94)',
    panelBottom: 'rgba(232, 242, 238, 0.7)',
    border: 'rgba(79, 116, 107, 0.16)',
    glow: 'rgba(79, 116, 107, 0.14)'
  }
]

const getSectionTone = (index) => {
  const tone = sectionTones[index % sectionTones.length]

  return {
    '--section-accent': tone.accent,
    '--section-accent-rgb': tone.accentRgb,
    '--section-panel-top': tone.panelTop,
    '--section-panel-bottom': tone.panelBottom,
    '--section-panel-border': tone.border,
    '--section-panel-glow': tone.glow
  }
}
</script>
