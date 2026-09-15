import type { Metadata } from "next";
import { AppProviders } from "@/components/providers/AppProviders";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Misa.lol \u2014 your corner of the internet",
  description: "A premium profile experience for creators.",
  icons: {
    icon: [
      { url: "/dashboard/favicon.svg", type: "image/svg+xml" },
      { url: "/dashboard/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/dashboard/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body suppressHydrationWarning><AppProviders>{children}</AppProviders></body></html>;
}
