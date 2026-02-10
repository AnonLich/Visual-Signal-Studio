import { z } from "zod"

export const ONE_YEAR_IN_MS = 365 * 24 * 60 * 60 * 1000
const EXA_SEARCH_URL = "https://api.exa.ai/search"

export const TrendSynthesisSchema = z.object({
	trends: z.array(
		z.object({
			trend_name: z.string(),
			visual_vibe: z.string(),
			audio_or_slang: z.string(),
			source_url: z.string(),
			observed_at_iso: z.string(),
			why_its_viral: z.string(),
		}),
	),
})

export type TrendItem = z.infer<typeof TrendSynthesisSchema>["trends"][number]

export type RecentSource = {
	url: string
	title: string
	publishedAt: string
	snippet: string
}

export function isWithinLastYear(isoDate: string) {
	const timestamp = new Date(isoDate).getTime()
	if (!Number.isFinite(timestamp)) return false
	const ageMs = Date.now() - timestamp
	return ageMs >= 0 && ageMs <= ONE_YEAR_IN_MS
}

function normalizeExternalUrl(value: unknown): string | null {
	if (typeof value !== "string") return null

	const trimmed = value.trim()
	if (!trimmed) return null

	const candidate = /^https?:\/\//i.test(trimmed)
		? trimmed
		: `https://${trimmed}`

	try {
		const parsed = new URL(candidate)
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return null
		}
		return parsed.toString()
	} catch {
		return null
	}
}

function normalizeIsoDate(value: unknown): string | null {
	if (typeof value !== "string") return null
	const timestamp = new Date(value).getTime()
	if (!Number.isFinite(timestamp)) return null
	return new Date(timestamp).toISOString()
}

export function buildQueryVariants(searchQuery: string): string[] {
	const year = new Date().getUTCFullYear()
	return Array.from(
		new Set(
			[
				searchQuery,
				`${searchQuery} tiktok microtrend ${year}`,
				`${searchQuery} tiktok emerging sound ${year}`,
				`${searchQuery} creator trend report ${year}`,
				`${searchQuery} tiktok aesthetic breakdown ${year - 1} ${year}`,
			].map((query) => query.trim()),
		),
	).filter((query) => query.length > 0)
}

function toRecentSource(
	result: unknown,
	options: { serverDateFiltered: boolean },
): RecentSource | null {
	if (!result || typeof result !== "object") return null

	const row = result as Record<string, unknown>
	const url = normalizeExternalUrl(row.url)
	if (!url) return null

	const title =
		typeof row.title === "string" && row.title.trim().length > 0
			? row.title.trim()
			: url

	const text =
		typeof row.text === "string"
			? row.text
			: typeof row.highlight === "string"
				? row.highlight
				: ""

	const snippet = text.trim().slice(0, 500) || "No snippet provided."

	const observedDate =
		normalizeIsoDate(row.publishedDate) ??
		normalizeIsoDate(row.published_date) ??
		normalizeIsoDate(row.published_at) ??
		normalizeIsoDate(row.createdDate) ??
		(options.serverDateFiltered ? new Date().toISOString() : null)

	if (!observedDate || !isWithinLastYear(observedDate)) {
		return null
	}

	return {
		url,
		title,
		publishedAt: observedDate,
		snippet,
	}
}

export async function searchRecentSources(params: {
	query: string
	cutoffIso: string
	apiKey: string
}): Promise<RecentSource[]> {
	const { query, cutoffIso, apiKey } = params
	const baseBody = {
		query,
		type: "neural",
		numResults: 10,
		text: true,
	}

	const attempts: Array<{
		body: Record<string, unknown>
		serverDateFiltered: boolean
	}> = [
		{
			body: {
				...baseBody,
				startPublishedDate: cutoffIso,
			},
			serverDateFiltered: true,
		},
		{
			body: baseBody,
			serverDateFiltered: false,
		},
	]

	for (const attempt of attempts) {
		const response = await fetch(EXA_SEARCH_URL, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-api-key": apiKey,
			},
			body: JSON.stringify(attempt.body),
		}).catch(() => null)

		if (!response || !response.ok) {
			continue
		}

		const json = (await response.json().catch(() => ({}))) as {
			results?: unknown[]
		}

		const sources = (Array.isArray(json.results) ? json.results : [])
			.map((result) =>
				toRecentSource(result, {
					serverDateFiltered: attempt.serverDateFiltered,
				}),
			)
			.filter((source): source is RecentSource => Boolean(source))

		if (sources.length > 0) {
			return sources
		}
	}

	return []
}

export function dedupeSources(sources: RecentSource[]): RecentSource[] {
	const map = new Map<string, RecentSource>()

	for (const source of sources) {
		const existing = map.get(source.url)
		if (!existing) {
			map.set(source.url, source)
			continue
		}

		const existingTime = new Date(existing.publishedAt).getTime()
		const candidateTime = new Date(source.publishedAt).getTime()
		if (candidateTime > existingTime) {
			map.set(source.url, source)
			continue
		}

		if (source.snippet.length > existing.snippet.length) {
			map.set(source.url, {
				...existing,
				snippet: source.snippet,
			})
		}
	}

	return Array.from(map.values())
}

export function normalizeTrendItem(
	item: TrendItem,
	allowedUrls: Set<string>,
): TrendItem | null {
	const normalizedUrl = normalizeExternalUrl(item.source_url)
	const normalizedDate = normalizeIsoDate(item.observed_at_iso)

	if (!normalizedUrl || !normalizedDate) return null
	if (!allowedUrls.has(normalizedUrl)) return null
	if (!isWithinLastYear(normalizedDate)) return null

	return {
		...item,
		source_url: normalizedUrl,
		observed_at_iso: normalizedDate,
	}
}
