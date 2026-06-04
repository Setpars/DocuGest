<script setup lang="ts">
defineOptions({
  name: 'SpellCheckAssist',
})

const model = defineModel<string>({ required: true })

const props = withDefaults(
  defineProps<{
    /** Libellé court pour l’accessibilité */
    fieldLabel?: string
    /** Désactive LanguageTool (hors ligne uniquement) */
    /** Pas d’appel LanguageTool (recommandé sur les formulaires sensibles) */
  offlineOnly?: boolean
    multiline?: boolean
    rows?: number
    placeholder?: string
    inputClass?: string
    /** Valeurs déjà utilisées (liste de suggestions HTML). */
    suggestions?: string[]
    listId?: string
  }>(),
  {
    fieldLabel: 'Champ',
    offlineOnly: true,
    multiline: false,
    rows: 3,
    placeholder: '',
    inputClass: '',
  },
)

const {
  issues,
  checking,
  applyOne,
  applyAll,
  dismiss,
} = useSpellCheck(model, { online: !props.offlineOnly })

const hasIssues = computed(() => issues.value.length > 0)

const datalistId = computed(() =>
  props.listId ? `spell-suggest-${props.listId}` : '',
)

const defaultInputClass =
  'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800'
</script>

<template>
  <div class="spell-check-assist">
    <textarea
      v-if="multiline"
      v-model="model"
      :rows="rows"
      :placeholder="placeholder"
      :class="[defaultInputClass, inputClass, hasIssues ? 'ring-1 ring-amber-400/60' : '']"
      :aria-label="fieldLabel"
      spellcheck="true"
      lang="fr"
    />
    <input
      v-else
      v-model="model"
      type="text"
      :list="suggestions?.length && datalistId ? datalistId : undefined"
      :placeholder="placeholder"
      :class="[defaultInputClass, inputClass, hasIssues ? 'ring-1 ring-amber-400/60' : '']"
      :aria-label="fieldLabel"
      spellcheck="true"
      lang="fr"
    >
    <datalist
      v-if="!multiline && suggestions?.length && datalistId"
      :id="datalistId"
    >
      <option
        v-for="s in suggestions"
        :key="s"
        :value="s"
      />
    </datalist>

    <p v-if="checking" class="text-muted-foreground mt-1.5 text-xs">
      Vérification orthographique…
    </p>

    <div
      v-else-if="hasIssues"
      class="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs dark:border-amber-900/50 dark:bg-amber-950/30"
      role="status"
    >
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span class="font-medium text-amber-900 dark:text-amber-200">
          {{ issues.length }} suggestion(s) — {{ fieldLabel }}
        </span>
        <div class="flex gap-1.5">
          <button
            type="button"
            class="rounded-md bg-amber-600 px-2 py-0.5 text-white hover:bg-amber-700"
            @click="applyAll"
          >
            Tout corriger
          </button>
          <button
            type="button"
            class="rounded-md border border-amber-300 px-2 py-0.5 text-amber-900 dark:border-amber-700 dark:text-amber-200"
            @click="dismiss"
          >
            Ignorer
          </button>
        </div>
      </div>
      <ul class="max-h-32 space-y-1.5 overflow-y-auto">
        <li
          v-for="(issue, index) in issues"
          :key="`${issue.offset}-${issue.length}-${index}`"
          class="flex flex-wrap items-center gap-x-2 gap-y-1 text-amber-900 dark:text-amber-100"
        >
          <span class="text-amber-700/90 dark:text-amber-300/90">
            « <strong>{{ issue.original }}</strong> » →
          </span>
          <button
            v-for="rep in issue.replacements.slice(0, 2)"
            :key="rep"
            type="button"
            class="rounded bg-white px-1.5 py-0.5 font-medium text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-800"
            @click="applyOne(issue, rep)"
          >
            {{ rep }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
