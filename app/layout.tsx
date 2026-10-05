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

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.cdnfonts.com/css/metropolis"
          crossOrigin="anonymous"
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