/**
 * ESLint — Next.js 14 + TypeScript strict.
 * `next/core-web-vitals` apporte le parser et les règles React ; les règles
 * TypeScript sont ajoutées à part car le preset Next ne fournit que le parser.
 */
module.exports = {
  extends: "next/core-web-vitals",
  overrides: [
    {
      files: ["**/*.ts", "**/*.tsx"],
      extends: ["plugin:@typescript-eslint/recommended"],
      rules: {
        // `strict` est actif : un `any` signale un typage abandonné. Signale
        // sans bloquer le build, le temps de supprimer les derniers.
        "@typescript-eslint/no-explicit-any": "warn",
        // Une assertion `x!` affirme au compilateur que la valeur n'est jamais
        // nulle. Sur un état React capturé en closure, elle ment : le spread
        // `{ ...null }` produit `{}` et le type estunchecked. Cette règle est
        // absente de `recommended` en v8, d'où ce réglage explicite.
        "@typescript-eslint/no-non-null-assertion": "warn",
        // UI en français : « l'entrepôt », « d'où » sont la forme correcte.
        // La règle vise l'injection de HTML, pas l'apostrophe.
        "react/no-unescaped-entities": "off",
      },
    },
  ],
};
