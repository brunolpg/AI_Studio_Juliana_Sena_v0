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
          href="https://cdn.jsdelivr.net/npm/@fontsource/metropolis@5.0.8/index.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@fontsource/metropolis@5.0.8/500.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@fontsource/metropolis@5.0.8/600.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@fontsource/metropolis@5.0.8/700.css"
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