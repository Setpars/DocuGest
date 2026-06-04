import type { Ref } from 'vue'
import { ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import {
  detectJuridictionFromMotif,
  type JuridictionDetectionResult,
} from '@/utils/detect-juridiction'

/**
 * Suggère / préremplit la juridiction à partir du motif du dossier.
 */
export function useJuridictionFromMotif(
  motif: Ref<string>,
  juridiction: Ref<string>,
  knownJuridictions: Ref<string[]>,
) {
  const suggestion = ref<JuridictionDetectionResult | null>(null)
  const juridictionEditedManually = ref(false)
  const lastAutoFilled = ref('')

  function runDetection() {
    if (juridictionEditedManually.value) {
      suggestion.value = null
      return
    }

    const result = detectJuridictionFromMotif(motif.value, {
      knownJuridictions: knownJuridictions.value,
    })
    suggestion.value = result

    if (!result) return

    const current = juridiction.value.trim()
    const canAutoFill = !current || current === lastAutoFilled.value

    if (canAutoFill && (result.confidence === 'high' || result.confidence === 'medium')) {
      juridiction.value = result.juridiction
      lastAutoFilled.value = result.juridiction
    }
  }

  const debouncedDetect = useDebounceFn(runDetection, 450)

  watch(motif, () => {
    void debouncedDetect()
  })

  function onJuridictionManualInput() {
    const current = juridiction.value.trim()
    if (current !== lastAutoFilled.value) {
      juridictionEditedManually.value = true
      suggestion.value = null
    }
  }

  function applySuggestion() {
    if (!suggestion.value) return
    juridiction.value = suggestion.value.juridiction
    lastAutoFilled.value = suggestion.value.juridiction
    juridictionEditedManually.value = false
    suggestion.value = null
  }

  function dismissSuggestion() {
    suggestion.value = null
  }

  function resetJuridictionDetection() {
    juridictionEditedManually.value = false
    lastAutoFilled.value = ''
    suggestion.value = null
  }

  function lockJuridictionManual() {
    juridictionEditedManually.value = true
    suggestion.value = null
  }

  /** Applique la détection immédiatement avant l’enregistrement (évite la course avec le debounce). */
  function flushJuridictionForSave() {
    runDetection()
    if (juridictionEditedManually.value) return
    const current = juridiction.value.trim()
    if (current) return
    if (suggestion.value) {
      juridiction.value = suggestion.value.juridiction
      lastAutoFilled.value = suggestion.value.juridiction
    }
  }

  return {
    suggestion,
    onJuridictionManualInput,
    applySuggestion,
    dismissSuggestion,
    resetJuridictionDetection,
    lockJuridictionManual,
    runDetection,
    flushJuridictionForSave,
  }
}
