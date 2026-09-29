import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, FileText, CheckCircle2 } from "lucide-react";

export default function TermsOfUsePage() {
  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        {/* Header decoration */}
        <div className="relative bg-gradient-to-r from-teal-900 via-slate-900 to-slate-900 text-white p-6 sm:p-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-teal-300 hover:text-white mb-6 transition-colors font-semibold bg-white/5 px-3 py-1.5 rounded-full border border-white/10"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para o início
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-300 flex items-center justify-center shadow-inner">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Termos de Uso do Sistema
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                Última atualização: 28 de Setembro de 2026
              </p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 sm:p-10 space-y-8 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              1. Aceitação dos Termos
            </h2>
            <p>
              Ao acessar, cadastrar-se ou utilizar o sistema de gestão da <strong>Clínica Dra. Juliana Sena</strong>, você declara estar de acordo com estes Termos de Uso e com a nossa Política de Privacidade. Se você não concordar com qualquer termo aqui descrito, solicitamos que não prossiga com a utilização do software.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              2. Descrição do Serviço
            </h2>
            <p>
              Este sistema foi desenvolvido exclusivamente para fins de facilitação e otimização dos fluxos clínicos internos da Clínica Dra. Juliana Sena, contemplando:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li>Cadastro e prontuário eletrônico de pacientes;</li>
              <li>Acompanhamento clínico continuado, prescrições e evolução no padrão SOAP;</li>
              <li>Agendamento de consultas médicas integrado com a Google Calendar API.</li>
            </ul>
            <p>
              O sistema funciona como ferramenta de suporte administrativo e registro eletrônico de saúde, não substituindo o julgamento clínico presencial nem a autonomia profissional do médico responsável.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              3. Responsabilidades do Usuário &amp; Sigilo Médico
            </h2>
            <p>
              A área clínica deste sistema contém informações de saúde sensíveis e protegidas pelo sigilo profissional. São de estrita responsabilidade do usuário:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li>Garantir a confidencialidade absoluta das suas credenciais de acesso (e-mail e senha);</li>
              <li>Não compartilhar credenciais com terceiros sob qualquer hipótese;</li>
              <li>Zelar pela ética médica e pelas diretrizes do Conselho Federal de Medicina (CFM) ao registrar anamneses, evoluções clínicas e receituários;</li>
              <li>Inserir dados corretos, verídicos e atualizados dos pacientes.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              4. Propriedade Intelectual
            </h2>
            <p>
              Todo o código-fonte, layout visual, design de interface, marcas, logotipos e scripts DDL que compõem este sistema são de propriedade intelectual exclusiva da Clínica Dra. Juliana Sena e de seus desenvolvedores parceiros. É proibida a reprodução, cópia, engenharia reversa ou distribuição não autorizada deste software.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              5. Limitação de Responsabilidade
            </h2>
            <p>
              Buscamos manter o sistema operando em alta disponibilidade e com os mais rigorosos padrões de segurança. Contudo, devido à natureza volátil das redes digitais e de APIs de terceiros (como o Google Calendar e o Supabase), não nos responsabilizamos por instabilidades temporárias de conexão ou suspensão inesperada de serviços externos.
            </p>
          </section>

          {/* Bottom Call to Action */}
          <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Protegido sob regulação clínica e LGPD</span>
            </div>
            <Link
              href="/"
              className="w-full sm:w-auto text-center px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-md transition-all cursor-pointer"
            >
              Entendido e De Acordo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
