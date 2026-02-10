import { FileUpload } from "@/app/components/file-upload";

type AnalysisPanelProps = {
  selectedImagesCount: number;
  isLoading: boolean;
  onImagesChange: (images: File[]) => void;
  onAnalyze: () => void;
};

export function AnalysisPanel({
  selectedImagesCount,
  isLoading,
  onImagesChange,
  onAnalyze,
}: AnalysisPanelProps) {
  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 shadow-[inset_0_1px_0_rgba(148,163,184,0.1)]">
      <div className="flex items-center justify-between">
        <div className="font-mono text-sm font-medium text-slate-100">Run Analysis</div>
        {selectedImagesCount > 0 && (
          <span className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs text-slate-300">
            {selectedImagesCount} ready
          </span>
        )}
      </div>
      <div className="mt-3">
        <FileUpload onImagesChange={onImagesChange} />
      </div>
      {selectedImagesCount > 0 && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">
            Ready to process {selectedImagesCount} image{selectedImagesCount === 1 ? "" : "s"}.
          </p>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-full border border-slate-500 bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:opacity-50"
          >
            {isLoading ? "Analyzing..." : "Analyze"}
          </button>
        </div>
      )}
    </div>
  );
}
