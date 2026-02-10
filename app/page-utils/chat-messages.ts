import type { TrendStreamEvent } from "@/lib/client/api";

export type ChatMessage = {
  id: string;
  tone: "info" | "step" | "success" | "error";
  title: string;
  body: string;
  tools?: string[];
};

export function toChatMessages(events: TrendStreamEvent[]): ChatMessage[] {
  return events.map((event, idx) => {
    const base = { id: `${event.type}-${idx}` };

    if (event.type === "status") {
      return { ...base, tone: "info", title: "Status", body: event.message };
    }

    if (event.type === "step") {
      const phase = event.phase ? ` (${event.phase})` : "";
      const tools = event.toolCalls?.map((t) => t.toolName).filter(Boolean) ?? [];
      const body = tools.length
        ? `Running ${tools.join(", ")}...`
        : event.text || event.reasoningText || "Thinking...";

      return {
        ...base,
        tone: "step",
        title: `Step ${event.stepNumber}${phase}`,
        body,
        tools,
      };
    }

    if (event.type === "image-complete") {
      return {
        ...base,
        tone: "success",
        title: "Image processed",
        body: "Strategy generated for this image.",
      };
    }

    if (event.type === "refine-complete") {
      return {
        ...base,
        tone: "success",
        title: "Refinement complete",
        body: "Updated strategy ready.",
      };
    }

    if (event.type === "complete") {
      return {
        ...base,
        tone: "success",
        title: "Analysis complete",
        body: `Items: ${event.count}`,
      };
    }

    if (event.type === "error") {
      return {
        ...base,
        tone: "error",
        title: "Error",
        body: event.message,
      };
    }

    return { ...base, tone: "info", title: event.type, body: "" };
  });
}
