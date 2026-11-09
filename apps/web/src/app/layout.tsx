import type { Metadata } from "next";
import localFont from "next/font/local";
import AppChrome from "@/components/product/AppChrome";
import "./globals.css";
import "./ux-priorities.css";
import '@/components/product/managed-product.css';

const displayFont = localFont({
  src: "./fonts/space-grotesk-latin.woff2",
  variable: "--font-display",
  weight: "500 700",
  display: "swap",
});

const sansFont = localFont({
  src: "./fonts/manrope-latin.woff2",
  variable: "--font-sans",
  weight: "400 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Arka.fund",
  description: "Vault intelligence, discovery and operations for Arka managers and depositors.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${sansFont.variable} antialiased`}>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
