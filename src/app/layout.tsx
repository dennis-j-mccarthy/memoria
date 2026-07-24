import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

// Fraunces — a modern, warm display serif for headings + prayer text.
const serif = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

// Inter — clean modern UI / labels / body.
const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Memoria — learn the prayers by heart",
  description:
    "A gorgeous, pedagogically serious app for memorizing recited texts — beginning with the prayers of the Catholic tradition.",
};

// Set the theme before paint to avoid a flash of the wrong mode.
const themeScript = `
(function () {
  try {
    var t = localStorage.getItem('memoria-theme');
    // Clean "Daylight" (white) is the default; dark is opt-in / immersive.
    document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${sans.variable} h-full antialiased`}
      // The inline themeScript sets data-theme before hydration (to avoid a
      // light-mode flash), and browser extensions add their own attributes
      // (e.g. data-kantu) — both land on <html>, so tolerate the mismatch here.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
