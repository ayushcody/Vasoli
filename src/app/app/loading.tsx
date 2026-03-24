export default function Loading() {
    return (
        <div className="p-8 animate-pulse">
            {/* Header skeleton */}
            <div className="mb-8">
                <div className="h-8 w-56 bg-paper-2 rounded-neo border-brutal mb-2" />
                <div className="h-4 w-80 bg-paper-2 rounded-neo" />
            </div>

            {/* Stat cards skeleton */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
                {[...Array(4)].map((_, i) => (
                    <div
                        key={i}
                        className="border-brutal-thick rounded-neo-md bg-paper-2 p-6 shadow-brutal"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="h-4 w-20 bg-taupe/15 rounded" />
                            <div className="h-8 w-8 bg-taupe/15 rounded-neo" />
                        </div>
                        <div className="h-7 w-28 bg-taupe/15 rounded" />
                    </div>
                ))}
            </div>

            {/* Content area skeleton */}
            <div className="grid gap-6 lg:grid-cols-2">
                <div className="border-brutal-thick rounded-neo-md bg-paper-2 p-6 shadow-brutal">
                    <div className="h-6 w-44 bg-taupe/15 rounded mb-4" />
                    <div className="space-y-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="h-8 w-8 bg-taupe/15 rounded-full" />
                                <div className="flex-1">
                                    <div className="h-4 w-32 bg-taupe/15 rounded mb-1" />
                                    <div className="h-3 w-20 bg-taupe/10 rounded" />
                                </div>
                                <div className="h-5 w-16 bg-taupe/15 rounded" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="border-brutal-thick rounded-neo-md bg-paper-2 p-6 shadow-brutal">
                    <div className="h-6 w-32 bg-taupe/15 rounded mb-4" />
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i}>
                                <div className="h-4 w-40 bg-taupe/15 rounded mb-2" />
                                <div className="h-2 w-full bg-taupe/10 rounded-full" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
