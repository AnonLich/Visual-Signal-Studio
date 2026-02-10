import type { ChatMessage } from "@/app/page-utils/chat-messages";

type LabLogProps = {
  messages: ChatMessage[];
  isAgentWorking: boolean;
};

export function LabLog({ messages, isAgentWorking }: LabLogProps) {
  if (messages.length === 0 && !isAgentWorking) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)]">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-sm font-semibold text-slate-100">Lab Log</h2>
        <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Streaming</span>
      </div>
      <div className="mt-3 max-h-[520px] space-y-3 overflow-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="rounded-xl border border-slate-700/70 bg-slate-800/50 p-3 text-xs text-slate-100"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${msg.tone === "error"
                    ? "bg-rose-400"
                    : msg.tone === "success"
                      ? "bg-emerald-300"
                      : "bg-sky-300"
                    }`}
                />
                <span className="text-[11px] font-semibold text-slate-300">{msg.title}</span>
              </div>
            </div>
            {msg.body && <p className="mt-2 text-[12px] leading-relaxed text-slate-100">{msg.body}</p>}
            {Array.isArray(msg.tools) && msg.tools.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {msg.tools.map((tool, idx) => (
                  <span
                    key={`${tool}-${idx}`}
                    className="rounded-full border border-slate-600 bg-slate-700/70 px-2 py-1 text-[11px] text-slate-200"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {isAgentWorking && (
          <div className="rounded-xl border border-sky-500/30 bg-slate-800/50 p-3 text-xs text-slate-100">
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-sky-300" />
              <span className="text-[11px] font-semibold text-sky-200">Agent working</span>
            </div>
            <p className="mt-2 text-[12px] text-slate-300">Thinking and running tools...</p>
          </div>
        )}
      </div>
    </section>
  );
}
