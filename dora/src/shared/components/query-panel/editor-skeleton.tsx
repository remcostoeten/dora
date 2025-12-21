export function EditorSkeleton() {
  return (
    <div className="h-full w-full bg-[#09090b] p-4">
      <div className="space-y-2">
        {/* Line 1 */}
        <div className="flex items-center gap-2">
          <div className="w-4 text-right text-xs text-zinc-700">1</div>
          <div className="flex gap-2">
            <div className="h-3.5 w-16 animate-pulse rounded bg-zinc-800" />
            <div className="h-3.5 w-12 animate-pulse rounded bg-zinc-800" />
            <div className="h-3.5 w-20 animate-pulse rounded bg-zinc-800" />
          </div>
        </div>
        {/* Line 2 */}
        <div className="flex items-center gap-2">
          <div className="w-4 text-right text-xs text-zinc-700">2</div>
          <div className="flex gap-2">
            <div className="h-3.5 w-14 animate-pulse rounded bg-zinc-800" />
            <div className="h-3.5 w-24 animate-pulse rounded bg-zinc-800" />
            <div className="h-3.5 w-8 animate-pulse rounded bg-zinc-800" />
            <div className="h-3.5 w-16 animate-pulse rounded bg-zinc-800" />
          </div>
        </div>
        {/* Line 3 */}
        <div className="flex items-center gap-2">
          <div className="w-4 text-right text-xs text-zinc-700">3</div>
          <div className="flex gap-2">
            <div className="h-3.5 w-12 animate-pulse rounded bg-zinc-800" />
            <div className="h-3.5 w-8 animate-pulse rounded bg-zinc-800" />
          </div>
        </div>
        {/* Line 4 - empty */}
        <div className="flex items-center gap-2">
          <div className="w-4 text-right text-xs text-zinc-700">4</div>
        </div>
        {/* Line 5 */}
        <div className="flex items-center gap-2">
          <div className="w-4 text-right text-xs text-zinc-700">5</div>
          <div className="flex gap-2">
            <div className="h-3.5 w-10 animate-pulse rounded bg-zinc-800" />
            <div className="h-3.5 w-6 animate-pulse rounded bg-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  )
}
