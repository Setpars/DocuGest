# Authentification Firebase (cabinet)

## Variables d’environnement (`.env.local`)

Les identifiants Firebase **ne sont plus dans le code source**. Ils sont dans :

`apps/example/.env.local` (fichier **privé**, ignoré par Git via `*.local`)

1. Copiez le modèle : `apps/example/.env.example` → `apps/example/.env.local`
2. Renseignez les clés depuis la console Firebase → *Paramètres du projet* → *Vos applications*
3. Redémarrez `pnpm dev` après toute modification

> Note : ce n’est pas un « venv » Python, mais un fichier **`.env.local`** (standard Vite).

## Mots de passe

- Stockage : **Firebase Authentication** (hachage côté Google, jamais en clair dans Firestore).
- Politique à la création / modification :
  - 8 caractères minimum
  - 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial
- Indicateur de force : composant `FaPasswordStrength` sur l’installation doyen et le changement de mot de passe.

## Connexion Google

1. Console Firebase → **Authentication** → **Sign-in method** → activer **Google**.
2. Ajouter l’origine autorisée si besoin : `http://localhost:5173` (dev) et votre domaine de production.
3. Sur la page de connexion : bouton **Continuer avec Google**.

**Règle d’accès** : le compte Google doit correspondre à un utilisateur autorisé :

- profil Firestore `utilisateurs/{uid}` déjà créé par le doyen, **ou**
- même **e-mail** qu’un utilisateur créé par le doyen (liaison automatique au premier login Google).

## Fonctionnement

- **Connexion** : Firebase Authentication (Google ou e-mail + mot de passe).
- **Rôle / type de compte** : document Firestore `utilisateurs/{uid}` où `uid` = identifiant Firebase Auth.
- **Création de comptes** : réservée au **doyen** dans *Gestion → Utilisateurs*.

## Premier administrateur (doyen)

1. Console Firebase → **Authentication** → activer **E-mail/Mot de passe**.
2. Au **premier lancement** de l’application, l’écran *Installation du cabinet* permet de créer le compte doyen (e-mail + mot de passe + nom).
3. Les visites suivantes affichent la page de connexion classique.
4. Le doyen crée ensuite les comptes secrétaire et finances via *Gestion → Utilisateurs*.

## Règles Firestore (recommandé)

À adapter selon votre politique de sécurité :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function userDoc() { return get(/databases/$(database)/documents/utilisateurs/$(request.auth.uid)); }
    function isDoyen() { return isSignedIn() && userDoc().data.role == 'doyen' && userDoc().data.actif == true; }
    function isActiveUser() { return isSignedIn() && userDoc().data.actif == true; }

    match /utilisateurs/{userId} {
      allow read: if isSignedIn() && (request.auth.uid == userId || isDoyen());
      allow write: if isDoyen();
    }

  // Annuaire public (e-mail + nom) pour la liste de connexion — sans mot de passe
    match /login_directory/{emailId} {
      allow read: if true;
      allow write: if isDoyen();
    }

    match /dossier_documents/{docId} {
      allow read, write: if isActiveUser();
    }

    match /piece_modeles/{modeleId} {
      allow read, write: if isActiveUser();
    }

    match /dossiers/{dossierId} {
      allow read, write: if isActiveUser();
    }

    match /clients/{clientId} {
      allow read, write: if isActiveUser();
    }

    match /paiements/{paiementId} {
      allow read, write: if isActiveUser();
    }

    match /audit_logs/{logId} {
      allow read: if isDoyen();
      allow create: if isActiveUser();
    }

    match /{document=**} {
      allow read, write: if isActiveUser();
    }
  }
}
```

> **Erreur 403 dans l’app** : soit la page n’est pas autorisée pour votre rôle (écran « 403 »), soit Firestore renvoie `permission-denied` (bannière rouge sur la page). Reconnectez-vous après changement de rôle.

## Types de compte

| Rôle        | Accès principal                                      |
|-------------|------------------------------------------------------|
| secretaire  | Clients, dossiers, pièces juridiques, agenda, notes honoraires |
| doyen       | Avocats, BI, utilisateurs, audit                     |
| finance     | Paiements                                            |
