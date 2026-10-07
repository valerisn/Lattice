"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="welcome">
      <h1>Something went wrong.</h1>
      <p>Your knowledge is still here. Please try again.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
