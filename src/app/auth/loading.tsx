export default function AuthLoading() {
  return (
    <div className="min-h-screen bg-paper-1 px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="neo-surface-lg animate-pulse p-8">
          <div className="mb-6 h-4 w-28 rounded bg-taupe/20" />
          <div className="mb-3 h-12 w-80 rounded bg-taupe/20" />
          <div className="mb-8 h-5 w-full max-w-xl rounded bg-taupe/10" />
          <div className="space-y-4">
            {[0, 1, 2].map((item) => (
              <div key={item} className="space-y-2">
                <div className="h-4 w-24 rounded bg-taupe/20" />
                <div className="h-11 rounded bg-taupe/10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
