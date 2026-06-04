<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/utils'

defineOptions({
  name: 'UserAvatar',
})

const props = withDefaults(defineProps<{
  src?: string
  name?: string
  size?: 'sm' | 'md' | 'lg'
  class?: HTMLAttributes['class']
}>(), {
  size: 'md',
})

const sizeClass: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-base',
}

const initials = computed(() => {
  const raw = (props.name ?? '').trim()
  if (!raw) return '—'
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
  }
  return raw.slice(0, 2).toUpperCase()
})

/** Ignore les avatars générés (Dicebear) encore en cache local. */
const effectiveSrc = computed(() => {
  const url = props.src?.trim() ?? ''
  if (!url || url.includes('dicebear.com')) return ''
  return url
})
</script>

<template>
  <FaAvatar
    :src="effectiveSrc"
    :fallback="initials"
    :class="cn(
      'shrink-0 rounded-full font-semibold tracking-wide ring-2 ring-primary/15',
      '[&_[data-slot=avatar-fallback]]:bg-gradient-to-br',
      '[&_[data-slot=avatar-fallback]]:from-primary/15',
      '[&_[data-slot=avatar-fallback]]:to-primary/5',
      '[&_[data-slot=avatar-fallback]]:text-primary',
      sizeClass[size],
      props.class,
    )"
  />
</template>
