# Créer le dépôt GitHub (DocuGest)

Ce dossier doit avoir **son propre** dépôt Git, séparé de `C:\Users\enesra` (votre profil Windows ne doit pas être versionné).

## 1. Initialiser Git ici uniquement

Ouvrez PowerShell :

```powershell
cd "c:\Users\enesra\Downloads\fantastic-admin.v6.1.0"

# Si un ancien .git existe dans ce dossier :
# Remove-Item -Recurse -Force .git

git init -b main
git add .
git status
```

Vérifiez que **`apps/example/.env.local` n’apparaît pas** dans `git status`.

## 2. Premier commit

```powershell
git commit -m "Initial commit — DocuGest (Fantastic-admin example)"
```

## 3. Créer le dépôt sur GitHub

### Option A — Site GitHub (sans CLI)

1. [github.com/new](https://github.com/new)
2. Nom du dépôt : `docugest` (ou `fantastic-admin-docugest`)
3. **Private** recommandé (config Firebase dans le code build)
4. Ne cochez **pas** « Add README » (vous en avez déjà un)
5. Créez le dépôt, puis :

```powershell
git remote add origin https://github.com/Setpars/DocusGest.git
git push -u origin main
```

### Option B — GitHub CLI (`gh`)

```powershell
gh auth login
gh repo create docugest --private --source=. --remote=origin --push
```

## 4. Variables sur Vercel (après import du repo)

Dans Vercel → **Environment Variables**, ajoutez les clés de `apps/example/.env.example` (valeurs depuis votre `.env.local`) :

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_APP_TITLE`
- `VITE_BUILD_FAKE` = `false`

Le fichier `vercel.json` à la racine configure déjà le build.

## 5. Firebase — domaines autorisés

Après déploiement, ajoutez `*.vercel.app` et votre domaine dans Firebase → Authentication → Domaines autorisés.
