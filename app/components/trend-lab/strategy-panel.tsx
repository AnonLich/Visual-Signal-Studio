import type { TrendStrategy } from "@/lib/client/api";
import { collectContentIdeaLinks, linkifyText, normalizeExternalUrl } from "@/app/page-utils/links";

type StrategyPanelProps = {
  strategy: TrendStrategy;
  feedback: string;
  isRefining: boolean;
  onFeedbackChange: (value: string) => void;
  onRefine: () => void;
};

export function StrategyPanel({
  strategy,
  feedback,
  isRefining,
  onFeedbackChange,
  onRefine,
}: StrategyPanelProps) {
  return (
    <>
      <div className="space-y-4 rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Latest Strategy</div>
            <div className="font-mono text-lg font-semibold text-slate-100">Creative Direction</div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-700/70 bg-slate-800/60 p-3">
          <p className="text-xs text-slate-300">Strategic Brief</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-100">{strategy.strategicBrief}</p>
        </div>
        {strategy.reasoning && (
          <div className="rounded-xl border border-slate-700/70 bg-slate-800/60 p-3">
            <p className="text-xs text-slate-300">Reasoning</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-200">{strategy.reasoning}</p>
          </div>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Content Ideas</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {strategy.contentIdeas.map((idea, idx) => {
              const sourceLinks = (idea.sourceLinks ?? [])
                .map((link) => {
                  const normalized = normalizeExternalUrl(link.url);
                  if (!normalized) return null;
                  return { ...link, url: normalized };
                })
                .filter((link): link is { url: string; trendContext: string } => Boolean(link));

              const links = collectContentIdeaLinks(idea).filter(
                (url) => !sourceLinks.some((link) => link.url === url),
              );

              return (
                <div
                  key={idx}
                  className="space-y-2 rounded-xl border border-slate-700/80 bg-slate-800/50 p-3"
                >
                  <p className="font-mono text-sm font-semibold text-slate-100">
                    {idea.title || `Idea ${idx + 1}`}
                  </p>
                  {idea.tiktok_script && (
                    <div className="space-y-1 rounded-lg border border-slate-700/80 bg-slate-900/60 p-2 text-xs text-slate-100">
                      <p className="font-semibold text-slate-300">TikTok Script</p>
                      {idea.tiktok_script.hook && (
                        <p>
                          <span className="text-slate-400">Hook:</span> {idea.tiktok_script.hook}
                        </p>
                      )}
                      {idea.tiktok_script.visual_direction && (
                        <p>
                          <span className="text-slate-400">Visual:</span> {idea.tiktok_script.visual_direction}
                        </p>
                      )}
                      {idea.tiktok_script.audio_spec && (
                        <p>
                          <span className="text-slate-400">Song:</span> {idea.tiktok_script.audio_spec}
                        </p>
                      )}
                    </div>
                  )}
                  {idea.concept && (
                    <p className="text-xs text-slate-200">
                      <span className="text-slate-400">Concept:</span> {idea.concept}
                    </p>
                  )}
                  {idea.source_evidence && (
                    <p className="text-xs text-slate-300">
                      Source: <span className="text-slate-100">{linkifyText(idea.source_evidence)}</span>
                    </p>
                  )}
                  {idea.cultural_context && <p className="text-xs text-slate-300">{linkifyText(idea.cultural_context)}</p>}
                  {idea.sourceUrl && normalizeExternalUrl(idea.sourceUrl) && (
                    <a
                      className="text-xs text-sky-300 underline decoration-sky-400 underline-offset-4"
                      href={normalizeExternalUrl(idea.sourceUrl) ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Source link
                    </a>
                  )}
                  {sourceLinks.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Source Links</p>
                      <div className="space-y-1">
                        {sourceLinks.map((link) => (
                          <div key={`${link.url}-${link.trendContext}`} className="text-xs text-slate-200">
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate text-sky-300 underline decoration-sky-400 underline-offset-4"
                            >
                              {link.url}
                            </a>
                            {link.trendContext && (
                              <p className="text-[11px] text-slate-400">{link.trendContext}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {links.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Related Links</p>
                      <div className="space-y-1">
                        {links.map((url) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-xs text-sky-300 underline decoration-sky-400 underline-offset-4"
                          >
                            {url}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)]">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-sm font-semibold text-slate-100">Refine Strategy</h2>
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Interactive</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">Adjust the niche, tone, audience, or production constraints.</p>
        <div className="mt-3 space-y-2">
          <textarea
            value={feedback}
            onChange={(e) => onFeedbackChange(e.target.value)}
            placeholder="Example: Push this toward moody brutalist interiors for Gen Z design students. Keep handheld, harsh flash."
            className="min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-100 outline-none ring-1 ring-transparent transition focus:border-sky-400/60 focus:ring-sky-400/20"
          />
          <button
            type="button"
            onClick={onRefine}
            disabled={isRefining || !feedback.trim()}
            className="inline-flex items-center justify-center rounded-full border border-slate-500 bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:opacity-50"
          >
            {isRefining ? "Refining..." : "Send Feedback"}
          </button>
        </div>
      </section>
    </>
  );
}
