"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldAlert, ArrowLeft, ShieldCheck, HeartPulse, ExternalLink } from "lucide-react";

export default function PoliticaDePrivacidadePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <div className="max-w-3xl w-full space-y-8">
        
        {/* Header da Página */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Política de Privacidade
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

        {/* Conteúdo da Política */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-850 rounded-3xl p-6 sm:p-10 shadow-xs space-y-6 text-sm leading-relaxed text-justify">
          
          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-base border-b border-slate-100 dark:border-slate-800/60 pb-2">
            <HeartPulse className="w-4 h-4" />
            <h2>1. Introdução e Compromisso com a LGPD</h2>
          </div>
          <p>
            Esta <strong>Política de Privacidade</strong> descreve como o sistema de Gestão de Pacientes da <strong>Dra. Juliana Sena</strong> coleta, utiliza, armazena, protege e descarta as informações de seus pacientes e usuários clínicos, de forma transparente e em estrita conformidade com a <strong>Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD)</strong>.
          </p>
          <p>
            Temos o compromisso inabalável de resguardar a privacidade de quem acessa nosso portal e garantir que todo tratamento de dados ocorra de maneira ética e legal.
          </p>

          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-base border-b border-slate-100 dark:border-slate-800/60 pb-2 pt-2">
            <ShieldCheck className="w-4 h-4" />
            <h2>2. Quais Dados Coletamos e Tratamos</h2>
          </div>
          <p>
            A plataforma processa duas categorias fundamentais de dados:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-400">
            <li>
              <strong>Dados Pessoais Cadastrais:</strong> Nome completo, CPF, data de nascimento (usada para o cálculo automático e dinâmico de idade no servidor), e-mail, telefone para contato, gênero e endereço residencial.
            </li>
            <li>
              <strong>Dados Pessoais Sensíveis de Saúde:</strong> Histórico médico detalhado (anamnese), anotações de evolução de consulta clínica (no formato SOAP), registros de sinais vitais, medicamentos de uso contínuo, alergias mapeadas e receituários gerados.
            </li>
          </ul>

          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-base border-b border-slate-100 dark:border-slate-800/60 pb-2 pt-2">
            <ShieldAlert className="w-4 h-4" />
            <h2>3. Base Legal e Finalidade do Tratamento</h2>
          </div>
          <p>
            O tratamento de dados sensíveis de saúde é fundamentado legalmente nos incisos de tutela de saúde e obrigação legal da LGPD. As finalidades específicas são:
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-slate-600 dark:text-slate-400">
            <li>
              <strong>Tutela da Saúde:</strong> Mapear o histórico médico para embasar as evoluções clínicas, diagnósticos seguros e prescrições médicas precisas efetuadas pela Dra. Juliana Sena.
            </li>
            <li>
              <strong>Gestão de Atendimentos:</strong> Sincronizar as consultas agendadas com a API do Google Agenda do consultório, permitindo o agendamento em horários clínicos estruturados de 1 em 1 hora.
            </li>
            <li>
              <strong>Segurança e Identificação:</strong> Identificar unicamente o usuário que está acessando e mutando o painel de pacientes através de credenciais criptografadas e autenticação via Supabase.
            </li>
          </ol>

          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-base border-b border-slate-100 dark:border-slate-800/60 pb-2 pt-2">
            <ShieldCheck className="w-4 h-4" />
            <h2>4. Segurança da Informação e Armazenamento</h2>
          </div>
          <p>
            Adotamos medidas técnicas, administrativas e de segurança de última geração para proteger as informações contra acessos não autorizados, vazamentos, modificações ou perdas. Entre as principais salvaguardas técnicas, destacam-se:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-400">
            <li>
              <strong>Row Level Security (RLS) no PostgreSQL:</strong> Cada consulta ao banco de dados Supabase é regulada por políticas que barram acessos não autenticados ou por perfis que não tenham privilégios adequados.
            </li>
            <li>
              <strong>Soft Delete (Exclusão Lógica):</strong> Para prevenir exclusões acidentais de históricos clínicos fundamentais, o sistema marca pacientes excluídos com um carimbo de data (campo <code>deleted_at</code>) e os oculta das listagens ativas, permitindo auditorias e recuperação se necessário.
            </li>
            <li>
              <strong>Sessões com Cookie Seguro:</strong> Tokens de sessão JWT geridos por HTTP-Only cookies que evitam ataques de cross-site scripting (XSS).
            </li>
          </ul>

          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-base border-b border-slate-100 dark:border-slate-800/60 pb-2 pt-2">
            <HeartPulse className="w-4 h-4" />
            <h2>5. Direitos do Titular de Dados</h2>
          </div>
          <p>
            A LGPD garante aos titulares de dados diversos direitos fundamentais. A qualquer momento, mediante requisição simples por escrito, o paciente cadastrado poderá solicitar:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-400">
            <li><strong>Confirmação e Acesso:</strong> Obter a confirmação de que seus dados estão sendo tratados e acessar seu prontuário clínico.</li>
            <li><strong>Correção:</strong> Solicitar a retificação imediata de dados incompletos, inexatos ou desatualizados.</li>
            <li><strong>Portabilidade:</strong> Requerer a portabilidade de seu prontuário clínico para outro profissional ou estabelecimento de saúde.</li>
            <li><strong>Eliminação de Dados:</strong> Requerer a eliminação definitiva de dados desnecessários ou tratados em desconformidade com a LGPD (salvo quando a guarda for obrigatória por lei, como arquivos de prontuário por 20 anos em cumprimento às normas do CFM).</li>
          </ul>

          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-base border-b border-slate-100 dark:border-slate-800/60 pb-2 pt-2">
            <ShieldAlert className="w-4 h-4" />
            <h2>6. Contato com o Encarregado de Proteção de Dados (DPO)</h2>
          </div>
          <p>
            Caso você tenha dúvidas sobre esta Política de Privacidade, queira exercer seus direitos de titular descritos acima, ou precise reportar qualquer incidente de privacidade, por favor entre em contato com o Encarregado pelo Tratamento de Dados Pessoais (DPO) da clínica pelo e-mail:
          </p>
          <div className="p-4 bg-teal-50 dark:bg-teal-950/25 border border-teal-200 dark:border-teal-900 rounded-2xl text-center">
            <p className="font-bold text-teal-950 dark:text-teal-200">
              Encarregado (DPO): Dra. Juliana Sena (Especialista em Gestão Clínica)
            </p>
            <p className="text-xs font-mono text-teal-700 dark:text-teal-400 mt-1">
              <strong>[E-MAIL DE CONTATO]</strong>
            </p>
          </div>
          
        </div>

        {/* Rodapé Alternador para os Termos de Uso */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs bg-slate-100 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/50">
          <span className="font-medium text-slate-500 dark:text-slate-400">
            Deseja ler as regras de uso do sistema?
          </span>
          <Link
            href="/termos-de-uso"
            className="inline-flex items-center gap-1.5 font-bold text-teal-700 dark:text-teal-400 hover:underline hover:text-teal-800 cursor-pointer"
          >
            <span>Ver Termos de Uso</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>
    </div>
  );
}
