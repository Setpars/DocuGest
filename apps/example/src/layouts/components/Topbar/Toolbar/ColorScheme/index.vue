<script setup lang="ts">
import type { ThemeSettings } from '@fantastic-admin/settings'

type ThemeColorScheme = NonNullable<ThemeSettings['colorScheme']>

defineOptions({
  name: 'ToolbarColorScheme',
})

const appSettingsStore = useAppSettingsStore()

const colorSchemeOptions: {
  label: string
  value: ThemeColorScheme
  icon: string
}[] = [
  { label: 'Clair', value: 'light', icon: 'i-ri:sun-line' },
  { label: 'Sombre', value: 'dark', icon: 'i-ri:moon-line' },
  { label: 'Système', value: '', icon: 'i-codicon:color-mode' },
]

const activeOption = computed(() => {
  const scheme = appSettingsStore.settings.theme.colorScheme ?? ''
  return colorSchemeOptions.find(o => o.value === scheme) ?? colorSchemeOptions[2]
})

function selectColorScheme(value: ThemeColorScheme) {
  if (appSettingsStore.settings.theme.colorScheme === value) {
    return
  }
  appSettingsStore.setColorScheme(value)
}
</script>

<template>
  <FaDropdown
    :items="[
      colorSchemeOptions.map(option => ({
        label: option.label,
        icon: option.icon,
        disabled: appSettingsStore.settings.theme.colorScheme === option.value,
        handle: () => selectColorScheme(option.value),
      })),
    ]"
  >
    <FaButton variant="ghost" size="icon-sm" :title="`Thème : ${activeOption.label}`">
      <FaIcon :name="activeOption.icon" class="size-4" />
    </FaButton>
  </FaDropdown>
</template>
