"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, ArrowLeft, ShieldCheck, HeartPulse, ExternalLink } from "lucide-react";

export default function TermosDeUsoPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <div className="max-w-3xl w-full space-y-8">
        
        {/* Header da Página */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Termos de Uso
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Última atualização: 28 de Setembro de 2026
              </p>
            </div>
          </div>
          
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-850 rounded-xl transition-all shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar</span>
          </button>
        </div>

        {/* Conteúdo dos Termos */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-850 rounded-3xl p-6 sm:p-10 shadow-xs space-y-6 text-sm leading-relaxed text-justify">
          
          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-base border-b border-slate-100 dark:border-slate-800/60 pb-2">
            <HeartPulse className="w-4 h-4" />
            <h2>1. Apresentação e Aceite do Sistema</h2>
          </div>
          <p>
            Bem-vindo ao sistema de <strong>Gestão de Pacientes da Dra. Juliana Sena</strong>. Este software é uma ferramenta clínica destinada a gerenciar o cadastro de pacientes, anamnese, evolução de consultas clínicas no padrão SOAP, elaboração de receitas e agendamento de consultas integradas via Google Calendar API.
          </p>
          <p>
            Ao utilizar o sistema ou clicar em &quot;Entrar&quot; na tela de login, você declara ter lido, compreendido e aceitado integralmente os presentes Termos de Uso e as disposições referentes ao tratamento de dados regulados pela nossa Política de Privacidade. Se você não concordar com estes termos, não está autorizado a acessar ou utilizar a plataforma.
          </p>

          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-base border-b border-slate-100 dark:border-slate-800/60 pb-2 pt-2">
            <ShieldCheck className="w-4 h-4" />
            <h2>2. Cadastro, Controle de Acesso e Segurança</h2>
          </div>
          <p>
            O acesso ao painel de gerenciamento de pacientes é estritamente restrito a profissionais de saúde e membros de equipes administrativas expressamente autorizados. 
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-400">
            <li>
              <strong>Confidencialidade das Credenciais:</strong> Você é inteiramente responsável por manter o sigilo de suas credenciais de login (e-mail e senha). Quaisquer ações efetuadas sob suas credenciais serão de sua única e exclusiva responsabilidade.
            </li>
            <li>
              <strong>Comunicação de Brechas:</strong> Em caso de uso não autorizado de sua conta ou de qualquer suspeita de quebra de segurança, você deverá notificar imediatamente a Dra. Juliana Sena através do endereço de e-mail <strong>[E-MAIL DE CONTATO]</strong>.
            </li>
            <li>
              <strong>Sessão Segura:</strong> A autenticação utiliza criptografia e é gerida por meio de cookies HTTP-Only e tokens JWT criptografados no servidor. É altamente recomendável clicar em &quot;Sair&quot; ao terminar suas atividades diárias.
            </li>
          </ul>

          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-base border-b border-slate-100 dark:border-slate-800/60 pb-2 pt-2">
            <HeartPulse className="w-4 h-4" />
            <h2>3. Propriedade Intelectual e Uso Permitido</h2>
          </div>
          <p>
            Todo o código-fonte, layout visual, interfaces de usuário, marcas nominativas e ilustrações deste sistema são propriedade intelectual exclusiva da Dra. Juliana Sena e de seus desenvolvedores. O uso do sistema é licenciado sob modalidade não exclusiva e revogável exclusivamente para suporte às atividades clínicas do consultório. É expressamente vedado:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-400">
            <li>Copiar, modificar ou distribuir qualquer parte da plataforma sem consentimento prévio por escrito.</li>
            <li>Praticar engenharia reversa ou tentar extrair código-fonte das ferramentas internas.</li>
            <li>Inserir dados sabidamente falsos, robôs ou automações nocivas que visem sobrecarregar o banco de dados Supabase PostgreSQL.</li>
          </ul>

          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-base border-b border-slate-100 dark:border-slate-800/60 pb-2 pt-2">
            <ShieldCheck className="w-4 h-4" />
            <h2>4. Tratamento de Dados Clínicos (Sensíveis)</h2>
          </div>
          <p>
            Por se tratar de um sistema médico, o banco de dados armazena informações relativas ao histórico clínico dos pacientes, diagnósticos, anotações de evolução e receituários. Tais informações são classificadas como <strong>dados pessoais sensíveis</strong> sob os termos da Lei Geral de Proteção de Dados (LGPD).
          </p>
          <p>
            Os profissionais de saúde que operam a plataforma comprometem-se formalmente a manter absoluto sigilo profissional (em conformidade com o Código de Ética Médica e as resoluções do Conselho Federal de Medicina - CFM). O acesso aos dados dos prontuários é protegido por regras de segurança no banco de dados (Row Level Security - RLS).
          </p>

          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-base border-b border-slate-100 dark:border-slate-800/60 pb-2 pt-2">
            <HeartPulse className="w-4 h-4" />
            <h2>5. Limitação de Responsabilidade</h2>
          </div>
          <p>
            A plataforma envidará os melhores esforços para garantir a disponibilidade contínua dos serviços. No entanto, por se tratar de um ambiente dinâmico hospedado na nuvem, não garantimos o funcionamento 100% ininterrupto em caso de falhas decorrentes de instabilidades de terceiros (como falhas na API do Google Calendar ou serviços do Supabase).
          </p>

          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-base border-b border-slate-100 dark:border-slate-800/60 pb-2 pt-2">
            <ShieldCheck className="w-4 h-4" />
            <h2>6. Alterações dos Termos e Legislação</h2>
          </div>
          <p>
            Estes termos poderão ser alterados unilateralmente para refletir atualizações regulatórias ou melhorias técnicas. O uso continuado após as alterações constitui aceitação tácita dos novos termos. Fica eleito o foro da Comarca do consultório para dirimir quaisquer conflitos jurídicos relativos a este contrato.
          </p>
          
          <p className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 text-center">
            Dúvidas, sugestões ou suporte técnico? Entre em contato pelo e-mail <strong>[E-MAIL DE CONTATO]</strong>.
          </p>
        </div>

        {/* Rodapé Alternador para a Política de Privacidade */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs bg-slate-100 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/50">
          <span className="font-medium text-slate-500 dark:text-slate-400">
            Deseja ler sobre a privacidade dos dados?
          </span>
          <Link
            href="/politica-de-privacidade"
            className="inline-flex items-center gap-1.5 font-bold text-teal-700 dark:text-teal-400 hover:underline hover:text-teal-800 cursor-pointer"
          >
            <span>Ver Política de Privacidade</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>
    </div>
  );
}
