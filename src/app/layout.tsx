import type { Metadata } from "next";
import { Cormorant_Garamond, Barlow } from "next/font/google";
import "./globals.css";

// Cormorant Garamond — the sacred voice (display + all prayer text).
const serif = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

// Barlow — UI / labels / body.
const sans = Barlow({
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
    // Dark "Candlelight" is the hero look; default to it unless a pref is set.
    document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
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
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
