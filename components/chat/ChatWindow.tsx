"use client";

import { useEffect, useRef, useState } from "react";
import { ChatMessage } from "@/types/aqi";

const STORAGE_KEY = "aqi-ask-conversation";

const SUGGESTIONS = [
  "Quelle ville a le PM2.5 moyen le plus élevé ce mois-ci ?",
  "Compare l'AQI moyen entre semaine et week-end.",
  "Quelles sont les 3 villes les moins polluées ?",
  "Y a-t-il une corrélation entre NO2 et AQI ?",
];

function loadConversation(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function saveConversation(messages: ChatMessage[]) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
  }
}

function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages(loadConversation());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    autosize(textareaRef.current);
  }, [input]);

  async function send(overrideQuestion?: string) {
    const question = (overrideQuestion ?? input).trim();
    if (!question || loading) return;
    setInput("");
    setError(null);
    requestAnimationFrame(() => autosize(textareaRef.current));

    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    saveConversation(next);
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: next.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Trop de requêtes — réessayez dans un instant.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Erreur inconnue");
      }

      const data = await res.json();
      const withAnswer = [
        ...next,
        {
          role: "assistant" as const,
          content: data.summary,
          sql: data.sql,
          rows: data.rows,
        },
      ];
      setMessages(withAnswer);
      saveConversation(withAnswer);
    } catch (e: any) {
      setError(e.message ?? "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  function clearConversation() {
    setMessages([]);
    saveConversation([]);
    setError(null);
  }

  function copySql(sql: string, i: number) {
    navigator.clipboard?.writeText(sql).then(() => {
      setCopied(i);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] border border-ink-200 rounded-xl bg-ink-100/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink-200 bg-ink-100">
        <p className="text-xs text-ink-500 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-400 inline-block" />
          Conversation stockée uniquement dans cet onglet (sessionStorage) — jamais sur le serveur.
        </p>
        {messages.length > 0 && (
          <button
            onClick={clearConversation}
            className="text-xs text-ink-500 hover:text-primary-300 transition-colors"
          >
            Effacer la conversation
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto">
            <div className="w-11 h-11 rounded-full bg-primary-500/15 ring-1 ring-primary-500/30 flex items-center justify-center text-primary-300 text-lg mb-4">
              ✦
            </div>
            <p className="font-display text-lg text-ink-950 mb-1.5">Interrogez l'entrepôt AQI</p>
            <p className="text-sm text-ink-500 mb-6">
              Posez une question en langage naturel. Elle est traduite en une requête SQL{" "}
              <code className="font-mono text-xs bg-ink-200/60 px-1 py-0.5 rounded text-primary-300">
                SELECT
              </code>{" "}
              unique, validée puis exécutée en lecture seule.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-xs px-3 py-2.5 rounded-lg border border-ink-200 bg-ink-100 hover:border-primary-500/50 hover:bg-primary-500/5 text-ink-700 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-3"}>
                {m.role === "assistant" && (
                  <div className="shrink-0 w-7 h-7 rounded-full bg-primary-500/15 ring-1 ring-primary-500/30 flex items-center justify-center text-primary-300 text-xs mt-0.5">
                    ✦
                  </div>
                )}
                <div className={m.role === "user" ? "max-w-[80%]" : "flex-1 min-w-0"}>
                  <div
                    className={
                      m.role === "user"
                        ? "rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm bg-primary-500 text-ink-50"
                        : "text-sm text-ink-900 leading-relaxed"
                    }
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>

                  {m.rows && m.rows.length > 0 && (
                    <div className="mt-3 overflow-x-auto border border-ink-200 rounded-lg bg-ink-100">
                      <table className="text-xs w-full">
                        <thead>
                          <tr>
                            {Object.keys(m.rows[0]).map((k) => (
                              <th
                                key={k}
                                className="px-3 py-2 text-left font-mono text-ink-500 border-b border-ink-200 whitespace-nowrap"
                              >
                                {k}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {m.rows.slice(0, 25).map((row, ri) => (
                            <tr key={ri} className="border-b border-ink-200/60 last:border-0 hover:bg-ink-200/30">
                              {Object.values(row).map((v, ci) => (
                                <td key={ci} className="px-3 py-1.5 text-ink-800 whitespace-nowrap">
                                  {String(v)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {m.rows.length > 25 && (
                        <div className="px-3 py-1.5 text-[11px] text-ink-500 border-t border-ink-200">
                          Affichage des 25 premières lignes sur {m.rows.length}.
                        </div>
                      )}
                    </div>
                  )}

                  {m.sql && (
                    <details className="mt-2 group">
                      <summary className="text-[11px] cursor-pointer text-ink-500 hover:text-primary-300 select-none inline-flex items-center gap-1 transition-colors">
                        <span className="group-open:rotate-90 transition-transform inline-block">›</span>
                        Voir la requête SQL
                      </summary>
                      <div className="mt-1.5 relative">
                        <pre className="text-[11px] font-mono bg-ink-50 border border-ink-200 text-ink-800 p-3 rounded-lg overflow-x-auto pr-16">
                          {m.sql}
                        </pre>
                        <button
                          onClick={() => copySql(m.sql!, i)}
                          className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded-md border border-ink-200 bg-ink-100 text-ink-500 hover:text-primary-300 hover:border-primary-500/50 transition-colors"
                        >
                          {copied === i ? "Copié" : "Copier"}
                        </button>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="shrink-0 w-7 h-7 rounded-full bg-primary-500/15 ring-1 ring-primary-500/30 flex items-center justify-center text-primary-300 text-xs mt-0.5">
                  ✦
                </div>
                <div className="flex items-center gap-1.5 text-ink-500 text-sm pt-1.5">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce" />
                  </span>
                  Analyse de la question…
                </div>
              </div>
            )}
            {error && (
              <div className="flex gap-3">
                <div className="shrink-0 w-7 h-7 rounded-full bg-severity-4/15 ring-1 ring-severity-4/30 flex items-center justify-center text-severity-4 text-xs mt-0.5">
                  !
                </div>
                <p className="text-sm text-severity-4 pt-1">{error}</p>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-ink-200 bg-ink-100 p-3 md:p-4">
        <div className="max-w-3xl mx-auto flex items-end gap-2 border border-ink-200 focus-within:border-primary-500/60 focus-within:ring-1 focus-within:ring-primary-500/30 rounded-xl bg-ink-50 px-3 py-2 transition-colors">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Posez une question sur les données AQI…"
            className="flex-1 resize-none bg-transparent text-sm py-1.5 focus:outline-none placeholder:text-ink-500 max-h-[200px]"
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            aria-label="Envoyer"
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-primary-500 text-ink-50 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary-400 transition-colors"
          >
            ↑
          </button>
        </div>
        <p className="max-w-3xl mx-auto text-[10px] text-ink-500 mt-1.5 px-1">
          Entrée pour envoyer · Maj+Entrée pour une nouvelle ligne
        </p>
      </div>
    </div>
  );
}
