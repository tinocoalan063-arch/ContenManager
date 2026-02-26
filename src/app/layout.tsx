import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SignageFlow — Digital Signage CMS',
  description: 'Administra contenido digital y distribúyelo a tus pantallas de forma remota',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
