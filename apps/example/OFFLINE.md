# Mode hors ligne (architecture retenue)

## Choix : Firestore + IndexedDB (SDK), pas de SQLite

Voir `ARCHITECTURE-WEB.md`.

| Couche | Technologie |
|--------|-------------|
| Session | **localStorage** |
| Données métier | **IndexedDB** (cache Firestore automatique) |
| Cloud | **Firestore** |

## Fonctionnement

1. **Persistance** : `enableIndexedDbPersistence` — lectures/écritures hors ligne, file d’attente des écritures.
2. **Sync explicite** : `runFirestoreSync()` — push (`waitForPendingWrites`) + pull (`getDocs` sur les collections).
3. **Métadonnées** : `localStorage` — `cabinet_last_sync_at`, erreurs de sync.
4. **Session hors ligne** : `cabinet_offline_session` — « Continuer hors ligne » sur la page login.

## Fichiers

- `src/firebase/firestore-offline.ts`
- `src/services/sync-firestore.ts`
- `src/services/local-metadata.ts`
- `src/services/offline-session.ts`
- `src/store/modules/app/offline.ts`
- `src/components/AppOfflineBanner/index.vue`

## Limites

- Première connexion / création doyen : internet requis.
- Un seul onglet actif pour la persistance Firestore (limitation Firebase).
