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
  title: "PACTYRA — Verified Outcomes Become Enforceable Economic Authority",
  description: "PACTYRA turns verified outcomes into enforceable economic authority on Solana. The consequence layer that sits after objective verification — authority is earned and revoked on-chain.",
  keywords: ["PACTYRA", "Solana", "AI Agents", "Authority", "Verified Outcomes", "Evidence-Bound", "Anchor", "Hackathon"],
  authors: [{ name: "PACTYRA" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "PACTYRA — Verified Outcomes Become Enforceable Economic Authority",
    description: "The consequence layer that turns verified outcomes into enforceable economic authority. $5 → $50 → $500 → $5.",
    url: "https://chat.z.ai",
    siteName: "PACTYRA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PACTYRA — Verified Outcomes Become Enforceable Economic Authority",
    description: "PACTYRA turns verified outcomes into enforceable economic authority on Solana.",
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
