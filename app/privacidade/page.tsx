import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, Eye, Lock } from "lucide-react";

export default function PrivacyPolicyPage() {
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
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Política de Privacidade (LGPD)
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
              <Eye className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              1. Coleta de Dados (Pacientes e Profissionais)
            </h2>
            <p>
              Em conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/18)</strong>, este sistema realiza a coleta e tratamento de dados estritamente necessários para o atendimento clínico e agendamento de consultas.
            </p>
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
              Dados dos Pacientes que são coletados e armazenados:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li>Identificação básica: Nome completo, CPF, Data de Nascimento e Idade (calculada de forma segura);</li>
              <li>Contatos: E-mail, Telefone/WhatsApp e Endereço de residência;</li>
              <li>Dados de Saúde (Sensíveis): Histórico médico, anamneses, evoluções clínicas (SOAP), alergias informadas e receitas expedidas.</li>
            </ul>
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs mt-2">
              Dados dos Profissionais de Saúde:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li>Nome, E-mail profissional, perfil de acesso e credenciais de segurança criptografadas (Hash de senha).</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              2. Finalidade do Tratamento dos Dados
            </h2>
            <p>
              O tratamento de dados sensíveis de saúde é realizado com fulcro no art. 7º, VIII e art. 11, II, &quot;a&quot; da LGPD, para fins exclusivos de:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li>Tutela da saúde, agendamento médico, triagem e controle de prontuário continuado;</li>
              <li>Sincronização de horários de consulta e prevenção de duplicidade de agendamentos (utilizando a API externa e segura do Google Calendar);</li>
              <li>Garantia de segurança da informação e auditoria de ações (registro de quais usuários realizaram alterações e criações).</li>
            </ul>
            <p>
              Os dados coletados neste sistema nunca serão compartilhados, vendidos ou alugados com laboratórios, empresas de publicidade ou quaisquer terceiros.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              3. Armazenamento Seguro dos Prontuários
            </h2>
            <p>
              Seguindo altos padrões de cibersegurança e sigilo exigidos pela medicina, todas as informações de prontuários, evoluções e alergias são armazenadas em nuvem criptografada no banco de dados Supabase PostgreSQL:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li>Políticas estritas de Row Level Security (RLS) habilitadas diretamente no PostgreSQL;</li>
              <li>Sessão baseada em JSON Web Token (JWT) com verificação automática no servidor (Server Actions);</li>
              <li>Exclusão lógica de pacientes (Soft Delete) com registro de auditoria, permitindo recuperação de acidentes apenas por administradores autorizados.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              4. Direitos do Titular dos Dados (Pacientes)
            </h2>
            <p>
              Conforme o artigo 18 da LGPD, os pacientes cadastrados possuem direitos inalienáveis sobre suas informações clínicas, podendo solicitar a qualquer momento por intermédio da equipe clínica:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li>Confirmação da existência de tratamento e acesso completo aos dados armazenados;</li>
              <li>Correção de prontuários ou contatos incompletos, inexatos ou desatualizados;</li>
              <li>Exclusão permanente de dados pessoais e clínicos (respeitando os prazos legais de guarda de prontuários exigidos pelo CFM).</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              5. Contato sobre Privacidade
            </h2>
            <p>
              Para esclarecer dúvidas sobre esta Política de Privacidade ou exercer direitos descritos na LGPD, por favor entre em contato com o Encarregado de Proteção de Dados (DPO) da Clínica Dra. Juliana Sena através de nosso canal oficial de comunicação clínica.
            </p>
          </section>

          {/* Bottom Call to Action */}
          <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Lock className="w-4 h-4 text-teal-600" />
              <span>Criptografia de ponta a ponta ativa</span>
            </div>
            <Link
              href="/"
              className="w-full sm:w-auto text-center px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-md transition-all cursor-pointer"
            >
              Declaro que Li e Aceito
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
