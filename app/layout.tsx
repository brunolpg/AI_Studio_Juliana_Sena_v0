import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: 'Juliana Sena - Gestão de Pacientes',
  description: 'Sistema moderno para cadastro, consulta e gestão de pacientes com validação Zod, cálculo automático de idade, soft delete e integração Supabase.',
  verification: {
    google: 'f1qBkB_WCM3Zg-xBNRyrvXctx6hNFEnwKiAXdFY0gOA',
  },
  openGraph: {
    title: 'Juliana Sena - Gestão de Pacientes',
    description: 'Sistema moderno para cadastro, consulta e gestão de pacientes com validação Zod, cálculo automático de idade, soft delete e integração Supabase.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Juliana Sena - Gestão de Pacientes',
    description: 'Sistema moderno para cadastro, consulta e gestão de pacientes com validação Zod, cálculo automático de idade, soft delete e integração Supabase.',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}