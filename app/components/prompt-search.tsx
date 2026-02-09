"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useEffect, useMemo, useState } from "react"
import { SearchResults } from "./search-results"
import {
    hydrateSearchMatches,
    SearchDisplayMatch,
    SearchMatch,
} from "@/lib/client/api"

type ToolPart = {
    type: string
    state?: string
    output?: {
        matches?: SearchMatch[]
    }
}

function getMessageText(parts: Array<{ type: string; text?: string }>) {
    return parts
        .filter((part) => part.type === "text" && typeof part.text === "string")
        .map((part) => part.text)
        .join("")
}

function getToolMatches(parts: Array<{ type: string }>): SearchMatch[] {
    const toolPart = parts.find(
        (part) =>
            part.type === "tool-searchImages" ||
            (part.type.startsWith("tool-") && (part as ToolPart).output?.matches),
    ) as ToolPart | undefined

    return toolPart?.output?.matches ?? []
}

function getLatestToolMatches(messages: Array<{ parts: Array<{ type: string }> }>) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const matches = getToolMatches(messages[index].parts)
        if (matches.length > 0) {
            return matches
        }
    }
    return []
}

export function PromptSearch() {
    const { messages, sendMessage, status, error } = useChat({
        transport: new DefaultChatTransport({
            api: "/api/prompt-search",
        }),
    })
    const [input, setInput] = useState("")
    const [searchMatchesUrl, setSearchMatchesUrl] = useState<SearchDisplayMatch[]>([])

    const isLoading = status === "submitted" || status === "streaming"
    const rawMatches = useMemo(() => getLatestToolMatches(messages), [messages])

    useEffect(() => {
        let cancelled = false

        async function hydrate() {
            if (rawMatches.length === 0) {
                setSearchMatchesUrl([])
                return
            }

            const hydrated = await hydrateSearchMatches(rawMatches)
            if (!cancelled) {
                setSearchMatchesUrl(hydrated)
            }
        }

        void hydrate()

        return () => {
            cancelled = true
        }
    }, [rawMatches])

    return (
        <section className="mt-6 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">AI Search Chat</h2>

            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-border bg-card p-3">
                {messages.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                        Ask for images, for example: &quot;Find happy person smiling.&quot;
                    </p>
                ) : (
                    messages.map((message) => {
                        const text = getMessageText(message.parts)
                        const matches = getToolMatches(message.parts)
                        return (
                            <div key={message.id} className="text-sm">
                                <p className="font-medium capitalize text-foreground">{message.role}</p>
                                {text ? (
                                    <p className="text-muted-foreground">{text}</p>
                                ) : (
                                    <p className="text-muted-foreground">[no text response]</p>
                                )}
                                {matches.length > 0 && (
                                    <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                                        {matches.map((match: SearchMatch) => (
                                            <li key={match.id}>
                                                id: {match.id}, distance: {Number(match.distance).toFixed(4)}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            <form
                className="flex gap-2"
                onSubmit={async (e) => {
                    e.preventDefault()
                    const trimmed = input.trim()
                    if (!trimmed) return
                    await sendMessage({ text: trimmed })
                    setInput("")
                }}
            >
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Search by vibes.."
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                    {isLoading ? "Thinking..." : "Send"}
                </button>
            </form>

            {error && <p className="text-sm text-destructive">{error.message}</p>}

            <SearchResults matches={searchMatchesUrl} />
        </section>
    )
}
