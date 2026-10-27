/** Shown the moment a tab is tapped, while the next admin page loads. */
export default function AdminLoading() {
  return (
    <div className="animate-pulse" aria-busy aria-label="Loading">
      <div className="skeleton h-10 w-48" />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-36 rounded-[22px]" />
        ))}
      </div>
    </div>
  );
}
