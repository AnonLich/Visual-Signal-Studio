import type { ImageAnalysis } from "../image-analysis"
import type { TrendStrategy } from "./types"

const URL_REGEX = /(https?:\/\/[^\s"'<>)]+|www\.[^\s"'<>)]+)/gi

function cleanUrlToken(value: string) {
	return value.replace(/[.,!?;:]+$/, "")
}

function normalizeExternalUrl(value: string): string | null {
	const cleaned = cleanUrlToken(value.trim())
	if (!cleaned) return null

	const candidate = /^https?:\/\//i.test(cleaned)
		? cleaned
		: `https://${cleaned}`

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

function extractUrls(value: string): string[] {
	const matches = value.match(URL_REGEX) ?? []
	const normalized = matches
		.map((match) => normalizeExternalUrl(match))
		.filter((url): url is string => Boolean(url))
	return Array.from(new Set(normalized))
}

export function ensureDiverseIdeaLinks(strategy: TrendStrategy): TrendStrategy {
	const linkPool = Array.from(
		new Map(
			(strategy.tiktokLinks ?? [])
				.map((link) => {
					const normalizedUrl = normalizeExternalUrl(link.url)
					if (!normalizedUrl) return null
					return [
						normalizedUrl,
						{
							url: normalizedUrl,
							trendContext: link.trendContext?.trim() || "Supporting source",
						},
					] as const
				})
				.filter(
					(
						item,
					): item is readonly [string, { url: string; trendContext: string }] =>
						Boolean(item),
				),
		).values(),
	)

	const usedPrimaryUrls = new Set<string>()

	const contentIdeas = strategy.contentIdeas.map((idea) => {
		const preferredLinks = (idea.sourceLinks ?? [])
			.map((link) => {
				const normalizedUrl = normalizeExternalUrl(link.url)
				if (!normalizedUrl) return null
				return {
					url: normalizedUrl,
					trendContext: link.trendContext?.trim() || "Supporting source",
				}
			})
			.filter(
				(
					item,
				): item is {
					url: string
					trendContext: string
				} => Boolean(item),
			)

		const evidenceLinks = extractUrls(idea.source_evidence ?? "").map((url) => ({
			url,
			trendContext: "Mentioned in source evidence",
		}))

		const mergedLinks = Array.from(
			new Map(
				[...preferredLinks, ...evidenceLinks].map((link) => [link.url, link]),
			).values(),
		)

		if (mergedLinks.length === 0 && linkPool.length > 0) {
			const preferredPoolLink =
				linkPool.find((link) => !usedPrimaryUrls.has(link.url)) ?? linkPool[0]
			if (preferredPoolLink) {
				mergedLinks.push(preferredPoolLink)
			}
		}

		if (mergedLinks.length > 0 && usedPrimaryUrls.has(mergedLinks[0].url)) {
			const extraUnique = linkPool.find(
				(link) =>
					!usedPrimaryUrls.has(link.url) &&
					!mergedLinks.some((existing) => existing.url === link.url),
			)
			if (extraUnique) {
				mergedLinks.push(extraUnique)
			}
		}

		const finalLinks = mergedLinks.slice(0, 3)
		if (finalLinks[0]) {
			usedPrimaryUrls.add(finalLinks[0].url)
		}

		return {
			...idea,
			sourceLinks: finalLinks,
		}
	})

	return { ...strategy, contentIdeas }
}

export function buildFallbackResearchQueries(analysis: ImageAnalysis): string[] {
	const queryCandidates = [
		`${analysis.aestheticStyle} TikTok microtrend`,
		`${analysis.brandArchetype} creator trend TikTok`,
		`${analysis.visualKeywords.slice(0, 4).join(" ")} viral TikTok format`,
		`${analysis.marketSegment} audience TikTok trend report`,
	]

	return Array.from(new Set(queryCandidates.map((query) => query.trim()))).filter(
		(query) => query.length > 0,
	)
}
