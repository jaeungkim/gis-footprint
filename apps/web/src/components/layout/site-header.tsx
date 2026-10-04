import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";

export function SiteHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-6 border-b px-4">
      <Link href="/" className="font-semibold">
        Footprint
      </Link>
      <nav className="flex gap-4 text-sm">
        <Link href="/">탐색</Link>
      </nav>
      <div className="ml-auto">
        <ModeToggle />
      </div>
    </header>
  );
}
