"use client";

import { Button } from "@/components/ui/button";

// ponytail: no error reporting. Take the `error` prop and send it to Sentry etc. when you add one.
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 p-6">
      <p>Something went wrong.</p>
      <Button onClick={() => retry()}>Try again</Button>
    </main>
  );
}
