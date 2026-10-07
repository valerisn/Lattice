import Link from "next/link";
export default function NotFound() {
  return (
    <main className="welcome">
      <h1>Page not found</h1>
      <p>This page may have moved, or you may not have access.</p>
      <Link href="/">Back to your workspace</Link>
    </main>
  );
}
