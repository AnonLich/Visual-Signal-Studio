import type { SearchDisplayMatch } from "@/lib/client/api"

type SearchResultsProps = {
	matches: SearchDisplayMatch[]
}

export function SearchResults({ matches }: SearchResultsProps) {
	if (matches.length === 0) {
		return null
	}

	return (
		<section className="mt-6 space-y-3">
			<h2 className="text-sm font-semibold text-foreground">Search Matches</h2>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{matches.map((match) => (
					<article
						key={match.id}
						className="overflow-hidden rounded-md border border-border bg-card"
					>
						{match.signedImageUrl ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={match.signedImageUrl}
								alt={`Match ${match.id}`}
								className="h-40 w-full object-cover"
							/>
						) : (
							<div className="flex h-40 items-center justify-center bg-muted text-xs text-muted-foreground">
								No image URL
							</div>
						)}
						<div className="space-y-1 p-3 text-xs">
							<p className="text-muted-foreground">ID: {match.id}</p>
							<p className="text-muted-foreground">
								Distance: {Number(match.distance).toFixed(4)}
							</p>
						</div>
					</article>
				))}
			</div>
		</section>
	)
}
