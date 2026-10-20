"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  HeartHandshake,
  Clock,
  Pill,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import {
  getHomeCareCatalogAndFormulas,
  getPatientAppointments,
  saveHomeCareFicha,
} from "@/app/actions/home-care";
import type {
  HomeCareTopico,
  HomeCareFichaCompleta,
  SaveHomeCareFichaInput,
  HomeCareStatus,
} from "@/types/home-care";

interface HomeCareModalProps {
  isOpen: boolean;
  onClose: () => void;
  pacienteId?: string;
  pacienteNome?: string;
  initialAppointmentId?: string;
  initialData?: HomeCareFichaCompleta | null;
  onSuccess?: (newFichaId?: string) => void;
  zIndex?: string;
}

interface CuidadoFormItem {
  id?: string;
  topico_id?: string;
  titulo: string;
  texto: string;
}

interface CronogramaFormItem {
  id?: string;
  dia_inicio: number;
  dia_fim: number;
  fase_titulo?: string;
  formula_id?: string;
  nome_formula: string;
  posologia: string;
  objetivo_clinico: string;
}

function getTodayISODate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function HomeCareModal({
  isOpen,
  onClose,
  pacienteId,
  pacienteNome,
  initialAppointmentId,
  initialData,
  onSuccess,
  zIndex = "z-[999999]",
}: HomeCareModalProps) {
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Catálogos auxiliares
  const [topicosCatalogo, setTopicosCatalogo] = useState<HomeCareTopico[]>([]);
  const [formulasCatalogo, setFormulasCatalogo] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  // Estados do formulário
  const [tituloProtocolo, setTituloProtocolo] = useState("");
  const [appointmentId, setAppointmentId] = useState<string>("");
  const [dataHomeCare, setDataHomeCare] = useState<string>(getTodayISODate());
  const [status, setStatus] = useState<HomeCareStatus>("Ativo");
  const [incluirRecomendacoes, setIncluirRecomendacoes] = useState(false);

  // Atenção Crítica (configurável)
  const [incluirAtencaoCritica, setIncluirAtencaoCritica] = useState(true);
  const [atencaoCriticaTitulo, setAtencaoCriticaTitulo] = useState("ATENÇÃO CRÍTICA — CUIDADOS PÓS-PROCEDIMENTO");
  const [atencaoCriticaTexto, setAtencaoCriticaTexto] = useState(
    "O resultado do procedimento estético depende diretamente da adesão ao cronograma domiciliar. Não remova crostas/casquinhas, evite exposição solar direta sem proteção e utilize exclusivamente os produtos recomendados pela profissional."
  );
  const [selectedAtencaoCatalogoId, setSelectedAtencaoCatalogoId] = useState("");

  // Grupos dinâmicos
  const [cuidados, setCuidados] = useState<CuidadoFormItem[]>([
    {
      titulo: "Limpeza Suave e Higienização",
      texto: "Higienizar a pele delicadamente com sabonete neutro indicado, sem friccionar ou esfregar.",
    },
  ]);

  const [cronograma, setCronograma] = useState<CronogramaFormItem[]>([
    {
      dia_inicio: 1,
      dia_fim: 3,
      fase_titulo: "Fase de Barreira e Conforto",
      nome_formula: "Bálsamo Regenerador Dérmico",
      posologia: "Aplicar camada fina sobre a região 3x ao dia (manhã, tarde e noite).",
      objetivo_clinico: "Promover reepitelização acelerada e restaurar a barreira cutânea pós-procedimento.",
    },
  ]);

  const [recomendacoes, setRecomendacoes] = useState<CuidadoFormItem[]>([]);

  const targetPacienteId = initialData?.paciente_id || pacienteId || "";
  const targetPacienteNome = initialData?.paciente?.nome || pacienteNome || "Paciente Selecionado";

  // Inicialização e preenchimento de dados
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setInitLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    async function loadData() {
      try {
        const [catRes, aptsRes] = await Promise.all([
          getHomeCareCatalogAndFormulas(),
          targetPacienteId ? getPatientAppointments(targetPacienteId) : Promise.resolve([]),
        ]);

        if (!mounted) return;

        setTopicosCatalogo(catRes.topicos || []);
        setFormulasCatalogo(catRes.formulas || []);
        setAppointments(aptsRes || []);

        if (initialData) {
          setTituloProtocolo(initialData.titulo_protocolo || "");
          setAppointmentId(initialData.appointment_id || "");
          setDataHomeCare(initialData.data_home_care || getTodayISODate());
          setStatus(initialData.status || "Ativo");
          setIncluirRecomendacoes(Boolean(initialData.incluir_recomendacoes));
          
          setIncluirAtencaoCritica(initialData.incluir_atencao_critica !== false);
          setAtencaoCriticaTitulo(initialData.atencao_critica_titulo || "ATENÇÃO CRÍTICA — CUIDADOS PÓS-PROCEDIMENTO");
          setAtencaoCriticaTexto(
            initialData.atencao_critica_texto ||
            "O resultado do procedimento estético depende diretamente da adesão ao cronograma domiciliar. Não remova crostas/casquinhas, evite exposição solar direta sem proteção e utilize exclusivamente os produtos recomendados pela profissional."
          );

          if (initialData.cuidados && initialData.cuidados.length > 0) {
            setCuidados(
              initialData.cuidados.map((c) => ({
                topico_id: c.topico_id,
                titulo: c.titulo,
                texto: c.texto,
              }))
            );
          }

          if (initialData.cronograma && initialData.cronograma.length > 0) {
            setCronograma(
              initialData.cronograma.map((cr) => ({
                dia_inicio: cr.dia_inicio,
                dia_fim: cr.dia_fim,
                fase_titulo: cr.fase_titulo || "",
                formula_id: cr.formula_id || "",
                nome_formula: cr.nome_formula,
                posologia: cr.posologia,
                objetivo_clinico: cr.objetivo_clinico,
              }))
            );
          }

          if (initialData.recomendacoes && initialData.recomendacoes.length > 0) {
            setRecomendacoes(
              initialData.recomendacoes.map((r) => ({
                topico_id: r.topico_id,
                titulo: r.titulo,
                texto: r.texto,
              }))
            );
          }
        } else {
          // Reset default para novo
          setTituloProtocolo("Protocolo de Cuidados Domiciliares (Home Care)");
          setAppointmentId(initialAppointmentId || "");
          if (initialAppointmentId && aptsRes) {
            const matchApt = aptsRes.find((a: any) => a.id === initialAppointmentId);
            if (matchApt?.data) {
              setDataHomeCare(matchApt.data);
            } else {
              setDataHomeCare(getTodayISODate());
            }
          } else {
            setDataHomeCare(getTodayISODate());
          }
          setStatus("Ativo");
          setIncluirAtencaoCritica(true);
          setAtencaoCriticaTitulo("ATENÇÃO CRÍTICA — CUIDADOS PÓS-PROCEDIMENTO");
          setAtencaoCriticaTexto(
            "O resultado do procedimento estético depende diretamente da adesão ao cronograma domiciliar. Não remova crostas/casquinhas, evite exposição solar direta sem proteção e utilize exclusivamente os produtos recomendados pela profissional."
          );
          setIncluirRecomendacoes(false);
          setCuidados([
            {
              titulo: "Limpeza Suave e Higienização",
              texto: "Higienizar a pele delicadamente com sabonete neutro indicado, sem friccionar ou esfregar.",
            },
            {
              titulo: "Fotoproteção Rigorosa",
              texto: "Reaplicar protetor solar facial mineral FPS 50 a cada 3 horas, mesmo em ambientes fechados.",
            },
          ]);
          setCronograma([
            {
              dia_inicio: 1,
              dia_fim: 3,
              fase_titulo: "Fase de Barreira e Conforto",
              nome_formula: "Bálsamo Regenerador Dérmico",
              posologia: "Aplicar camada fina sobre a região 3x ao dia (manhã, tarde e noite).",
              objetivo_clinico: "Promover reepitelização acelerada e restaurar a barreira cutânea pós-procedimento.",
            },
            {
              dia_inicio: 4,
              dia_fim: 15,
              fase_titulo: "Fase de Regeneração & Estímulo",
              nome_formula: "Sérum Revitalizante com Fatores de Crescimento",
              posologia: "Aplicar 4 gotas no rosto limpo pela manhã antes do protetor solar.",
              objetivo_clinico: "Potencializar a síntese de colágeno e uniformizar o relevo dérmico.",
            },
          ]);
          setRecomendacoes([
            {
              titulo: "Não puxar crostas ou casquinhas",
              texto: "Aguardar a descamação natural da pele para evitar marcas ou hiperpigmentação pós-inflamatória.",
            },
          ]);
        }
      } catch (err: any) {
        console.error("Erro ao carregar dados do modal Home Care:", err);
        setErrorMsg("Não foi possível carregar os dados iniciais do catálogo.");
      } finally {
        if (mounted) setInitLoading(false);
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [isOpen, targetPacienteId, initialData]);

  if (!isOpen) return null;

  // Handler de seleção de agendamento (autopreenchimento da data)
  const handleSelectAppointment = (aptId: string) => {
    setAppointmentId(aptId);
    if (!aptId) return;

    const found = appointments.find((a) => a.id === aptId);
    if (found?.data) {
      setDataHomeCare(found.data);
    }
  };

  // Handlers para o Grupo de Cuidados
  const handleAddCuidado = () => {
    setCuidados([
      ...cuidados,
      {
        titulo: "",
        texto: "",
      },
    ]);
  };

  const handleRemoveCuidado = (idx: number) => {
    if (cuidados.length <= 1) return;
    setCuidados(cuidados.filter((_, i) => i !== idx));
  };

  const handleSelectCuidadoCatalogo = (idx: number, topicoId: string) => {
    const item = topicosCatalogo.find((t) => t.id === topicoId);
    if (!item) return;

    setCuidados((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        topico_id: item.id,
        titulo: item.titulo,
        texto: item.texto,
      };
      return copy;
    });
  };

  // Handlers para o Cronograma
  const handleAddCronograma = () => {
    const lastItem = cronograma[cronograma.length - 1];
    const nextStart = lastItem ? lastItem.dia_fim + 1 : 1;
    const nextEnd = nextStart + 6;

    setCronograma([
      ...cronograma,
      {
        dia_inicio: nextStart,
        dia_fim: nextEnd,
        fase_titulo: "",
        nome_formula: "",
        posologia: "",
        objetivo_clinico: "",
      },
    ]);
  };

  const handleRemoveCronograma = (idx: number) => {
    if (cronograma.length <= 1) return;
    setCronograma(cronograma.filter((_, i) => i !== idx));
  };

  const handleSelectFormula = (idx: number, fId: string) => {
    const formula = formulasCatalogo.find((f) => f.id === fId);
    if (!formula) return;

    setCronograma((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        formula_id: formula.id,
        nome_formula: formula.nome,
        posologia: formula.posologia || copy[idx].posologia,
      };
      return copy;
    });
  };

  // Handlers para Recomendações
  const handleAddRecomendacao = () => {
    setRecomendacoes([
      ...recomendacoes,
      {
        titulo: "",
        texto: "",
      },
    ]);
  };

  const handleRemoveRecomendacao = (idx: number) => {
    setRecomendacoes(recomendacoes.filter((_, i) => i !== idx));
  };

  const handleSelectRecomendacaoCatalogo = (idx: number, topicoId: string) => {
    const item = topicosCatalogo.find((t) => t.id === topicoId);
    if (!item) return;

    setRecomendacoes((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        topico_id: item.id,
        titulo: item.titulo,
        texto: item.texto,
      };
      return copy;
    });
  };

  // Submissão do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!targetPacienteId) {
      setErrorMsg("Identificação do paciente não informada no contexto.");
      return;
    }

    if (!tituloProtocolo.trim()) {
      setErrorMsg("O título do protocolo é obrigatório.");
      return;
    }

    if (!dataHomeCare) {
      setErrorMsg("A data do Home Care é obrigatória.");
      return;
    }

    // Validação mínima de cuidados
    if (cuidados.length === 0 || !cuidados.some((c) => c.titulo.trim() && c.texto.trim())) {
      setErrorMsg("É necessário incluir ao menos 1 cuidado preenchido.");
      return;
    }

    // Validação mínima do cronograma
    if (cronograma.length === 0) {
      setErrorMsg("É necessário incluir ao menos 1 linha no Cronograma de Tratamento.");
      return;
    }

    for (let i = 0; i < cronograma.length; i++) {
      const cr = cronograma[i];
      if (cr.dia_fim < cr.dia_inicio) {
        setErrorMsg(`Na linha ${i + 1} do cronograma, o Dia Final deve ser maior ou igual ao Dia Inicial.`);
        return;
      }
      if (!cr.nome_formula.trim()) {
        setErrorMsg(`Na linha ${i + 1} do cronograma, informe o nome do produto ou fórmula.`);
        return;
      }
      if (!cr.posologia.trim()) {
        setErrorMsg(`Na linha ${i + 1} do cronograma, informe a posologia.`);
        return;
      }
      if (!cr.objetivo_clinico.trim()) {
        setErrorMsg(`Na linha ${i + 1} do cronograma, informe o objetivo clínico.`);
        return;
      }
    }

    setLoading(true);

    try {
      const payload: SaveHomeCareFichaInput = {
        id: initialData?.id,
        paciente_id: targetPacienteId,
        appointment_id: appointmentId || null,
        titulo_protocolo: tituloProtocolo.trim(),
        data_home_care: dataHomeCare,
        incluir_atencao_critica: incluirAtencaoCritica,
        atencao_critica_titulo: incluirAtencaoCritica ? atencaoCriticaTitulo.trim() : null,
        atencao_critica_texto: incluirAtencaoCritica ? atencaoCriticaTexto.trim() : null,
        incluir_recomendacoes: incluirRecomendacoes,
        status: status,
        cuidados: cuidados.map((c, i) => ({
          topico_id: c.topico_id,
          titulo: c.titulo.trim(),
          texto: c.texto.trim(),
          ordem: i + 1,
        })),
        cronograma: cronograma.map((cr, i) => ({
          ordem: i + 1,
          dia_inicio: Number(cr.dia_inicio),
          dia_fim: Number(cr.dia_fim),
          fase_titulo: cr.fase_titulo?.trim() || null,
          formula_id: cr.formula_id || null,
          nome_formula: cr.nome_formula.trim(),
          posologia: cr.posologia.trim(),
          objetivo_clinico: cr.objetivo_clinico.trim(),
        })),
        recomendacoes: incluirRecomendacoes
          ? recomendacoes.map((r, i) => ({
              topico_id: r.topico_id,
              titulo: r.titulo.trim(),
              texto: r.texto.trim(),
              ordem: i + 1,
            }))
          : [],
      };

      const res = await saveHomeCareFicha(payload);

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg("Ficha de Home Care salva com sucesso e autenticada com hash SHA-256!");
        setTimeout(() => {
          onClose();
          if (onSuccess) onSuccess(res.fichaId);
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro inesperado ao salvar a Ficha de Home Care.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif]`}>
      <div className="relative w-full max-w-4xl bg-white dark:bg-[#0c1626] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* Cabeçalho do Modal */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-500/10 dark:bg-teal-500/20 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  {initialData ? "Editar Ficha de Home Care" : "Nova Ficha de Home Care"}
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Assinatura SHA-256
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Paciente: <span className="font-semibold text-slate-700 dark:text-slate-200">{targetPacienteNome}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagens de Feedback */}
        {errorMsg && (
          <div className="m-4 mb-0 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="m-4 mb-0 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Conteúdo Rolável do Formulário */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {initLoading ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
              <p className="text-xs text-slate-500 mt-2">Carregando catálogo e agendamentos...</p>
            </div>
          ) : (
            <>
              {/* Metadados Básicos da Ficha */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-4">
                <span className="text-[11px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider block">
                  Identificação do Protocolo
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {/* 1. Título do Protocolo * */}
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                      Título do Protocolo *
                    </label>
                    <input
                      type="text"
                      value={tituloProtocolo}
                      onChange={(e) => setTituloProtocolo(e.target.value)}
                      placeholder="Ex: Protocolo Regenerativo Pós-Laser de CO2"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border transition-all text-xs font-['Plus_Jakarta_Sans',sans-serif] bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100"
                    />
                  </div>

                  {/* 2. Vínculo com Agendamento */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                      Vínculo com Agendamento
                    </label>
                    <select
                      value={appointmentId}
                      onChange={(e) => handleSelectAppointment(e.target.value)}
                      disabled={loadingAppointments}
                      className="w-full px-3 py-2.5 rounded-xl border transition-all text-xs font-['Plus_Jakarta_Sans',sans-serif] bg-white border-slate-200 text-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {loadingAppointments
                          ? "Carregando agendamentos..."
                          : appointments.length === 0
                          ? "Sem agendamentos registrados"
                          : "Sem vínculo específico"}
                      </option>
                      {appointments.map((apt) => (
                        <option key={apt.id} value={apt.id}>
                          {apt.data} — {apt.horario_inicio} ({apt.procedimento})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3. Data da Ficha * */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                      Data da Ficha *
                    </label>
                    <input
                      type="date"
                      value={dataHomeCare}
                      onChange={(e) => setDataHomeCare(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border transition-all text-xs font-['Plus_Jakarta_Sans',sans-serif] bg-white border-slate-200 text-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Status da Ficha:</span>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as HomeCareStatus)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Concluído">Concluído</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={incluirRecomendacoes}
                      onChange={(e) => setIncluirRecomendacoes(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded-sm border-slate-300 focus:ring-teal-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      Incluir Bloco de Recomendações Complementares
                    </span>
                  </label>
                </div>
              </div>

              {/* SEÇÃO CONFIGURÁVEL: ATENÇÃO CRÍTICA (Logo acima do Grupo 1) */}
              {!incluirAtencaoCritica ? (
                <div className="p-3.5 rounded-2xl border border-dashed border-amber-300/80 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/20 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-amber-950 dark:text-amber-200 block">
                        Atenção Crítica (Opcional)
                      </span>
                      <span className="text-[11px] text-amber-800/80 dark:text-amber-400/80">
                        Destacar aviso de risco e cuidados pós-procedimento imediatos no topo do relatório
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIncluirAtencaoCritica(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Adicionar Atenção Crítica</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 sm:p-5 rounded-2xl border-2 border-amber-400/70 dark:border-amber-600/60 bg-amber-50/70 dark:bg-amber-950/30 space-y-3.5 shadow-sm">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-amber-200/80 dark:border-amber-900/60">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-amber-950 dark:text-amber-200 uppercase tracking-wider block">
                          Atenção Crítica — Cuidados Pós-Procedimento
                        </span>
                        <span className="text-[10px] text-amber-700 dark:text-amber-400">
                          Banner destacado em amarelo na primeira seção do relatório impresso
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Selecionar Modelo de Atenção Crítica do Catálogo */}
                      {topicosCatalogo.filter((t) => t.grupo === "ATENCAO_CRITICA").length > 0 && (
                        <select
                          value={selectedAtencaoCatalogoId}
                          onChange={(e) => {
                            const tId = e.target.value;
                            setSelectedAtencaoCatalogoId(tId);
                            const t = topicosCatalogo.find((item) => item.id === tId);
                            if (t) {
                              setAtencaoCriticaTitulo(t.titulo);
                              setAtencaoCriticaTexto(t.texto);
                            }
                          }}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-200 max-w-[220px] truncate"
                        >
                          <option value="">Carregar modelo do catálogo...</option>
                          {topicosCatalogo
                            .filter((t) => t.grupo === "ATENCAO_CRITICA")
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.titulo}
                              </option>
                            ))}
                        </select>
                      )}

                      <button
                        type="button"
                        onClick={() => setIncluirAtencaoCritica(false)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 rounded-lg border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer"
                        title="Ocultar Atenção Crítica deste protocolo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover Bloco</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                        Título da Atenção Crítica *
                      </label>
                      <input
                        type="text"
                        value={atencaoCriticaTitulo}
                        onChange={(e) => setAtencaoCriticaTitulo(e.target.value)}
                        placeholder="Ex: ATENÇÃO CRÍTICA — CUIDADOS PÓS-PROCEDIMENTO"
                        required={incluirAtencaoCritica}
                        className="w-full px-3.5 py-2 rounded-xl border text-xs font-bold bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100 placeholder:text-amber-700/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                        Texto da Atenção Crítica *
                      </label>
                      <textarea
                        rows={3}
                        value={atencaoCriticaTexto}
                        onChange={(e) => setAtencaoCriticaTexto(e.target.value)}
                        placeholder="Descreva as orientações de risco, restrições e sinais de alerta imediatos..."
                        required={incluirAtencaoCritica}
                        className="w-full px-3.5 py-2 rounded-xl border text-xs bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 leading-relaxed"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* GRUPO 1: CUIDADOS (Obrigatório, mín. 1 item) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-500" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Grupo 1: Cuidados Diários Fundamentais ({cuidados.length})
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCuidado}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-xs font-semibold hover:bg-teal-100 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Cuidado</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {cuidados.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-3 relative group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-6 h-6 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          
                          {/* Selecionar Tópico do Catálogo Central */}
                          <select
                            value={item.topico_id || ""}
                            onChange={(e) => handleSelectCuidadoCatalogo(idx, e.target.value)}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 max-w-[260px] truncate"
                          >
                            <option value="">Carregar do Catálogo...</option>
                            {topicosCatalogo
                              .filter((t) => t.grupo === "CUIDADOS")
                              .map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.titulo}
                                </option>
                              ))}
                          </select>
                        </div>

                        {cuidados.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCuidado(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Remover este cuidado"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        <input
                          type="text"
                          value={item.titulo}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCuidados((prev) => {
                              const copy = [...prev];
                              copy[idx].titulo = val;
                              return copy;
                            });
                          }}
                          placeholder="Título do cuidado (ex: Higienização Suave)"
                          required
                          className="w-full px-3 py-2 rounded-xl border text-xs font-bold bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white"
                        />
                        <textarea
                          rows={2}
                          value={item.texto}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCuidados((prev) => {
                              const copy = [...prev];
                              copy[idx].texto = val;
                              return copy;
                            });
                          }}
                          placeholder="Texto com instruções detalhadas do cuidado para o paciente..."
                          required
                          className="w-full px-3 py-2 rounded-xl border text-xs bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:bg-white leading-relaxed"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* GRUPO 2: CRONOGRAMA DE TRATAMENTO (Obrigatório, mín. 1 linha) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Grupo 2: Cronograma de Tratamento ({cronograma.length} etapas)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCronograma}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Etapa</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {cronograma.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            Etapa {idx + 1}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Seleção de Fórmula Pré-cadastrada */}
                          <select
                            value={item.formula_id || ""}
                            onChange={(e) => handleSelectFormula(idx, e.target.value)}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 max-w-[240px] truncate"
                          >
                            <option value="">Carregar Fórmula Magistral...</option>
                            {formulasCatalogo.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.nome}
                              </option>
                            ))}
                          </select>

                          {cronograma.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCronograma(idx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Remover esta etapa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Dia Inicial *
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={item.dia_inicio}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              setCronograma((prev) => {
                                const copy = [...prev];
                                copy[idx].dia_inicio = val;
                                return copy;
                              });
                            }}
                            required
                            className="w-full px-3 py-1.5 rounded-xl border text-xs bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Dia Final *
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={item.dia_fim}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              setCronograma((prev) => {
                                const copy = [...prev];
                                copy[idx].dia_fim = val;
                                return copy;
                              });
                            }}
                            required
                            className="w-full px-3 py-1.5 rounded-xl border text-xs bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Título da Fase (Opcional)
                          </label>
                          <input
                            type="text"
                            value={item.fase_titulo || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCronograma((prev) => {
                                const copy = [...prev];
                                copy[idx].fase_titulo = val;
                                return copy;
                              });
                            }}
                            placeholder="Ex: Fase de Barreira"
                            className="w-full px-3 py-1.5 rounded-xl border text-xs bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Nome do Produto / Fórmula *
                          </label>
                          <input
                            type="text"
                            value={item.nome_formula}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCronograma((prev) => {
                                const copy = [...prev];
                                copy[idx].nome_formula = val;
                                return copy;
                              });
                            }}
                            placeholder="Ex: Bálsamo Regenerador Dérmico 30g"
                            required
                            className="w-full px-3 py-1.5 rounded-xl border text-xs font-bold bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Posologia e Frequência *
                          </label>
                          <input
                            type="text"
                            value={item.posologia}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCronograma((prev) => {
                                const copy = [...prev];
                                copy[idx].posologia = val;
                                return copy;
                              });
                            }}
                            placeholder="Ex: Aplicar camada fina 3x ao dia (manhã, tarde e noite)"
                            required
                            className="w-full px-3 py-1.5 rounded-xl border text-xs bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Objetivo Clínico *
                          </label>
                          <input
                            type="text"
                            value={item.objetivo_clinico}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCronograma((prev) => {
                                const copy = [...prev];
                                copy[idx].objetivo_clinico = val;
                                return copy;
                              });
                            }}
                            placeholder="Ex: Promover reepitelização acelerada e restaurar a barreira cutânea"
                            required
                            className="w-full px-3 py-1.5 rounded-xl border text-xs bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* GRUPO 3: RECOMENDAÇÕES COMPLEMENTARES (Opcional) */}
              {incluirRecomendacoes && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Grupo 3: Recomendações Complementares ({recomendacoes.length})
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddRecomendacao}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar Recomendação</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {recomendacoes.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <select
                              value={item.topico_id || ""}
                              onChange={(e) => handleSelectRecomendacaoCatalogo(idx, e.target.value)}
                              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 max-w-[260px] truncate"
                            >
                              <option value="">Carregar do Catálogo...</option>
                              {topicosCatalogo
                                .filter((t) => t.grupo === "RECOMENDACOES")
                                .map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.titulo}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveRecomendacao(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Remover recomendação"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-2">
                          <input
                            type="text"
                            value={item.titulo}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRecomendacoes((prev) => {
                                const copy = [...prev];
                                copy[idx].titulo = val;
                                return copy;
                              });
                            }}
                            placeholder="Título da recomendação (ex: Não puxar crostas ou casquinhas)"
                            className="w-full px-3 py-2 rounded-xl border text-xs font-bold bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                          />
                          <textarea
                            rows={2}
                            value={item.texto}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRecomendacoes((prev) => {
                                const copy = [...prev];
                                copy[idx].texto = val;
                                return copy;
                              });
                            }}
                            placeholder="Instruções da recomendação complementar..."
                            className="w-full px-3 py-2 rounded-xl border text-xs bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 leading-relaxed"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Rodapé com Ações */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || initLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loading ? "Salvando Protocolo..." : "Salvar Ficha de Home Care"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
