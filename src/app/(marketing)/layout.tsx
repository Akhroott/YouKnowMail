import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`marketing ${plusJakarta.variable} ${sora.variable} flex min-h-full flex-1 flex-col`}>
      <SiteHeader />
      <main className="relative flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
