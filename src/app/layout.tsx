import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SmartSignage by JPAT Digital — Digital Signage CMS',
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
