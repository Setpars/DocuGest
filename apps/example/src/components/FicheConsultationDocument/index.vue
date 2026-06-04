<script setup lang="ts">
import { computed } from 'vue'
import { CABINET_PRINT } from '@/constants/cabinet-print'
import type { DossierInsight } from '@/types/dossier-insight'
import {
  getFicheConsultationModel,
  splitCabinetList,
} from '@/utils/fiche-consultation-document'

defineOptions({
  name: 'FicheConsultationDocument',
})

const props = defineProps<{
  insight: DossierInsight
}>()

const cabinet = CABINET_PRINT
const maitres = computed(() => splitCabinetList(cabinet.maitres))
const telephones = computed(() => splitCabinetList(cabinet.telephones))
const model = computed(() => getFicheConsultationModel(props.insight))

function display(value: string) {
  return value.trim() || ' '
}
</script>

<template>
  <article class="fiche-doc fiche-doc--screen">
    <header class="fiche-header">
      <div class="fiche-scale" aria-hidden="true">
        ⚖
      </div>
      <div class="fiche-brand">
        <p class="fiche-sigle">
          {{ cabinet.sigle }}
        </p>
        <p class="fiche-nom">
          {{ cabinet.nom }}
        </p>
        <p class="fiche-adresse">
          {{ cabinet.adresse }}
        </p>
      </div>
      <div class="fiche-scale" aria-hidden="true">
        ⚖
      </div>
    </header>

    <div class="fiche-contact">
      <div class="fiche-contact__block">
        <span class="fiche-contact__label">Maîtres :</span>
        <p v-for="name in maitres" :key="name" class="fiche-contact__item">
          - {{ name }}
        </p>
      </div>
      <div class="fiche-contact__block fiche-contact__block--right">
        <span class="fiche-contact__label">Tél. :</span>
        <p v-for="tel in telephones" :key="tel" class="fiche-contact__item">
          {{ tel }}
        </p>
      </div>
    </div>

    <h1 class="fiche-title">
      {{ cabinet.titreFicheConsultation }}
    </h1>

    <div class="fiche-field">
      <div class="fiche-field-head">
        <span class="fiche-field-num">1.</span>Identité du client :
      </div>
      <div class="fiche-line">
        {{ display(model.clientNom) }}
      </div>
      <div class="fiche-subrow">
        <span class="fiche-subrow__item">
          <span class="fiche-subrow__label">Adresse :</span>
          {{ display(model.clientAdresse) }}
        </span>
        <span class="fiche-subrow__item">
          <span class="fiche-subrow__label">N° Tél :</span>
          {{ display(model.clientTelephone) }}
        </span>
      </div>
    </div>

    <div class="fiche-field">
      <div class="fiche-field-head">
        <span class="fiche-field-num">2.</span>Résumé de l’affaire :
      </div>
      <div class="fiche-line fiche-line--multi">
        {{ model.resumeAffaire || ' ' }}
      </div>
    </div>

    <div class="fiche-field">
      <div class="fiche-field-head">
        <span class="fiche-field-num">3.</span>Contre :
      </div>
      <div class="fiche-line">
        {{ display(model.partieEnCause) }}
      </div>
      <div class="fiche-subrow">
        <span class="fiche-subrow__item"><span class="fiche-subrow__label">Adresse :</span> ………………………………</span>
        <span class="fiche-subrow__item"><span class="fiche-subrow__label">N° Tél :</span> …………………………</span>
      </div>
    </div>

    <div class="fiche-field">
      <div class="fiche-field-head">
        <span class="fiche-field-num">4.</span>N° du dossier :
      </div>
      <div class="fiche-line">
        {{ model.numeroDossier }}
      </div>
    </div>

    <div class="fiche-field">
      <div class="fiche-field-head">
        <span class="fiche-field-num">5.</span>Juridiction ou office :
      </div>
      <div class="fiche-line">
        {{ display(model.juridiction) }}
      </div>
      <div class="fiche-subrow">
        <span class="fiche-subrow__item">
          <span class="fiche-subrow__label">Phase :</span>
          {{ display(model.phase) }}
        </span>
        <span v-if="model.avocatsEnCharge" class="fiche-subrow__item">
          <span class="fiche-subrow__label">Avocat(s) :</span>
          {{ model.avocatsEnCharge }}
        </span>
      </div>
    </div>

    <div class="fiche-field">
      <div class="fiche-field-head">
        <span class="fiche-field-num">6.</span>Date d’ouverture du dossier :
      </div>
      <div class="fiche-line">
        {{ display(model.dateOuverture) }}
      </div>
    </div>

    <div class="fiche-field">
      <div class="fiche-field-head">
        <span class="fiche-field-num">7.</span>Observations :
      </div>
      <div class="fiche-line fiche-line--multi">
        {{ model.observations || ' ' }}
      </div>
    </div>

    <section class="fiche-annexe">
      <h2 class="fiche-annexe__title">
        Pièces juridiques au dossier
      </h2>
      <table v-if="model.pieces.length > 0" class="fiche-pieces-table">
        <thead>
          <tr>
            <th>N°</th>
            <th>Désignation de la pièce</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(piece, index) in model.pieces" :key="`${piece.titre}-${index}`">
            <td>{{ index + 1 }}</td>
            <td>{{ piece.titre }}</td>
            <td>{{ piece.date }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="fiche-pieces-empty">
        Aucune pièce enregistrée pour ce dossier.
      </p>
    </section>

    <footer class="fiche-footer">
      <p class="fiche-footer-date">
        {{ cabinet.ville }}, le {{ model.dateLettre }}
      </p>
      <p class="fiche-footer-addr">
        {{ cabinet.adresseFooter }}
      </p>
    </footer>
  </article>
</template>

<style src="@/assets/styles/fiche-consultation.css"></style>
