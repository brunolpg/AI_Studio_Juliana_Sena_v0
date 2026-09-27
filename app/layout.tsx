import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Juliana Sena - Gestão de Pacientes',
  description: 'Sistema moderno para cadastro, consulta e gestão de pacientes com validação Zod, cálculo automático de idade, soft delete e integração Supabase.',
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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
