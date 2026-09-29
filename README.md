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
   GROQ_MODEL=openai/gpt-oss-120b
   DIAGNOSTICS_TOKEN=<secret_aleatoire>
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
   - `GROQ_MODEL` désigne le modèle utilisé pour la traduction
     question → SQL et pour la rédaction du résumé. La valeur par défaut est
     `openai/gpt-oss-120b`. **Si le modèle configuré n'est plus disponible
     chez Groq, l'application bascule automatiquement sur
     `openai/gpt-oss-20b`**, puis signale l'erreur si aucun des deux ne
     répond. (`llama-3.3-70b-versatile`, utilisé initialement, a été retiré
     du tier gratuit le 16/08/2026.)
   - `DIAGNOSTICS_TOKEN` active `/api/diagnostics`. Laissée vide, la route
     renvoie 404.

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

## Qualité du code

```bash
npm run lint     # ESLint : next/core-web-vitals + règles TypeScript
npx tsc --noEmit # vérification de types seule
```

`.eslintrc.js` étend `next/core-web-vitals` (règles React qui ont un impact
réel : images, hooks, keys) et ajoute `plugin:@typescript-eslint/recommended`
**uniquement sur les fichiers `.ts` / `.tsx`** — `next/core-web-vitals` ne
fournit que le parser, pas les règles.

Deux choix méritent une explication, parce qu'ils désactivent volontairement
une règle :

- `react/no-unescaped-entities` est **désactivée**. L'interface est en
  français : « l'entrepôt », « d'où », « n'a » sont la forme correcte, et les
  écrire `&apos;` rendrait la source illisible. La règle protège contre une
  injection de HTML, pas contre l'apostrophe.
- `@typescript-eslint/no-explicit-any` est en **avertissement** et non en
  erreur : elle signale un point où le typage a été abandonné sans bloquer le
  build. Le projet est en TypeScript `strict`, donc `any` est un indicateur
  utile — mais un avertissement qui casse `npm run build` sur une base de code
  existante n'est pas un garde-fou, c'est un mur.

`next build` exécute le lint avant de compiler : un avertissement n'arrête pas
le build, une erreur si.

## Déploiement sur Vercel

1. Pousser le dépôt sur GitHub.
2. Importer le projet dans Vercel (New Project → sélectionner le repo).
3. Dans **Settings → Environment Variables**, ajouter :
   - `NEON_READONLY_URL`
   - `GROQ_API_KEY`
   - `GROQ_MODEL` (optionnel, défaut `openai/gpt-oss-120b`)
   - `DIAGNOSTICS_TOKEN` (optionnel, active `/api/diagnostics`)
   pour les environnements Production et Preview. Une variable ajoutée
   uniquement à un des deux environnements est la cause la plus fréquente
   d'un 500 en production alors que tout fonctionne en local.
4. Déployer. Vercel détecte automatiquement Next.js (aucune configuration
   de build supplémentaire n'est nécessaire).

## Architecture et flux de données

Le schéma détaillé est affiché dans l'application, page **Architecture**.

### Collecte (hors application)

```
OpenWeather Air Pollution API
        │  HTTPS, une requête par ville
        ▼
GitHub Actions  ── cron horaire, transformation, contrôle qualité
        │  TLS
        ▼
Neon  ──  dim_city · dim_time · fact_aqi
```

Le dashboard ne déclenche jamais de collecte. Il lit un entrepôt que le
pipeline remplit seul, donc les chiffres sont reproductibles et aucune page ne
dépend de la disponibilité de l'API externe.

### Lecture du dashboard

Chaque page est un **Server Component**. Elle appelle `lib/queries.ts`, qui
exécute du SQL paramétré via un pool `pg` mis en cache sur `global`. La
chaîne de connexion est lue depuis l'environnement du serveur et n'est jamais
sérialisée dans le HTML : le navigateur reçoit du texte déjà rendu. Les
requêtes de l'UI utilisent `queryWithRetry`, qui retenté une fois les erreurs
réseau transitoires.

### « Ask AI » : deux sauts réseau

```
navigateur  ──POST /api/ask──▶  Route Handler (serveur)
                                    │
              saut 1 ───────────────┤  Groq : question + schéma → SQL
                                    │  validateSelectOnly()      ← contrôle 1
                                    │
              saut 2 ───────────────┤  Neon : exécution du SELECT, rôle lecture seule
                                    │  ← contrôle 2 : privilèges SQL de la base
                                    │
                                    │  Groq : rédaction du résumé
                                    ▼
navigateur  ◀── NDJSON stream ───  réponse
```

Points à retenir pour une présentation :

- **Le modèle n'a aucun accès à la base.** C'est le serveur qui l'interroge.
- Le SQL est validé **avant** exécution : `SELECT` unique, tables limitées à
  `fact_aqi` / `dim_city` / `dim_time` (plus les CTE déclarées), aucun objet
  système (`pg_catalog`, `information_schema`, `pg_sleep`…), `LIMIT` borné à
  500, un seul `statement_timeout` de 8 s côté Postgres.
- Si PostgreSQL rejette la requête pour une raison corrigeable, l'erreur est
  renvoyée au modèle qui la réécrit : **une colonne inventée devient une
  réparation, pas un échec**.
- La réponse est un flux NDJSON (`status`, `sql`, `rows`, `delta`, `done`,
  `error`) : le SQL s'affiche dès qu'il est validé, le texte arrive au fur et
  à mesure.

## Sécurité

- Aucune chaîne de connexion ni clé API n'est jamais envoyée au client :
  toutes les requêtes DB et les appels Groq se font dans des Server
  Components ou des Route Handlers (`app/api/**/route.ts`).
- Le rôle Postgres utilisé (`NEON_READONLY_URL`) doit être en lecture
  seule au niveau de la base — indépendamment de la validation applicative.
- La route `/api/ask` rejette tout ce qui n'est pas un unique `SELECT`
  (regex + refus des mots-clés de mutation), et plafonne les lignes
  retournées à 500.
- Le pool Postgres porte un `statement_timeout` (8 s) et un `query_timeout`
  (10 s) : une requête générée ne peut pas consommer tout le budget de la
  fonction.
- Aucune réponse d'erreur ne renvoie de trace d'exécution, de DSN ni de clé.
  Chaque échec est réduit à un statut HTTP et à un code stable
  (`ai_rate_limited`, `ai_model_unavailable`, `sql_rejected`, …).
- `/api/diagnostics` est comparé en temps constant à `DIAGNOSTICS_TOKEN` et
  renvoie des booléens, des identifiants de modèles et des nombres de lignes
  — jamais de secret.
- La conversation de la page "Ask AI" vit uniquement dans le
  `sessionStorage` du navigateur : jamais persistée côté serveur, jamais
  envoyée dans une base ou un fichier de logs applicatif.
- Le rate limiter de `lib/ai.ts` est **volontairement décrit comme tel** :
  c'est une `Map` en mémoire, donc ineffective entre deux instances
  serverless. Ce n'est pas une frontière de sécurité ; les frontières réelles
  sont le rôle Postgres, la validation SQL et le quota Groq.

## Dépannage

| Symptôme | Cause probable | Vérification |
| --- | --- | --- |
| `/api/ask` renvoie 500 « Impossible de générer une réponse… » | le modèle configuré n'existe plus chez le fournisseur | `GET /api/diagnostics?token=…` → `ai.usable` ; le champ `code` de la réponse vaut `ai_model_unavailable` |
| 503 `ai_misconfigured` | `GROQ_API_KEY` absent dans l'environnement déployé | variables d'environnement Vercel, Preview **et** Production |
| 429 `ai_rate_limited` | quota Groq ou limite par IP atteinte | réessayer après le `Retry-After` |
| 422 `sql_rejected` | le modèle a produit autre chose qu'un `SELECT` conforme | lire le SQL renvoyé dans la réponse |
| Erreurs React 418 / 423 / 425 en console | rendu serveur et client différents | aucun `toLocaleString` ne doit être appelé dans un composant client ; formater via `lib/format.ts` sur le serveur |

Les erreurs 418/423/425 apparaissent **uniquement en build de production** :
`next dev` utilise la version de développement de React et ne signale pas les
mismatches de la même façon. `npm run build && npm run start` en local
reproduit le comportement de Vercel.

## Structure du projet

Voir l'arborescence complète dans le prompt d'origine — `app/` pour les
pages et routes API, `components/` pour l'UI, `lib/` pour l'accès aux
données, la logique de filtres et l'intégration Groq.

| Fichier | Rôle |
| --- | --- |
| `lib/db.ts` | pool `pg`, timeouts, retry des erreurs transitoires |
| `lib/queries.ts` | SQL paramétré des pages, un filtrage → une clause `WHERE` |
| `lib/ai.ts` | client Groq, génération et validation du SQL, réparation, erreurs |
| `lib/format.ts` | formatage de dates UTC, appelé **côté serveur uniquement** |
| `lib/rows.ts` | normalisation des lignes Postgres et export CSV |
| `.eslintrc.js` | règles ESLint et justification des deux exceptions |
| `app/api/ask/route.ts` | Ask AI : flux NDJSON |
| `app/api/diagnostics/route.ts` | sonde Neon + Groq, protégée par `DIAGNOSTICS_TOKEN` |
