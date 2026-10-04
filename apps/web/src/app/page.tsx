"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ErrorBoundary, Suspense } from "@suspensive/react";
import { SuspenseQuery } from "@suspensive/react-query-5";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { clamp } from "es-toolkit";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useQueryState } from "nuqs";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { create } from "zustand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

// ponytail: module-level store is fine while it holds no per-request data.
// Otherwise use the per-request store from zustand's Next.js guide.
const useCounter = create<{ count: number; add: (by: number) => void }>()(
  (set) => ({
    count: 0,
    add: (by) => set((s) => ({ count: clamp(s.count + by, 0, 10) })),
  }),
);

const schema = z.object({
  name: z.string().trim().min(2, "At least 2 characters"),
});

export default function Home() {
  const { reset } = useQueryErrorResetBoundary();
  const { resolvedTheme, setTheme } = useTheme();
  const { count, add } = useCounter();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 p-6">
      <Button
        variant="outline"
        size="icon"
        aria-label="Toggle theme"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        <Sun className="dark:hidden" />
        <Moon className="hidden dark:block" />
      </Button>

      <ErrorBoundary
        onReset={reset}
        fallback={({ reset }) => (
          <Button variant="destructive" onClick={reset}>
            API unreachable. Retry
          </Button>
        )}
      >
        {/* clientOnly: the relative /api URL cannot be fetched during SSR. */}
        <Suspense clientOnly fallback={<p>API status: loading</p>}>
          <SuspenseQuery
            queryKey={["health"]}
            queryFn={async () => {
              const { data, error } = await api.GET("/api/health");
              if (error) throw error;
              return data;
            }}
          >
            {({ data }) => <p>API status: {data.status}</p>}
          </SuspenseQuery>
        </Suspense>
      </ErrorBoundary>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          aria-label="Decrement"
          onClick={() => add(-1)}
        >
          -
        </Button>
        <span aria-label="Count">{count}</span>
        <Button variant="outline" aria-label="Increment" onClick={() => add(1)}>
          +
        </Button>
      </div>

      {/* nuqs reads search params, which needs a Suspense boundary in Next. */}
      <Suspense>
        <Greeting />
      </Suspense>
    </main>
  );
}

function Greeting() {
  const [name, setName] = useQueryState("name", { defaultValue: "" });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { name } });

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={handleSubmit((data) => {
        setName(data.name);
        toast.success(`Hi ${data.name}`);
      })}
    >
      <p>{name ? `Hello, ${name}` : "Who are you?"}</p>
      <div className="flex gap-2">
        <Input
          aria-label="Name"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        <Button type="submit">Greet</Button>
      </div>
      {errors.name && (
        <p role="alert" className="text-sm text-destructive">
          {errors.name.message}
        </p>
      )}
    </form>
  );
}
