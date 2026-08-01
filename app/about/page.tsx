import fs from "node:fs/promises";
import path from "node:path";

export default async function AboutPage() {
  const content = await fs.readFile(path.join(process.cwd(), "content", "about.md"), "utf-8");
  const lines = content.split("\n");

  return (
    <article className="prose prose-neutral max-w-2xl">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="font-display text-xl mt-6 mb-2">
              {line.replace("## ", "")}
            </h2>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <h1 key={i} className="font-display text-3xl mb-4">
              {line.replace("# ", "")}
            </h1>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <li key={i} className="text-sm text-ink-700 ml-4">
              {line.replace("- ", "")}
            </li>
          );
        }
        if (line.trim() === "") return null;
        return (
          <p key={i} className="text-sm text-ink-700 leading-relaxed mb-2">
            {line}
          </p>
        );
      })}
    </article>
  );
}
