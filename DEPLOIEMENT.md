# DocuGest — Git et déploiement

Application **Vue 3** (`apps/example`) du monorepo Fantastic-admin. Hébergement recommandé : **Vercel** (gratuit) ou **Netlify**.

## Prérequis

- [Node.js](https://nodejs.org/) 20.19+ ou 22+ (voir `.nvmrc`)
- [pnpm](https://pnpm.io/) 10+ (`corepack enable`)
- Compte [Firebase](https://console.firebase.google.com/) (Auth + Firestore)
- Compte [GitHub](https://github.com/) + [Vercel](https://vercel.com/) ou [Netlify](https://www.netlify.com/)

## 1. Préparer le dépôt Git

> **Important** : initialisez Git **dans ce dossier** (`fantastic-admin.v6.1.0`), pas dans votre dossier utilisateur Windows, pour éviter de versionner tout le PC.

```powershell
cd "C:\Users\enesra\Downloads\fantastic-admin.v6.1.0"
git init
git add .
git status
```

Vérifiez que `apps/example/.env.local` n’apparaît **pas** dans `git status`. S’il est listé :

```powershell
git rm --cached apps/example/.env.local
```

Premier commit :

```powershell
git commit -m "Initial commit — DocuGest (Fantastic-admin example)"
```

Lier un dépôt distant (remplacez par votre URL) :

```powershell
git branch -M main
git remote add origin https://github.com/VOTRE_COMPTE/docugest.git
git push -u origin main
```

## 2. Variables d’environnement

Les clés `VITE_*` sont injectées **au moment du build**. Copiez `apps/example/.env.example` vers `apps/example/.env.local` en local.

| Variable | Description |
|----------|-------------|
| `VITE_APP_TITLE` | Titre affiché |
| `VITE_FIREBASE_*` | Config Firebase Web (6 variables) |
| `VITE_BUILD_FAKE` | `false` en production (Firestore réel) |

Ne commitez jamais `.env.local`.

## 3. Build local (test avant déploiement)

À la racine du monorepo :

```powershell
pnpm install
pnpm run build:example
```

Sortie : `apps/example/dist/`

Prévisualisation :

```powershell
pnpm --filter @fantastic-admin/example run serve
```

## 4. Déploiement sur Vercel (recommandé)

1. [vercel.com](https://vercel.com) → **Add New Project** → importer le dépôt GitHub.
2. **Root Directory** : laisser la racine du repo (où se trouve `vercel.json`).
3. Vercel détecte `vercel.json` :
   - Install : `corepack enable && pnpm install`
   - Build : `pnpm run build:example`
   - Output : `apps/example/dist`
4. **Environment Variables** (Production) — ajouter toutes les clés de `apps/example/.env.example`, surtout les 6 `VITE_FIREBASE_*`.
5. **Deploy**.

Après déploiement, dans Firebase Console → **Authentication** → **Authorized domains**, ajoutez votre domaine Vercel (`*.vercel.app` et le domaine personnalisé).

### Routage SPA

`vercel.json` redirige toutes les routes vers `index.html` (mode history Vue Router).

## 5. Déploiement sur Netlify (alternative)

1. **Add new site** → GitHub → même dépôt.
2. Le fichier `netlify.toml` à la racine configure build et redirections.
3. Ajouter les variables d’environnement dans **Site settings → Environment variables**.
4. Domaine autorisé Firebase : ajouter `*.netlify.app`.

## 6. Cloudflare Pages (option)

- **Build command** : `pnpm install && pnpm run build:example`
- **Build output directory** : `apps/example/dist`
- **Node version** : 22
- Variables d’environnement : identiques à Vercel.

## 7. Firebase (sécurité)

- Règles Firestore et Storage adaptées à votre usage.
- Domaines autorisés pour Auth alignés avec l’URL de production.
- Les clés `VITE_FIREBASE_*` sont publiques côté client ; la sécurité repose sur les **règles Firebase**, pas sur le secret de la clé API.

## 8. Dépannage

| Problème | Piste |
|----------|--------|
| Build échoue sur `VITE_FIREBASE_*` | Variables manquantes dans le tableau de bord hébergeur |
| Page blanche après refresh | Rewrites SPA (`vercel.json` / `netlify.toml`) |
| `pnpm` introuvable sur Vercel | `corepack enable` (déjà dans `vercel.json`) |
| Données mock au lieu de Firestore | `VITE_BUILD_FAKE=false` en production |
| Hooks pre-commit en CI | Normal en local ; Vercel n’exécute pas les commits |

## Scripts utiles

| Commande | Rôle |
|----------|------|
| `pnpm dev` | Menu interactif → lancer `example` |
| `pnpm --filter @fantastic-admin/example dev` | Dev direct (port 9000) |
| `pnpm run build:example` | Build production |
| `pnpm lint` | Vérifications TypeScript / ESLint |
