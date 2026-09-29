import type { Metadata } from "next";
import DataFlowDiagram from "@/components/architecture/DataFlowDiagram";

export const metadata: Metadata = {
  title: "Architecture — AQI Warehouse",
  description:
    "Comment les données arrivent dans l'entrepôt, comment le dashboard les lit, et comment Ask AI traduit une question en SQL.",
};

const SECTIONS = [
  {
    title: "D'où viennent les données",
    body: [
      "Un workflow GitHub Actions planifié toutes les heures appelle l'API OpenWeather Air Pollution pour les 9 villes suivies, transforme la réponse (un objet par ville et par polluant) et la charge dans l'entrepôt. Chaque ligne de fact_aqi est donc un relevé, pas une moyenne : la dimension temporelle dim_time porte le timestamp, la date, l'heure, le jour de la semaine et l'indicateur week-end.",
      "Le dashboard netrigger aucune collecte. Il lit un entrepôt que le pipeline remplit tout seul, ce qui rend les chiffres reproductibles et la page indépendante de l'API externe.",
    ],
  },
  {
    title: "Comment le dashboard lit l'entrepôt",
    body: [
      "Chaque page est un Server Component Next.js. Il appelle une fonction de lib/queries.ts, qui utilise un pool pg (node-postgres) pour exécuter du SQL paramétré sur Neon. Le pool est mis en cache sur global pour ne pas rouvrir une connexion à chaque requête, et les erreurs transitoires sont retentées une fois.",
      "La chaîne de connexion et la clé Groq sont des variables d'environnement lues uniquement côté serveur. Elles ne sont jamais incluses dans le HTML ni dans un bundle : le navigateur reçoit du texte déjà rendu et appelle l'API par chemin (/api/ask, /api/export), pas par URL de base.",
      "Le rôle Postgres utilisé est en lecture seule. C'est la vraie frontière de sécurité : même si la validation applicative était contournée, la base refuserait l'écriture.",
    ],
  },
  {
    title: "Comment Ask AI obtient ses données",
    body: [
      "Le modèle de langage n'a aucun accès à la base. C'est le serveur qui l'interroge. Le trajet d'une question comporte deux appels réseau sortants, dans cet ordre :",
      "Groq reçoit la question, le schéma de l'entrepôt et l'historique de conversation, et renvoie une requête SQL. Le serveur ne l'exécute pas immédiatement : il la nettoie, vérifie qu'il s'agit d'un unique SELECT, que les tables utilisées font partie du schéma en étoile, qu'aucune fonction système n'est appelée et qu'un LIMIT borne le résultat.",
      "Postgres exécute la requête validée, en lecture seule, avec un statement_timeout. Si elle échoue pour une raison corrigeable — une colonne mal orthographiée, une faute de syntaxe — le message d'erreur est renvoyé au modèle qui réécrit la requête, une seule fois.",
      "Groq reçoit ensuite une trentaine de lignes et rédige une réponse en français, transmise au navigateur en NDJSON : le SQL s'affiche dès qu'il est validé, le texte arrive au fur et à mesure.",
    ],
  },
  {
    title: "Ce que le client ne voit jamais",
    body: [
      "Ni la chaîne de connexion, ni la clé API, ni le SQL exécuté par les autres pages, ni les résultats bruts des requêtes internes. Le seul échange du navigateur est un POST vers /api/ask et un GET vers /api/export.",
      "La conversation elle-même vit dans le sessionStorage de l'onglet : elle n'est ni persistée côté serveur, ni envoyée dans un log applicatif. Recharger l'onglet la fait disparaître.",
    ],
  },
];

export default function ArchitecturePage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <p className="text-sm text-ink-600">
        Trois chemins distincts, trois questions différentes : d'où viennent les chiffres, comment
        la page les obtient, et comment Ask AI transforme une phrase en requête. Aucun des trois ne
        passe par le navigateur.
      </p>

      <DataFlowDiagram />

      <div className="space-y-5 pt-2">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h3 className="font-display text-base text-ink-950 mb-1.5">{s.title}</h3>
            <div className="space-y-2">
              {s.body.map((p, i) => (
                <p key={i} className="text-sm text-ink-600 leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="border border-ink-200 rounded-lg bg-ink-100 p-5">
        <h3 className="font-display text-base text-ink-950 mb-2">Vérifier l'état des dépendances</h3>
        <p className="text-sm text-ink-600 mb-3">
          Une route de diagnostic teste Neon et Groq et renvoie uniquement des booléens, des
          identifiants de modèles et des nombres de lignes. Elle est désactivée tant que la variable
          d'environnement DIAGNOSTICS_TOKEN n'est pas définie, et ne répond qu'à qui fournit ce
          jeton.
        </p>
        <pre className="text-[11px] font-mono bg-ink-50 border border-ink-200 text-ink-800 p-3 rounded-lg overflow-x-auto">
          {`curl "https://<votre-domaine>/api/diagnostics?token=$DIAGNOSTICS_TOKEN"`}
        </pre>
      </section>
    </div>
  );
}
