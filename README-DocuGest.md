# DocuGest

Application de gestion de cabinet d’avocats (EMK&C / CCEAJ), basée sur [Fantastic-admin](https://fantastic-admin.hurui.me) v6.1.

## Application

- Code métier : `apps/example/`
- Stack : Vue 3, Vite, Firebase (Auth + Firestore), pnpm monorepo

## Démarrage local

```bash
pnpm install
pnpm --filter @fantastic-admin/example dev
```

Copiez `apps/example/.env.example` vers `apps/example/.env.local` et renseignez Firebase.

## Build & déploiement

```bash
pnpm run build:example
pnpm run deploy:vercel   # après vercel login
```

Voir [DEPLOIEMENT.md](./DEPLOIEMENT.md) et [GITHUB.md](./GITHUB.md).

## Licence

Fantastic-admin : voir licence du framework. Code métier DocuGest : usage interne cabinet.
