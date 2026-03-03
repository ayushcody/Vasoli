import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/hooks/query-provider";
import { Toaster } from "sonner";

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter',
});

const fraunces = Fraunces({ 
  subsets: ["latin"],
  variable: '--font-fraunces',
  weight: ['600', '700', '800'],
});

export const metadata: Metadata = {
  title: "Vasoli - Smart Personal Finance",
  description: "AI-powered personal finance management",
  icons: {
    icon: '/vasoli_logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${fraunces.variable} font-sans`}>
        <QueryProvider>
          {children}
          <Toaster 
            position="top-right"
            richColors
            closeButton
            duration={5000}
          />
        </QueryProvider>
      </body>
    </html>
  );
}
