import { SiteHeader } from "@/components/layout/site-header";

export default function PortalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex h-dvh flex-col">
      <SiteHeader />
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}
