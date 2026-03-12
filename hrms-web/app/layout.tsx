import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { AbortErrorHandler } from "@/components/AbortErrorHandler";
import { WebhookTestModeProvider } from "@/lib/context/webhook-test-mode";
import { SupabaseAuthProvider } from "@/lib/context/supabase-auth";
import { WorkspaceProvider } from "@/lib/context/workspace";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HRMS Belarus",
  description: "Система учёта кадров",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script
          id="suppress-abort-error"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  function isAbort(e) {
    if (e && typeof e === 'object') {
      if (e.name === 'AbortError') return true;
      if (e.code === 'ABORT_ERR') return true;
      if (typeof e.message === 'string' && e.message.toLowerCase().indexOf('aborted') !== -1) return true;
    }
    if (typeof e === 'string' && e.toLowerCase().indexOf('aborted') !== -1) return true;
    return false;
  }
  window.addEventListener('unhandledrejection', function(ev) {
    if (isAbort(ev.reason)) { ev.preventDefault(); ev.stopImmediatePropagation(); }
  }, true);
  window.addEventListener('error', function(ev) {
    if (isAbort(ev.error) || isAbort(ev.message)) { ev.preventDefault(); ev.stopPropagation(); return true; }
  }, true);
})();
            `.trim(),
          }}
        />
        <ThemeProvider>
          <AbortErrorHandler>
            <WebhookTestModeProvider>
              <SupabaseAuthProvider>
                <WorkspaceProvider>
                  {children}
                  <Toaster richColors position="top-center" />
                </WorkspaceProvider>
              </SupabaseAuthProvider>
            </WebhookTestModeProvider>
          </AbortErrorHandler>
        </ThemeProvider>
      </body>
    </html>
  );
}
