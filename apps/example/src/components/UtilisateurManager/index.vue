<script setup lang="ts">
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
} from 'firebase/firestore'
import { computed, onMounted, ref } from 'vue'
import { db } from '@/firebase'
import {
  AuthFirebaseError,
  createUserAccountAsAdmin,
  sendUserPasswordReset,
  updateUserProfile,
} from '@/services/auth-firebase'
import { ROLE_LABELS, type AppUser, type AppUserForm, type AppUserRole } from '@/types/auth'
import { formatDateFr } from '@/utils/date'
import { writeAuditLog } from '@/utils/audit-log'
import { rebuildLoginDirectoryFromUsers, removeLoginDirectoryEntry } from '@/utils/login-directory'
import { assertPasswordPolicy, PASSWORD_POLICY_HINT } from '@/utils/password-policy'

defineOptions({
  name: 'UtilisateurManager',
})

const usersCol = collection(db, 'utilisateurs')
const accountStore = useAppAccountStore()

const users = ref<AppUser[]>([])
const loading = ref(false)
const saving = ref(false)
const search = ref('')
const showForm = ref(false)
const isEdit = ref(false)

const isDoyen = computed(() => accountStore.role === 'doyen')

const toast = ref({
  show: false,
  type: 'success' as 'success' | 'error',
  message: '',
})

const form = ref<AppUserForm>({
  id: null,
  email: '',
  nom: '',
  role: 'secretaire',
  password: '',
  actif: true,
})

const roleOptions: AppUserRole[] = ['secretaire', 'doyen', 'finance']

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { show: true, type, message }
  setTimeout(() => { toast.value.show = false }, 4000)
}

function mapUser(docSnap: { id: string, data: () => Record<string, unknown> }): AppUser {
  const data = docSnap.data()
  const role = String(data.role ?? 'secretaire') as AppUserRole
  return {
    id: docSnap.id,
    email: String(data.email ?? ''),
    nom: String(data.nom ?? ''),
    role: roleOptions.includes(role) ? role : 'secretaire',
    actif: data.actif !== false,
    createdAt: String(data.createdAt ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
  }
}

async function loadUsers() {
  if (!isDoyen.value) return
  loading.value = true
  try {
    const snap = await getDocs(usersCol)
    users.value = snap.docs.map(mapUser).sort((a, b) => a.email.localeCompare(b.email, 'fr'))
    void rebuildLoginDirectoryFromUsers().catch(() => {})
  } catch {
    showToast('error', 'Impossible de charger les utilisateurs')
  } finally {
    loading.value = false
  }
}

onMounted(loadUsers)

const filteredUsers = computed(() =>
  users.value.filter(u =>
    [u.email, u.nom, ROLE_LABELS[u.role]].join(' ').toLowerCase().includes(search.value.toLowerCase()),
  ),
)

function resetForm() {
  form.value = {
    id: null,
    email: '',
    nom: '',
    role: 'secretaire',
    password: '',
    actif: true,
  }
}

function openAdd() {
  if (!isDoyen.value) return
  isEdit.value = false
  resetForm()
  showForm.value = true
}

function openEdit(u: AppUser) {
  if (!isDoyen.value) return
  isEdit.value = true
  form.value = {
    id: u.id,
    email: u.email,
    nom: u.nom,
    role: u.role,
    password: '',
    actif: u.actif,
  }
  showForm.value = true
}

function closeForm() {
  showForm.value = false
}

async function save() {
  if (!isDoyen.value) {
    showToast('error', 'Seul le doyen peut gérer les comptes utilisateurs')
    return
  }

  const email = form.value.email.trim().toLowerCase()
  if (!email || !form.value.nom.trim()) {
    showToast('error', 'E-mail et nom sont obligatoires')
    return
  }
  if (!isEdit.value) {
    try {
      assertPasswordPolicy(form.value.password)
    } catch (e) {
      showToast('error', (e as Error).message)
      return
    }
  }

  const duplicate = users.value.find(
    u => u.email.toLowerCase() === email && u.id !== form.value.id,
  )
  if (duplicate) {
    showToast('error', 'Cet e-mail est déjà utilisé')
    return
  }

  saving.value = true
  try {
    if (isEdit.value && form.value.id) {
      await updateUserProfile(form.value.id, {
        nom: form.value.nom,
        role: form.value.role,
        actif: form.value.actif,
        email,
      })
      showToast('success', 'Utilisateur mis à jour')
      await writeAuditLog({
        action: 'modification',
        entity: 'utilisateur',
        entityId: form.value.id,
        details: `${email} — ${ROLE_LABELS[form.value.role]}`,
      })
    } else {
      const uid = await createUserAccountAsAdmin({
        email,
        password: form.value.password,
        nom: form.value.nom,
        role: form.value.role,
        actif: form.value.actif,
      })
      await writeAuditLog({
        action: 'creation',
        entity: 'utilisateur',
        entityId: uid,
        details: `Création ${email} (${ROLE_LABELS[form.value.role]})`,
      })
      showToast('success', 'Compte Firebase créé avec le rôle sélectionné')
    }
    closeForm()
    await loadUsers()
  } catch (err) {
    if (err instanceof AuthFirebaseError) {
      showToast('error', err.message)
    } else {
      showToast('error', 'Erreur lors de l’enregistrement')
    }
  } finally {
    saving.value = false
  }
}

async function remove(u: AppUser) {
  if (!isDoyen.value) return
  if (u.id === accountStore.userId) {
    showToast('error', 'Vous ne pouvez pas supprimer votre propre compte')
    return
  }
  if (!window.confirm(
    `Retirer le profil de « ${u.email} » ? Le compte Firebase Auth reste actif : désactivez-le ou supprimez-le dans la console Firebase si nécessaire.`,
  )) return
  try {
    await deleteDoc(doc(db, 'utilisateurs', u.id))
    await removeLoginDirectoryEntry(u.email)
    await writeAuditLog({
      action: 'suppression',
      entity: 'utilisateur',
      entityId: u.id,
      details: `Profil supprimé ${u.email}`,
    })
    showToast('success', 'Profil utilisateur supprimé')
    await loadUsers()
  } catch {
    showToast('error', 'Erreur lors de la suppression')
  }
}

async function toggleActif(u: AppUser) {
  if (!isDoyen.value) return
  if (u.id === accountStore.userId && u.actif) {
    showToast('error', 'Vous ne pouvez pas désactiver votre propre compte')
    return
  }
  try {
    await updateUserProfile(u.id, { actif: !u.actif })
    await writeAuditLog({
      action: 'modification',
      entity: 'utilisateur',
      entityId: u.id,
      details: u.actif ? `Désactivation ${u.email}` : `Activation ${u.email}`,
    })
    await loadUsers()
  } catch {
    showToast('error', 'Impossible de modifier le statut')
  }
}

async function sendReset(u: AppUser) {
  try {
    await sendUserPasswordReset(u.email)
    showToast('success', `E-mail de réinitialisation envoyé à ${u.email}`)
  } catch (err) {
    if (err instanceof AuthFirebaseError) {
      showToast('error', err.message)
    } else {
      showToast('error', 'Envoi impossible')
    }
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div
      v-if="toast.show"
      class="fixed right-6 top-6 z-[9999] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg"
      :class="toast.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'"
    >
      {{ toast.message }}
    </div>

    <div v-if="!isDoyen" class="mx-auto max-w-2xl p-12 text-center">
      <p class="text-lg font-medium text-rose-600">
        Accès réservé au doyen (administration).
      </p>
    </div>

    <div v-else class="mx-auto max-w-7xl p-6">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <div>
          <h1 class="text-2xl font-semibold">Utilisateurs & rôles</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Création des comptes Firebase (e-mail / mot de passe) et attribution du type : secrétaire, doyen ou finances.
          </p>
        </div>
        <button
          type="button"
          class="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          @click="openAdd"
        >
          + Nouvel utilisateur
        </button>
      </div>

      <div class="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <input
          v-model="search"
          placeholder="Rechercher par e-mail, nom…"
          class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-500 md:max-w-md dark:border-slate-700 dark:bg-slate-800"
        >
      </div>

      <div class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <div v-if="loading" class="p-8 text-center text-slate-500">
          Chargement…
        </div>
        <div v-else-if="filteredUsers.length === 0" class="p-12 text-center text-slate-500">
          Aucun utilisateur.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th class="px-6 py-3">E-mail</th>
                <th class="px-6 py-3">Nom</th>
                <th class="px-6 py-3">Type de compte</th>
                <th class="px-6 py-3">Statut</th>
                <th class="px-6 py-3">Créé le</th>
                <th class="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
              <tr v-for="u in filteredUsers" :key="u.id" class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td class="px-6 py-4 font-medium">{{ u.email }}</td>
                <td class="px-6 py-4">{{ u.nom }}</td>
                <td class="px-6 py-4">
                  <span class="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">
                    {{ ROLE_LABELS[u.role] }}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <button
                    type="button"
                    class="rounded-full px-2.5 py-1 text-xs font-medium"
                    :class="u.actif ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'"
                    @click="toggleActif(u)"
                  >
                    {{ u.actif ? 'Actif' : 'Inactif' }}
                  </button>
                </td>
                <td class="px-6 py-4 text-slate-500">
                  {{ u.createdAt ? formatDateFr(u.createdAt) : '—' }}
                </td>
                <td class="px-6 py-4 text-right">
                  <div class="flex flex-wrap justify-end gap-2">
                    <button type="button" class="rounded-lg bg-slate-100 px-3 py-1.5 text-sm dark:bg-slate-800" @click="sendReset(u)">
                      Réinit. MDP
                    </button>
                    <button type="button" class="rounded-lg bg-slate-100 px-3 py-1.5 text-sm dark:bg-slate-800" @click="openEdit(u)">
                      Modifier
                    </button>
                    <button type="button" class="rounded-lg bg-rose-100 px-3 py-1.5 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" @click="remove(u)">
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="mt-6 grid gap-4 md:grid-cols-3">
        <div v-for="r in roleOptions" :key="r" class="rounded-xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <h3 class="font-semibold text-slate-800 dark:text-slate-100">{{ ROLE_LABELS[r] }}</h3>
          <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
            <template v-if="r === 'secretaire'">Dossiers (clients intégrés), agenda, pièces juridiques, notes honoraires</template>
            <template v-else-if="r === 'doyen'">Avocats (détail dossiers, historique), rapports BI, utilisateurs, audit</template>
            <template v-else>Paiements et suivi financier</template>
          </p>
        </div>
      </div>
    </div>

    <AppModalOverlay :open="showForm && isDoyen" max-width="max-w-lg" @close="closeForm">
      <div class="app-modal-overlay__body p-6">
        <h2 class="mb-4 text-lg font-semibold">
          {{ isEdit ? 'Modifier l’utilisateur' : 'Nouvel utilisateur (Firebase Auth)' }}
        </h2>
        <form class="space-y-4" @submit.prevent="save">
          <div>
            <label class="mb-1 block text-sm font-medium">E-mail (connexion)</label>
            <input
              v-model="form.email"
              type="email"
              :disabled="isEdit"
              class="w-full rounded-xl border px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800"
              required
            >
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Nom complet</label>
            <input v-model="form.nom" class="w-full rounded-xl border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" required>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Type de compte</label>
            <select v-model="form.role" class="w-full rounded-xl border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
              <option v-for="r in roleOptions" :key="r" :value="r">
                {{ ROLE_LABELS[r] }}
              </option>
            </select>
          </div>
          <div v-if="!isEdit">
            <label class="mb-1 block text-sm font-medium">Mot de passe initial</label>
            <input
              v-model="form.password"
              type="password"
              class="w-full rounded-xl border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              required
              placeholder="Mot de passe sécurisé"
            >
            <p class="mt-1 text-xs text-slate-500">
              {{ PASSWORD_POLICY_HINT }}
            </p>
          </div>
          <p v-else class="text-xs text-slate-500">
            Pour changer le mot de passe, utilisez le bouton « Réinit. MDP » (e-mail Firebase).
          </p>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.actif" type="checkbox" class="rounded">
            Compte actif (connexion autorisée)
          </label>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="rounded-xl px-4 py-2 text-sm ring-1 ring-slate-300" @click="closeForm">
              Annuler
            </button>
            <button type="submit" class="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white" :disabled="saving">
              {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
          </div>
        </form>
      </div>
    </AppModalOverlay>
  </div>
</template>
