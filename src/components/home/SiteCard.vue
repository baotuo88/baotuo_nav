<template>
  <a
    :href="site.url"
    target="_blank"
    rel="noopener noreferrer"
    class="site-card"
    :style="{ '--card-order': cardIndex }"
    @click="handleClick"
  >
    <div class="site-card-header">
      <div class="site-icon-wrap">
        <div class="site-icon">
          <img :src="site.icon" :alt="site.name" @error="$emit('image-error', $event)" />
        </div>
      </div>

      <div class="site-info">
        <div class="site-title-row">
          <h3 class="site-name">{{ site.name }}</h3>
          <span class="site-link-indicator" aria-hidden="true">↗</span>
        </div>
        <p class="site-description">{{ site.description }}</p>
      </div>
    </div>

    <div class="site-card-footer">
      <span class="site-domain">{{ displayHost }}</span>
      <span class="site-open-chip">Open</span>
    </div>
  </a>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  site: {
    type: Object,
    required: true
  },
  cardIndex: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['image-error', 'site-click'])

const displayHost = computed(() => {
  try {
    const hostname = new URL(props.site.url).hostname || ''
    return hostname.replace(/^www\./, '') || 'external'
  } catch {
    return 'external'
  }
})

const handleClick = () => {
  emit('site-click', props.site)
}
</script>
