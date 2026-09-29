"use client";

import { useEffect, useRef, useState } from "react";
import { ChatMessage, AskEvent } from "@/types/aqi";
import { toCsv } from "@/lib/rows";

const STORAGE_KEY = "aqi-ask-conversation";
const MAX_ROWS_RENDERED = 25;

const SUGGESTIONS = [
  "Quelle ville a le PM2.5 moyen le plus élevé ce mois-ci ?",
  "Compare l'AQI moyen entre semaine et week-end.",
  "Quelles sont les 3 villes les moins polluées ?",
  "Y a-t-il une corrélation entre NO2 et AQI ?",
];

interface Streaming {
  text: string;
  status: string;
  sql: string | null;
  rows: Record<string, unknown>[] | null;
  rowCount: number;
  repaired: boolean;
  degraded: boolean;
}

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

function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function AssistantAvatar() {
  return (
    <div className="shrink-0 w-7 h-7 rounded-full bg-primary-500/15 ring-1 ring-primary-500/30 flex items-center justify-center text-primary-300 text-xs mt-0.5">
      ✦
    </div>
  );
}

function AnswerBlock({
  content,
  sql,
  rows,
  rowCount,
  degraded,
  repaired,
  pending = false,
  status,
  copied,
  onCopy,
  onDownload,
  onStop,
}: {
  content: string;
  sql?: string;
  rows?: Record<string, unknown>[];
  rowCount: number;
  degraded?: boolean;
  repaired?: boolean;
  pending?: boolean;
  status?: string;
  copied?: boolean;
  onCopy?: () => void;
  onDownload?: () => void;
  onStop?: () => void;
}) {
  return (
    <div className="flex-1 min-w-0">
      {content ? (
        <p className="text-sm text-ink-900 leading-relaxed whitespace-pre-wrap">
          {content}
          {pending && <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-primary-400 animate-pulse align-text-bottom" />}
        </p>
      ) : (
        <div className="flex items-center gap-2 text-ink-500 text-sm">
          <span className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce" />
          </span>
          <span>{status ?? "Analyse…"}</span>
        </div>
      )}

      {onStop && (
        <button
          onClick={onStop}
          className="mt-1.5 text-[11px] px-2 py-0.5 rounded border border-ink-200 text-ink-500 hover:text-primary-300 hover:border-primary-500/50 transition-colors"
        >
          Arrêter
        </button>
      )}

      {(repaired || degraded) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {repaired && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-primary-500/40 text-primary-300 bg-primary-500/10">
              requête réparée par le modèle
            </span>
          )}
          {degraded && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-ink-300 text-ink-500">
              résumé indisponible
            </span>
          )}
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="mt-3 overflow-x-auto border border-ink-200 rounded-lg bg-ink-100">
          <table className="text-xs w-full">
            <thead>
              <tr>
                {Object.keys(rows[0]).map((k) => (
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
              {rows.slice(0, MAX_ROWS_RENDERED).map((row, ri) => (
                <tr key={ri} className="border-b border-ink-200/60 last:border-0 hover:bg-ink-200/30">
                  {Object.values(row).map((v, ci) => (
                    <td key={ci} className="px-3 py-1.5 text-ink-800 whitespace-nowrap">
                      {v === null ? "—" : String(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] text-ink-500 border-t border-ink-200">
            <span>
              {rows.length > MAX_ROWS_RENDERED
                ? `Affichage des ${MAX_ROWS_RENDERED} premières lignes sur ${rowCount}.`
                : `${rowCount} ligne${rowCount > 1 ? "s" : ""}.`}
            </span>
            {onDownload && (
              <button
                onClick={onDownload}
                className="font-mono px-2 py-0.5 rounded border border-ink-200 hover:text-primary-300 hover:border-primary-500/50 transition-colors"
              >
                CSV
              </button>
            )}
          </div>
        </div>
      )}

      {sql && (
        <details className="mt-2 group">
          <summary className="text-[11px] cursor-pointer text-ink-500 hover:text-primary-300 select-none inline-flex items-center gap-1 transition-colors">
            <span className="group-open:rotate-90 transition-transform inline-block">›</span>
            Voir la requête SQL
          </summary>
          <div className="mt-1.5 relative">
            <pre className="text-[11px] font-mono bg-ink-50 border border-ink-200 text-ink-800 p-3 rounded-lg overflow-x-auto pr-16">
              {sql}
            </pre>
            {onCopy && (
              <button
                onClick={onCopy}
                className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded-md border border-ink-200 bg-ink-100 text-ink-500 hover:text-primary-300 hover:border-primary-500/50 transition-colors"
              >
                {copied ? "Copié" : "Copier"}
              </button>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState<Streaming | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(loadConversation());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    autosize(textareaRef.current);
  }, [input]);

  useEffect(() => {
    if (streaming) streamRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [streaming]);

  useEffect(() => () => abortRef.current?.abort(), []);

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
    setStreaming({ text: "", status: "Préparation…", sql: null, rows: null, rowCount: 0, repaired: false, degraded: false });

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = "";
    let state: Streaming | null = null;
    let failure: string | null = null;

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: next.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });

      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Trop de requêtes — réessayez dans un instant.");
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Erreur inconnue");
      }
      if (!res.body) {
        throw new Error("Réponse sans flux.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: AskEvent;
          try {
            event = JSON.parse(line) as AskEvent;
          } catch {
            continue;
          }

          if (event.type === "error") {
            failure = event.error;
          } else if (event.type === "status") {
            state = { ...(state ?? streaming!), status: event.label };
          } else if (event.type === "sql") {
            state = { ...(state ?? streaming!), sql: event.sql };
          } else if (event.type === "rows") {
            state = { ...(state ?? streaming!), rows: event.rows, rowCount: event.rowCount };
          } else if (event.type === "delta") {
            accumulated += event.text;
            state = { ...(state ?? streaming!), text: accumulated };
          } else if (event.type === "done") {
            state = { ...(state ?? streaming!), degraded: event.degraded, repaired: event.repaired };
          }
          if (state) setStreaming(state);
        }
      }

      if (failure) {
        throw new Error(failure);
      }

      const final = state ?? { ...streaming!, text: accumulated };
      const answer: ChatMessage = {
        role: "assistant",
        content: final.text.trim() || "(Aucune réponse.)",
        sql: final.sql ?? undefined,
        rows: final.rows ?? undefined,
        rowCount: final.rowCount,
        degraded: final.degraded,
        repaired: final.repaired,
      };
      const withAnswer = [...next, answer];
      setMessages(withAnswer);
      saveConversation(withAnswer);
    } catch (e) {
      const message =
        (e as Error).name === "AbortError" ? "Réponse interrompue." : (e as Error).message ?? "Une erreur est survenue.";
      if (accumulated) {
        const partial: ChatMessage = { role: "assistant", content: accumulated };
        const withPartial = [...next, partial];
        setMessages(withPartial);
        saveConversation(withPartial);
      }
      setError(message);
    } finally {
      abortRef.current = null;
      setLoading(false);
      setStreaming(null);
    }
  }

  function stop() {
    abortRef.current?.abort();
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
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm bg-primary-500 text-ink-50 whitespace-pre-wrap">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex gap-3">
                  <AssistantAvatar />
                  <AnswerBlock
                    content={m.content}
                    sql={m.sql}
                    rows={m.rows}
                    rowCount={m.rowCount ?? m.rows?.length ?? 0}
                    degraded={m.degraded}
                    repaired={m.repaired}
                    copied={copied === i}
                    onCopy={() => m.sql && copySql(m.sql, i)}
                    onDownload={() => m.rows && downloadCsv(m.rows, "aqi-ask-reponse.csv")}
                  />
                </div>
              )
            )}

            {loading && streaming && (
              <div className="flex gap-3" ref={streamRef}>
                <AssistantAvatar />
                <AnswerBlock
                  content={streaming.text}
                  sql={streaming.sql ?? undefined}
                  rows={streaming.rows ?? undefined}
                  rowCount={streaming.rowCount}
                  degraded={streaming.degraded}
                  repaired={streaming.repaired}
                  pending={streaming.text.length === 0}
                  status={streaming.status}
                  onStop={stop}
                />
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
