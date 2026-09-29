const INK = {
  box: "border-ink-200 bg-ink-100",
  accent: "border-primary-500/40 bg-primary-500/10",
  badge: "bg-primary-500/15 text-primary-300",
};

function Node({
  title,
  subtitle,
  kind = "default",
}: {
  title: string;
  subtitle: string;
  kind?: "default" | "accent";
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 min-w-[150px] ${
        kind === "accent" ? INK.accent : INK.box
      }`}
    >
      <p className="font-mono text-[11px] text-ink-950 leading-tight">{title}</p>
      <p className="text-[10px] text-ink-500 mt-0.5 leading-snug">{subtitle}</p>
    </div>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-1 py-1 shrink-0">
      <span className="font-mono text-[9px] uppercase tracking-wider text-ink-400 whitespace-nowrap">
        {label}
      </span>
      <span className="text-ink-300 text-xs leading-none">↓</span>
    </div>
  );
}

function Hop({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-px flex-1 bg-ink-200" />
      <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded ${INK.badge}`}>{label}</span>
      <span className="h-px flex-1 bg-ink-200" />
    </div>
  );
}

function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-ink-200 rounded-lg bg-ink-100 p-5">
      <h3 className="font-display text-base text-ink-950">{title}</h3>
      <p className="text-xs text-ink-500 mt-1 mb-4 max-w-3xl">{caption}</p>
      <div className="flex flex-col items-center gap-1">{children}</div>
    </section>
  );
}

export default function DataFlowDiagram() {
  return (
    <div className="space-y-4">
      <Section
        title="1. Collecte — une fois par heure, sans intervention"
        caption="Un workflow GitHub Actions planifié appelle l'API OpenWeather Air Pollution pour les 9 villes, normalise la réponse, puis l'insère dans l'entrepôt Neon. Le dashboard n'intervient pas dans cette étape : il ne fait que lire ce qui a déjà été chargé."
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Node title="OpenWeather API" subtitle="9 villes, relevé horaire" />
          <Arrow label="HTTPS" />
          <Node title="GitHub Actions" subtitle="cron horaire + transformation" />
          <Arrow label="TLS" />
          <Node title="Neon" subtitle="dim_city / dim_time / fact_aqi" kind="accent" />
        </div>
      </Section>

      <Section
        title="2. Lecture du dashboard — chaque page, chaque filtre"
        caption="Les pages sont des Server Components. La chaîne de connexion vit dans une variable d'environnement du serveur et n'est jamais sérialisée dans le HTML : le navigateur ne reçoit que du texte déjà rendu."
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Node title="Navigateur" subtitle="aucun secret, aucun SQL" />
          <Arrow label="requête HTTP" />
          <Node title="Server Component" subtitle="lib/queries.ts" kind="accent" />
          <Arrow label="pg (TLS)" />
          <Node title="Neon" subtitle="rôle Postgres lecture seule" />
        </div>
        <div className="w-full max-w-xl pt-3">
          <Hop label="le secret reste côté serveur" />
        </div>
      </Section>

      <Section
        title="3. « Ask AI » — deux sauts réseau, dans cet ordre"
        caption="La question part du navigateur, mais elle n'est jamais traduite par le client. Le modèle ne parle jamais au navigateur : il parle au serveur, qui valide et exécute ce qu'il produit."
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Node title="Navigateur" subtitle="champ de saisie" />
          <Arrow label="POST /api/ask" />
          <Node title="Route Handler" subtitle="app/api/ask/route.ts" kind="accent" />
        </div>
        <div className="w-full max-w-xl pt-2">
          <Hop label="saut 1 · Groq — question → SQL" />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Node title="Groq" subtitle="NL → SQL, 8 s max" />
          <Arrow label="validateSelectOnly" />
          <Node title="SQL validé" subtitle="SELECT seul, tables limitées, LIMIT ≤ 500" kind="accent" />
        </div>
        <div className="w-full max-w-xl pt-2">
          <Hop label="saut 2 · Neon — exécution en lecture seule" />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Node title="Neon" subtitle="statement_timeout 8 s" />
          <Arrow label="lignes" />
          <Node title="Groq" subtitle="résumé en français, streamé" kind="accent" />
        </div>
        <div className="w-full max-w-xl pt-2">
          <Hop label="réponse NDJSON vers le navigateur" />
        </div>
        <p className="text-[11px] text-ink-500 text-center max-w-md pt-1">
          Si PostgreSQL rejette la requête, l'erreur est renvoyée au modèle qui la réécrit : une
          colonne inventée devient une réparation, pas un échec.
        </p>
      </Section>
    </div>
  );
}
