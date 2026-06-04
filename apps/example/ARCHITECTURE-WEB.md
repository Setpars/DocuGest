# Architecture 100 % web (choix retenu)

## Décision

**Option retenue : renforcer Firestore + persistance IndexedDB** (pas de SQLite, pas de seconde base Dexie).

| Stockage | Usage |
|----------|--------|
| **localStorage** | Session utilisateur, métadonnées de sync (`lastSyncAt`), préférences légères |
| **IndexedDB** | Cache et file d’attente **gérés par le SDK Firestore** (`enableIndexedDbPersistence`) |
| **Firestore** | Base cloud partagée entre postes |

## Pourquoi pas une IndexedDB « métier » séparée ?

- Duplication des données (Firestore cache + Dexie) = risque de conflits et plus de code.
- Le SDK Firestore couvre déjà lecture/écriture hors ligne et sync automatique.
- Aligné avec votre stack actuelle (Vue + Firebase).

## Flux

```
Vue (écrans) → Firestore SDK → IndexedDB (cache + pending writes) ⇄ Firestore cloud
Pinia / Auth → localStorage (session + lastSyncAt)
```

## Fichiers clés

- `src/firebase/firestore-offline.ts` — persistance IndexedDB
- `src/services/sync-firestore.ts` — synchronisation explicite au retour réseau
- `src/services/local-metadata.ts` — horodatages dans localStorage
- `src/services/offline-session.ts` — session hors ligne
- `src/store/modules/app/offline.ts` — état réseau + sync

## Évolution possible

Les vues peuvent migrer progressivement vers `src/services/repositories/*` pour centraliser les appels Firestore sans changer le stockage sous-jacent.
