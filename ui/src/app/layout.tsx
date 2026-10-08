import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { WalletContextProvider } from "@/components/wallet-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PACTYRA — Economic Authority Layer for Autonomous Agents",
  description: "AI agents already have keys. PACTYRA makes them earn the right to use them. Evidence-bound authority protocol on Solana.",
  keywords: ["PACTYRA", "Solana", "AI Agents", "Authority", "Evidence-Bound", "Anchor", "Hackathon"],
  authors: [{ name: "PACTYRA" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "PACTYRA — Economic Authority Layer for Autonomous Agents",
    description: "Evidence-bound economic authority for AI agents on Solana. $5 → $50 → $500 → $5.",
    url: "https://chat.z.ai",
    siteName: "PACTYRA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PACTYRA — Economic Authority Layer for Autonomous Agents",
    description: "Evidence-bound economic authority for AI agents on Solana.",
  },
};

const themeScript = `(function(){try{var t=localStorage.getItem('pactyra-theme');if(t==='light'){document.documentElement.classList.remove('dark');}else{document.documentElement.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <WalletContextProvider>
          {children}
        </WalletContextProvider>
        <Toaster />
      </body>
    </html>
  );
}
