/**
 * ESLint — Next.js 14 + TypeScript strict.
 *
 * `next/core-web-vitals` couvre les règles React qui ont un impact réel sur les
 * performances (images, hooks, keys) et s'applique à tout le projet.
 * `plugin:@typescript-eslint/recommended` n'est activé que sur les fichiers TS :
 * `next/core-web-vitals` ne fournit que le parser, pas les règles.
 */
module.exports = {
  extends: "next/core-web-vitals",
  overrides: [
    {
      files: ["**/*.ts", "**/*.tsx"],
      extends: ["plugin:@typescript-eslint/recommended"],
      rules: {
        // Le projet cible TypeScript strict : un `any` explicite signale un
        // point où le typage a été abandonné. On le signale sans bloquer le
        // build, le temps de supprimer les `any` restants.
        "@typescript-eslint/no-explicit-any": "warn",
        // Le texte est en français : « l'entrepôt », « d'où », « n'a » sont la
        // forme correcte. Écrire `&apos;` rendrait la source illisible sans
        // aucun gain. La règle vise l'injection de HTML, pas l'apostrophe.
        "react/no-unescaped-entities": "off",
      },
    },
  ],
};
