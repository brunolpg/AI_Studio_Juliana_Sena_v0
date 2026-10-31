"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  ClipboardList,
  Search,
  Plus,
  Trash2,
  Edit2,
  Printer,
  ShieldCheck,
  Calendar,
  Users,
  ChevronDown,
  Sparkles,
  FileText,
  Pill,
  ListChecks,
  AlertCircle,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { AppHeader } from "@/components/shared/app-header";
import { PopFormModal } from "./pop-form-modal";
import { PrintPopModal } from "@/components/print-pop-modal";
import { getPopsByPaciente, excluirPop } from "@/app/actions/pops";
import { useToast } from "@/components/ui/toast";
import type { PopProtocoloCompleto } from "@/types/pop";
import type { Client } from "@/types/client";

interface PopsViewProps {
  initialPatients: Client[];
}

function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const clean = dateStr.split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function PopsView({ initialPatients }: PopsViewProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [patients, setPatients] = useState<Client[]>(initialPatients);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    initialPatients.length > 0 ? initialPatients[0].id : null
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Lista de POPs do paciente selecionado
  const [pops, setPops] = useState<PopProtocoloCompleto[]>([]);
  const [isLoadingPops, setIsLoadingPops] = useState(false);

  // Modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [popToEdit, setPopToEdit] = useState<PopProtocoloCompleto | null>(null);
  const [popToPrint, setPopToPrint] = useState<PopProtocoloCompleto | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fecha dropdown de paciente ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Paciente selecionado
  const selectedPatient = useMemo(() => {
    if (!selectedPatientId) return null;
    return patients.find((p) => p.id === selectedPatientId) || null;
  }, [patients, selectedPatientId]);

  // Filtro de busca de pacientes
  const filteredPatients = useMemo(() => {
    if (!searchTerm.trim()) return patients;
    const q = searchTerm.toLowerCase().trim();
    return patients.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        (p.cpf && p.cpf.includes(q)) ||
        (p.telefone && p.telefone.includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q))
    );
  }, [patients, searchTerm]);

  // Carrega POPs sempre que trocar de paciente
  const loadPops = async (patientId: string) => {
    setIsLoadingPops(true);
    try {
      const data = await getPopsByPaciente(patientId);
      setPops(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar POPs do paciente:", err);
      toast({
        type: "error",
        title: "Erro ao Carregar",
        description: "Falha ao carregar os POPs do paciente.",
      });
    } finally {
      setIsLoadingPops(false);
    }
  };

  useEffect(() => {
    if (selectedPatientId) {
      loadPops(selectedPatientId);
    } else {
      setPops([]);
    }
  }, [selectedPatientId]);

  // Ações de gerenciamento dos POPs
  const handleOpenNew = () => {
    if (!selectedPatient) {
      toast({
        type: "info",
        title: "Selecione um Paciente",
        description: "Por favor, selecione um paciente para cadastrar o POP.",
      });
      return;
    }
    setPopToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleEdit = (pop: PopProtocoloCompleto) => {
    setPopToEdit(pop);
    setIsFormModalOpen(true);
  };

  const handleDelete = async (pop: PopProtocoloCompleto) => {
    if (
      !confirm(
        `Tem certeza que deseja excluir o Procedimento "${pop.protocolo}"? Esta ação removerá os tópicos e vínculos associados permanentemente.`
      )
    ) {
      return;
    }

    setDeletingId(pop.id);
    try {
      const res = await excluirPop(pop.id);
      if (res.error) {
        toast({
          type: "error",
          title: "Erro na Exclusão",
          description: res.error,
        });
      } else {
        toast({
          type: "success",
          title: "POP Excluído",
          description: `"${pop.protocolo}" foi removido com sucesso.`,
        });
        if (selectedPatientId) {
          loadPops(selectedPatientId);
        }
      }
    } catch (err: any) {
      toast({
        type: "error",
        title: "Erro",
        description: err?.message || "Falha ao excluir procedimento.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Contadores para métricas
  const totalTopicos = useMemo(() => {
    return pops.reduce(
      (acc, p) => acc + (p.blocos?.filter((b) => b.tipo === "TOPICO").length || 0),
      0
    );
  }, [pops]);

  const totalPrescricoes = useMemo(() => {
    return pops.reduce(
      (acc, p) => acc + (p.blocos?.filter((b) => b.tipo === "PRESCRICAO").length || 0),
      0
    );
  }, [pops]);

  return (
    <div className="font-['Plus_Jakarta_Sans',sans-serif] min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col box-border w-full max-w-full min-w-0 overflow-x-hidden pb-16 landscape:pb-8 lg:pl-64">
      {/* App Header */}
      <AppHeader
        currentTab="pops"
        onTabChange={(tab) => {
          if (tab === "pacientes" || tab === "prontuarios" || tab === "agendamentos") {
            router.push("/dashboard");
          }
        }}
      />

      {/* Container Principal */}
      <main className="md4-main-content flex-1 min-w-0 w-full px-4 sm:px-8 py-4 sm:py-6 lg:px-10 lg:py-8 space-y-4 sm:space-y-6 box-border overflow-x-hidden max-lg:landscape:space-y-3 max-lg:landscape:pt-2 max-lg:landscape:pl-20 max-lg:landscape:pr-5">
        {/* Hero Card do Módulo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-r from-[#003830] via-[#004d40] to-[#022c22] text-white p-4 sm:p-5 lg:p-8 landscape:max-md:py-3 landscape:max-md:px-4 shadow-sm dark:border dark:border-emerald-900/40 w-full min-w-0 box-border font-['Plus_Jakarta_Sans',sans-serif]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 sm:gap-3">
                <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-emerald-300 shrink-0" />
                <h1 className="text-base sm:text-lg md:text-2xl lg:text-3xl font-bold tracking-tight text-white">
                  Procedimento Operacional Padrão (POP)
                </h1>
              </div>
              <p className="text-[11px] sm:text-xs md:text-sm text-emerald-200/85 font-medium mt-0.5 sm:mt-1 leading-snug">
                Protocolos Clínicos, Tópicos Operacionais e Prescrições Integradas
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenNew}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer self-start sm:self-auto shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Novo POP</span>
            </button>
          </div>
        </motion.div>

        {/* Barra de Seleção / Busca de Paciente */}
        <div className="w-full p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 w-full">
            <div className="flex-1 min-w-[240px] w-full min-w-0">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                Selecione o Prontuário do Paciente
              </label>

              <div className="w-full min-w-0 relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 text-left cursor-pointer hover:border-emerald-500/80 transition-colors shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 overflow-hidden flex-1">
                    <div className="w-8 h-8 rounded-full bg-emerald-700 dark:bg-emerald-500 text-white dark:text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                      {selectedPatient?.nome ? selectedPatient.nome.charAt(0).toUpperCase() : "P"}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block truncate">
                        {selectedPatient?.nome || "Selecione um paciente..."}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                        CPF: {selectedPatient?.cpf || "---"} • {selectedPatient?.idade} anos
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      isDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Dropdown Popup */}
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-30 p-2 space-y-2 max-h-72 overflow-hidden flex flex-col">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por nome, CPF ou telefone..."
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 border border-slate-200 dark:border-slate-700"
                        autoFocus
                      />
                    </div>

                    <div className="overflow-y-auto space-y-1 flex-1">
                      {filteredPatients.length === 0 ? (
                        <div className="text-center py-4 text-xs text-slate-400">
                          Nenhum paciente encontrado.
                        </div>
                      ) : (
                        filteredPatients.map((p) => {
                          const isSel = p.id === selectedPatientId;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedPatientId(p.id);
                                setIsDropdownOpen(false);
                                setSearchTerm("");
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                                isSel
                                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-bold"
                                  : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              <div className="truncate">
                                <span className="block truncate">{p.nome}</span>
                                <span className="text-[10px] text-slate-400 block truncate">
                                  CPF: {p.cpf} • {p.cidade || "Salvador"}
                                </span>
                              </div>
                              {isSel && (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0 font-bold">
                                  Ativo
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Ações Rápidas à Direita */}
            {selectedPatient && (
              <div className="flex items-center gap-2 self-start md:self-end pt-2 md:pt-0">
                <button
                  type="button"
                  onClick={handleOpenNew}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cadastrar Novo POP</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Metrics do Paciente */}
        {selectedPatient && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Total de POPs
              </span>
              <strong className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 block mt-0.5">
                {pops.length}
              </strong>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Tópicos Operacionais
              </span>
              <strong className="text-xl sm:text-2xl font-black text-teal-600 dark:text-teal-400 block mt-0.5">
                {totalTopicos}
              </strong>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Prescrições Vinculadas
              </span>
              <strong className="text-xl sm:text-2xl font-black text-sky-600 dark:text-sky-400 block mt-0.5">
                {totalPrescricoes}
              </strong>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Assinados SHA-256
              </span>
              <strong className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">
                {pops.filter((p) => Boolean(p.payload_hash)).length}
              </strong>
            </div>
          </div>
        )}

        {/* Lista de POPs Cadastrados */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Procedimentos Operacionais Cadastrados ({pops.length})
              </h2>
            </div>

            {selectedPatient && (
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Prontuário de {selectedPatient.nome}
              </span>
            )}
          </div>

          {isLoadingPops ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-semibold">
                Carregando protocolos e prescrições...
              </p>
            </div>
          ) : pops.length === 0 ? (
            <div className="p-10 sm:p-14 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center mx-auto text-teal-600 dark:text-teal-400">
                <ClipboardList className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Nenhum POP Cadastrado
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Este paciente ainda não possui nenhum Procedimento Operacional Padrão registrado.
                  Crie o primeiro protocolo intercalando tópicos operacionais e receitas médicas.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenNew}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Criar Primeiro POP</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 w-full">
              {pops.map((pop) => {
                const blocos = pop.blocos || [];
                const topicosCount = blocos.filter((b) => b.tipo === "TOPICO").length;
                const prescricoesCount = blocos.filter((b) => b.tipo === "PRESCRICAO").length;
                const subtopicosCount = blocos.reduce(
                  (acc, b) => acc + (b.subtopicos?.length || 0),
                  0
                );

                return (
                  <div
                    key={pop.id}
                    className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-teal-500/40 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Topo do Card */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex-1 min-w-[200px]">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 uppercase tracking-wider">
                              POP
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              SHA-256:{" "}
                              {pop.payload_hash ? pop.payload_hash.substring(0, 8) : "ASSINADO"}...
                            </span>
                          </div>

                          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                            {pop.protocolo}
                          </h3>

                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              Emitido em {formatDateBR(pop.data_pop)}
                            </span>
                            <span>•</span>
                            <span>{pop.profissional || "Dra. Juliana Sena"}</span>
                            {pop.appointment && (
                              <>
                                <span>•</span>
                                <span className="text-teal-600 dark:text-teal-400">
                                  Consulta: {pop.appointment.procedimento}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Botões de Ação do Card */}
                        <div className="flex items-center gap-2 shrink-0 self-start">
                          <button
                            type="button"
                            onClick={() => setPopToPrint(pop)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 bg-white dark:bg-slate-800 border border-teal-200 dark:border-slate-700 hover:bg-teal-50 dark:hover:bg-slate-700 rounded-full cursor-pointer transition-colors shadow-2xs"
                            title="Visualizar e imprimir relatório oficial A4"
                          >
                            <Printer className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                            <span>Gerar Relatório</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleEdit(pop)}
                            className="p-1.5 rounded-full text-slate-400 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Editar POP"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(pop)}
                            disabled={deletingId === pop.id}
                            className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Excluir POP"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Finalidade do POP */}
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-3 leading-relaxed">
                        {pop.finalidade}
                      </p>

                      {/* Resumo dos Blocos e Contadores */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                          <span className="text-slate-500 font-medium">Tópicos:</span>
                          <strong className="text-slate-800 dark:text-slate-200 font-bold">
                            {topicosCount}
                          </strong>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                          <span className="text-slate-500 font-medium">Subtópicos:</span>
                          <strong className="text-slate-800 dark:text-slate-200 font-bold">
                            {subtopicosCount}
                          </strong>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                          <span className="text-slate-500 font-medium">Prescrições:</span>
                          <strong className="text-teal-600 dark:text-teal-400 font-bold">
                            {prescricoesCount}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal de Formulário de POP */}
      {selectedPatient && (
        <PopFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          paciente={selectedPatient}
          popToEdit={popToEdit}
          onSuccess={() => {
            if (selectedPatientId) {
              loadPops(selectedPatientId);
            }
          }}
        />
      )}

      {/* Modal de Relatório e Impressão A4 */}
      {popToPrint && (
        <PrintPopModal
          isOpen={Boolean(popToPrint)}
          onClose={() => setPopToPrint(null)}
          pop={popToPrint}
          client={selectedPatient}
        />
      )}
    </div>
  );
}
