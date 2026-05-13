export default function PageLoading() {
  return (
    <div className="space-y-4">
      <div>
        <div className="h-8 w-[220px] animate-pulse rounded-md bg-[var(--border)]" />
        <div className="mt-2 h-5 w-[360px] max-w-full animate-pulse rounded-md bg-[var(--soft-bg)]" />
      </div>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="h-5 w-1/3 animate-pulse rounded-md bg-[var(--border)]" />
        <div className="mt-4 h-4 w-full animate-pulse rounded-md bg-[var(--soft-bg)]" />
        <div className="mt-3 h-4 w-3/4 animate-pulse rounded-md bg-[var(--soft-bg)]" />
      </div>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="mb-3 h-4 animate-pulse rounded-md bg-[var(--soft-bg)]" style={{ width: `${index % 3 === 0 ? 92 : index % 3 === 1 ? 78 : 86}%` }} />
        ))}
      </div>
    </div>
  );
}
