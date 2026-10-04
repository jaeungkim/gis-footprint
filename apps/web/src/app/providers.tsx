"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  // ponytail: useState is safe while every suspending query sits under its own
  // <Suspense>. Without one, use the getQueryClient() pattern from TanStack's
  // advanced-ssr guide.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" disableTransitionOnChange>
        <NuqsAdapter>{children}</NuqsAdapter>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
