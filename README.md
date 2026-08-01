# AQI Warehouse Dashboard

Dashboard Next.js pour un pipeline de data engineering universitaire :
collecte horaire de la qualité de l'air (9 villes) via GitHub Actions,
modélisation en schéma en étoile, entrepôt Neon (Postgres serverless).

Public, sans authentification. Le dashboard inclut un explorateur de
données filtrable, des visualisations Tremor, une carte, une matrice de
corrélation, et une interface "Ask AI" qui traduit une question en langage
naturel en une requête SQL `SELECT` validée puis exécutée en lecture seule.

## Stack

- Next.js 14 (App Router), TypeScript strict
- Tremor (`@tremor/react`) pour tous les graphiques
- Tailwind CSS
- `pg` (node-postgres), uniquement côté serveur
- Groq SDK (`llama-3.3-70b-versatile`) pour le NL→SQL

## Setup local

1. Installer les dépendances :

   ```bash
   npm install
   ```

2. Créer `.env.local` à la racine (voir `.env.example`) :

   ```bash
   NEON_READONLY_URL=postgresql://<role_lecture_seule>:<mot_de_passe>@<host>/<db>?sslmode=require
   GROQ_API_KEY=gsk_...
   ```

   - `NEON_READONLY_URL` doit pointer vers un rôle Postgres qui n'a que le
     privilège `SELECT` sur `dim_city`, `dim_time`, `fact_aqi`. C'est la
     deuxième ligne de défense pour la fonctionnalité Ask AI (la première
     étant la validation regex du SQL généré).
   - `GROQ_API_KEY` s'obtient gratuitement sur
     [console.groq.com](https://console.groq.com) — aucune carte bancaire
     requise. Le tier gratuit inclut des limites de débit (requêtes/minute
     et tokens/minute) ; la route `/api/ask` applique une limite basique
     par IP pour rester dans ces bornes pendant une démo.

3. Lancer le serveur de développement :

   ```bash
   npm run dev
   ```

   Le dashboard est accessible sur `http://localhost:3000`.

4. Build de production (à faire avant tout déploiement) :

   ```bash
   npm run build
   npm run start
   ```

## Déploiement sur Vercel

1. Pousser le dépôt sur GitHub.
2. Importer le projet dans Vercel (New Project → sélectionner le repo).
3. Dans **Settings → Environment Variables**, ajouter :
   - `NEON_READONLY_URL`
   - `GROQ_API_KEY`
   pour les environnements Production et Preview.
4. Déployer. Vercel détecte automatiquement Next.js (aucune configuration
   de build supplémentaire n'est nécessaire).

## Sécurité

- Aucune chaîne de connexion ni clé API n'est jamais envoyée au client :
  toutes les requêtes DB et les appels Groq se font dans des Server
  Components ou des Route Handlers (`app/api/**/route.ts`).
- Le rôle Postgres utilisé (`NEON_READONLY_URL`) doit être en lecture
  seule au niveau de la base — indépendamment de la validation applicative.
- La route `/api/ask` rejette tout ce qui n'est pas un unique `SELECT`
  (regex + refus des mots-clés de mutation), et plafonne les lignes
  retournées à 500.
- La conversation de la page "Ask AI" vit uniquement dans le
  `sessionStorage` du navigateur : jamais persistée côté serveur, jamais
  envoyée dans une base ou un fichier de logs applicatif.

## Structure du projet

Voir l'arborescence complète dans le prompt d'origine — `app/` pour les
pages et routes API, `components/` pour l'UI, `lib/` pour l'accès aux
données, la logique de filtres et l'intégration Groq.
