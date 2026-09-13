import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from '@/components/theme-provider';
import { ToastProvider } from '@/components/ui';
import { AppHeader } from '@/components/app-header';

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trackmoco",
  description: "Installment payment tracking for shared due dates and reminders.",
  manifest: "/manifest.json",
  themeColor: "#1C1B1F",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Trackmoco",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <ToastProvider>
            <AppHeader />
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
