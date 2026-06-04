import type { Ref } from 'vue'
import { ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import {
  applyAllSpellCorrections,
  applySpellCorrection,
  checkFrenchSpelling,
  type SpellIssue,
} from '@/utils/spell-check-fr'

export function useSpellCheck(
  text: Ref<string>,
  options?: { online?: boolean, minLength?: number },
) {
  const issues = ref<SpellIssue[]>([])
  const checking = ref(false)
  const dismissed = ref(false)
  const minLength = options?.minLength ?? 3

  const runCheck = useDebounceFn(async () => {
    const value = text.value.trim()
    if (value.length < minLength || dismissed.value) {
      issues.value = []
      return
    }
    checking.value = true
    try {
      issues.value = await checkFrenchSpelling(text.value, { online: options?.online })
    } finally {
      checking.value = false
    }
  }, 700)

  watch(text, () => {
    dismissed.value = false
    void runCheck()
  })

  function applyOne(issue: SpellIssue, replacement?: string) {
    const rep = replacement ?? issue.replacements[0]
    if (!rep) return
    text.value = applySpellCorrection(text.value, issue, rep)
    issues.value = issues.value.filter(
      (i) => i.offset !== issue.offset || i.length !== issue.length,
    )
    void runCheck()
  }

  function applyAll() {
    if (issues.value.length === 0) return
    text.value = applyAllSpellCorrections(text.value, issues.value)
    issues.value = []
    void runCheck()
  }

  function dismiss() {
    dismissed.value = true
    issues.value = []
  }

  function refresh() {
    dismissed.value = false
    void runCheck()
  }

  return {
    issues,
    checking,
    applyOne,
    applyAll,
    dismiss,
    refresh,
  }
}
