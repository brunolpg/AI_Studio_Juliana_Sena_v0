"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  FlaskConical,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  Clock,
  Sparkles,
  Info,
  Check,
  ChevronDown,
  Search,
} from "lucide-react";
import type { Client } from "@/types/client";
import type {
  PrescricaoExame,
  PrescricaoExameInput,
  GrupoExameItem,
  CatalogoExamesPreCadastrados,
} from "@/types/prescricao-exame";
import {
  savePrescricaoExame,
  getCatalogoExamesPreCadastrados,
} from "@/app/actions/prescricoes-exames-actions";
import { useToast } from "@/components/ui/toast";

interface GrupoSearchDropdownProps {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  disabled?: boolean;
  grupoItensMap?: Record<string, string[]>;
  onSelectSuggestion?: (groupName: string, suggestedExames?: string[]) => void;
}

function GrupoSearchDropdown({
  value,
  onChange,
  suggestions,
  disabled,
  grupoItensMap,
  onSelectSuggestion,
}: GrupoSearchDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const query = value.toLowerCase().trim();
  const filtered = suggestions.filter((s) =>
    s.toLowerCase().includes(query)
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Ex: Perfil Hematológico e Inflamatório"
          className="w-full min-h-[44px] pl-3 pr-10 rounded-md-md border border-outline-variant bg-surface-container text-on-surface text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
          disabled={disabled}
          required
        />
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          disabled={disabled}
          className="absolute right-1 p-2 min-h-[36px] min-w-[36px] text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer flex items-center justify-center rounded-md-md"
          title="Ver grupos sugeridos"
          tabIndex={-1}
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-150 ${
              isOpen ? "rotate-180 text-primary" : ""
            }`}
          />
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-surface-container-high border border-outline-variant max-h-56 overflow-y-auto z-30 shadow-lg rounded-md-lg py-1.5 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-outline-variant/60 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Search className="w-3 h-3 text-primary" />
              <span>Grupos Sugeridos</span>
            </span>
            <span>{filtered.length} opções</span>
          </div>
          {filtered.length > 0 ? (
            filtered.map((grpName, idx) => {
              const isSelected = grpName.toLowerCase() === query;
              const examesVinculados = grupoItensMap?.[grpName];
              return (
                <button
                  key={`grp_opt_${idx}`}
                  type="button"
                  onClick={() => {
                    onChange(grpName);
                    if (onSelectSuggestion) {
                      onSelectSuggestion(grpName, examesVinculados);
                    }
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs sm:text-sm text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span
                      className={`truncate ${
                        isSelected ? "font-bold text-primary" : "font-medium"
                      }`}
                    >
                      {grpName}
                    </span>
                    {examesVinculados && examesVinculados.length > 0 && (
                      <span className="text-[10px] text-on-surface-variant truncate">
                        {examesVinculados.slice(0, 3).join(", ")}
                        {examesVinculados.length > 3 ? "..." : ""}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  )}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2.5 text-xs text-on-surface-variant italic">
              Nenhum grupo correspondente. Continue digitando para cadastrar um novo grupo livremente.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ExameSearchDropdownProps {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  disabled?: boolean;
  prioritySuggestions?: string[];
}

function ExameSearchDropdown({
  value,
  onChange,
  suggestions,
  disabled,
  prioritySuggestions,
}: ExameSearchDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const query = value.toLowerCase().trim();

  const allSortedSuggestions = React.useMemo(() => {
    if (!prioritySuggestions || prioritySuggestions.length === 0) {
      return suggestions;
    }
    const prioritySet = new Set(
      prioritySuggestions.map((s) => s.toLowerCase().trim())
    );
    const priorityItems = suggestions.filter((s) =>
      prioritySet.has(s.toLowerCase().trim())
    );
    const otherItems = suggestions.filter(
      (s) => !prioritySet.has(s.toLowerCase().trim())
    );
    return [...priorityItems, ...otherItems];
  }, [suggestions, prioritySuggestions]);

  const filtered = allSortedSuggestions.filter((s) =>
    s.toLowerCase().includes(query)
  );

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Digite ou selecione o exame (ex: Hemograma Completo)"
          className="w-full min-h-[44px] pl-3 pr-10 rounded-md-md border border-outline-variant bg-surface text-on-surface text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          disabled={disabled}
          required
        />
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          disabled={disabled}
          className="absolute right-1 p-2 min-h-[36px] min-w-[36px] text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer flex items-center justify-center rounded-md-md"
          title="Ver exames sugeridos"
          tabIndex={-1}
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-150 ${
              isOpen ? "rotate-180 text-primary" : ""
            }`}
          />
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-surface-container-high border border-outline-variant max-h-56 overflow-y-auto z-30 shadow-lg rounded-md-lg py-1.5 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-outline-variant/60 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Search className="w-3 h-3 text-primary" />
              <span>Exames Sugeridos</span>
            </span>
            <span>{filtered.length} opções</span>
          </div>
          {filtered.length > 0 ? (
            filtered.map((exName, idx) => {
              const isSelected = exName.toLowerCase() === query;
              const isPriority = prioritySuggestions?.some(
                (p) => p.toLowerCase().trim() === exName.toLowerCase().trim()
              );
              return (
                <button
                  key={`ex_opt_${idx}`}
                  type="button"
                  onClick={() => {
                    onChange(exName);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs sm:text-sm text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span
                      className={`truncate ${
                        isSelected ? "font-bold text-primary" : "font-medium"
                      }`}
                    >
                      {exName}
                    </span>
                    {isPriority && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md-sm bg-primary-container text-on-primary-container font-semibold shrink-0">
                        Do Grupo
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  )}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2.5 text-xs text-on-surface-variant italic">
              Nenhum exame correspondente. Continue digitando para cadastrar um novo exame livremente.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ExamPrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPatient: Client | null;
  patients?: Client[];
  initialData?: PrescricaoExame | null;
  onSuccess: (saved: PrescricaoExame, isEdit: boolean) => void;
  zIndex?: string;
}

function getTodayBahia(): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bahia",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

export function ExamPrescriptionModal({
  isOpen,
  onClose,
  selectedPatient,
  patients = [],
  initialData = null,
  onSuccess,
  zIndex = "z-50",
}: ExamPrescriptionModalProps) {
  const { toast } = useToast();

  const [catalogo, setCatalogo] = useState<CatalogoExamesPreCadastrados>({
    gruposSugeridos: [],
    examesSugeridos: [],
    orientacoesSugeridas: [],
  });

  const [pacienteId, setPacienteId] = useState("");
  const [titulo, setTitulo] = useState("Solicitação de Exames Laboratoriais");
  const [dataPrescricao, setDataPrescricao] = useState(getTodayBahia());
  const [descricao, setDescricao] = useState(
    "Solicito, por gentileza, a realização dos exames laboratoriais abaixo descritos para avaliação sistêmica, rastreio de disfunções estéticas e acompanhamento clínico:"
  );

  const [grupos, setGrupos] = useState<GrupoExameItem[]>([
    {
      id: "grp_1",
      nome_grupo: "Perfil Hematológico e Inflamatório",
      exames: ["Hemograma Completo", "PCR Ultrassensível", "Ferritina"],
    },
  ]);

  const [orientacoes, setOrientacoes] = useState<string[]>([
    "Jejum: 8 a 12 horas, conforme protocolo do laboratório.",
    "Manter hidratação habitual com água.",
    "Informar uso de medicamentos e suplementos contínuos no ato da coleta.",
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carrega catálogo pré-cadastrado
  useEffect(() => {
    let isMounted = true;
    async function loadCatalogo() {
      try {
        const res = await getCatalogoExamesPreCadastrados();
        if (isMounted && res.success && res.data) {
          setCatalogo(res.data);
        }
      } catch (err) {
        console.warn("Falha ao carregar catálogo de exames:", err);
      }
    }
    if (isOpen) {
      loadCatalogo();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Sincroniza dados iniciais ao abrir o modal
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg(null);

    if (initialData) {
      setPacienteId(initialData.paciente_id || selectedPatient?.id || "");
      setTitulo(initialData.titulo || "Solicitação de Exames Laboratoriais");
      setDataPrescricao(initialData.data ? initialData.data.split("T")[0] : getTodayBahia());
      setDescricao(
        initialData.descricao ??
          "Solicito, por gentileza, a realização dos exames laboratoriais abaixo descritos para avaliação sistêmica, rastreio de disfunções estéticas e acompanhamento clínico:"
      );

      if (Array.isArray(initialData.grupos_exames) && initialData.grupos_exames.length > 0) {
        setGrupos(
          initialData.grupos_exames.map((g, idx) => ({
            id: g.id || `grp_${idx + 1}`,
            nome_grupo: g.nome_grupo || "",
            exames: Array.isArray(g.exames) && g.exames.length > 0 ? [...g.exames] : [""],
          }))
        );
      }

      if (Array.isArray(initialData.orientacoes) && initialData.orientacoes.length > 0) {
        setOrientacoes([...initialData.orientacoes]);
      }
    } else {
      setPacienteId(selectedPatient?.id || "");
      setTitulo("Solicitação de Exames Laboratoriais");
      setDataPrescricao(getTodayBahia());
      setDescricao(
        "Solicito, por gentileza, a realização dos exames laboratoriais abaixo descritos para avaliação sistêmica, rastreio de disfunções estéticas e acompanhamento clínico:"
      );
      setGrupos([
        {
          id: `grp_${Date.now()}_1`,
          nome_grupo: "Perfil Hematológico e Inflamatório",
          exames: ["Hemograma Completo", "PCR Ultrassensível", "Ferritina"],
        },
      ]);
      setOrientacoes([
        "Jejum: 8 a 12 horas, conforme protocolo do laboratório.",
        "Manter hidratação habitual com água.",
        "Informar uso de medicamentos e suplementos contínuos no ato da coleta.",
      ]);
    }
  }, [isOpen, initialData, selectedPatient]);

  if (!isOpen) return null;

  const isEdit = Boolean(initialData?.id);

  // Manipulação de Grupos
  const handleAddGrupo = () => {
    setGrupos((prev) => [
      ...prev,
      {
        id: `grp_${Date.now()}_${prev.length + 1}`,
        nome_grupo: "",
        exames: [""],
      },
    ]);
  };

  const handleRemoveGrupo = (index: number) => {
    if (grupos.length <= 1) {
      toast({
        type: "warning",
        title: "Atenção",
        description: "A prescrição deve conter ao menos um grupo de exames.",
      });
      return;
    }
    setGrupos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGrupoNameChange = (index: number, newName: string) => {
    setGrupos((prev) =>
      prev.map((g, i) => (i === index ? { ...g, nome_grupo: newName } : g))
    );
  };

  const handleSelectGrupoSuggestion = (
    index: number,
    groupName: string,
    suggestedExames?: string[]
  ) => {
    setGrupos((prev) =>
      prev.map((g, i) => {
        if (i !== index) return g;
        const currentFilledExames = g.exames
          .map((e) => e.trim())
          .filter((e) => e.length > 0);
        if (
          currentFilledExames.length === 0 &&
          suggestedExames &&
          suggestedExames.length > 0
        ) {
          return {
            ...g,
            nome_grupo: groupName,
            exames: [...suggestedExames],
          };
        }
        return {
          ...g,
          nome_grupo: groupName,
        };
      })
    );
  };

  // Manipulação de Exames dentro do Grupo
  const handleAddExame = (grupoIndex: number) => {
    setGrupos((prev) =>
      prev.map((g, i) =>
        i === grupoIndex ? { ...g, exames: [...g.exames, ""] } : g
      )
    );
  };

  const handleRemoveExame = (grupoIndex: number, exameIndex: number) => {
    const targetGroup = grupos[grupoIndex];
    if (targetGroup.exames.length <= 1) {
      toast({
        type: "warning",
        title: "Atenção",
        description: "Cada grupo deve conter ao menos um exame.",
      });
      return;
    }
    setGrupos((prev) =>
      prev.map((g, i) =>
        i === grupoIndex
          ? { ...g, exames: g.exames.filter((_, eIdx) => eIdx !== exameIndex) }
          : g
      )
    );
  };

  const handleExameChange = (
    grupoIndex: number,
    exameIndex: number,
    newValue: string
  ) => {
    setGrupos((prev) =>
      prev.map((g, i) =>
        i === grupoIndex
          ? {
              ...g,
              exames: g.exames.map((ex, eIdx) =>
                eIdx === exameIndex ? newValue : ex
              ),
            }
          : g
      )
    );
  };

  // Manipulação de Orientações
  const handleAddOrientacao = (text = "") => {
    setOrientacoes((prev) => [...prev, text]);
  };

  const handleRemoveOrientacao = (index: number) => {
    if (orientacoes.length <= 1) {
      toast({
        type: "warning",
        title: "Atenção",
        description: "Informe ao menos uma orientação de coleta.",
      });
      return;
    }
    setOrientacoes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOrientacaoChange = (index: number, newValue: string) => {
    setOrientacoes((prev) =>
      prev.map((ori, i) => (i === index ? newValue : ori))
    );
  };

  // Envio do Formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const finalPacienteId = pacienteId || selectedPatient?.id;
    if (!finalPacienteId) {
      setErrorMsg("Selecione o paciente de destino da prescrição de exames.");
      return;
    }

    if (!titulo.trim()) {
      setErrorMsg("Informe o título da solicitação de exames.");
      return;
    }

    // Valida grupos e exames
    const gruposValidos = grupos
      .map((g) => ({
        ...g,
        nome_grupo: g.nome_grupo.trim(),
        exames: g.exames.map((ex) => ex.trim()).filter((ex) => ex.length > 0),
      }))
      .filter((g) => g.nome_grupo.length > 0 && g.exames.length > 0);

    if (gruposValidos.length === 0) {
      setErrorMsg("Adicione ao menos um grupo com pelo menos um exame preenchido.");
      return;
    }

    // Valida orientações
    const orientacoesValidas = orientacoes
      .map((o) => o.trim())
      .filter((o) => o.length > 0);

    if (orientacoesValidas.length === 0) {
      setErrorMsg("Adicione ao menos uma orientação para realização dos exames.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: PrescricaoExameInput = {
        paciente_id: finalPacienteId,
        titulo: titulo.trim(),
        data: dataPrescricao,
        descricao: descricao.trim(),
        grupos_exames: gruposValidos,
        orientacoes: orientacoesValidas,
        status: "Ativo",
        profissional: "Dra. Juliana Sena",
      };

      const res = await savePrescricaoExame(payload, initialData?.id);

      if (!res.success || !res.data) {
        setErrorMsg(res.error || "Erro ao salvar prescrição de exames.");
        toast({
          type: "error",
          title: "Falha ao Salvar",
          description: res.error || "Não foi possível registrar a prescrição.",
        });
        return;
      }

      toast({
        type: "success",
        title: isEdit ? "Prescrição Atualizada" : "Prescrição Registrada",
        description: isEdit
          ? "Nova versão ativa salva com integridade SHA-256 e versão anterior arquivada."
          : "Solicitação de exames cadastrada com sucesso.",
      });

      onSuccess(res.data, isEdit);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Ocorreu um erro inesperado ao salvar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pacienteAtualNome =
    patients.find((p) => p.id === (pacienteId || selectedPatient?.id))?.nome ||
    selectedPatient?.nome ||
    "Paciente Selecionado";

  return (
    <div
      className={`fixed inset-0 ${zIndex} flex items-center justify-center p-3 sm:p-4 md:p-6 bg-on-surface/40 backdrop-blur-xs animate-in fade-in duration-200`}
    >

      <div className="w-full max-w-4xl max-h-[85dvh] bg-surface rounded-md-2xl sm:rounded-md-3xl border border-outline-variant shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-outline-variant bg-surface-container-low shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-md-xl bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 border border-primary/20">
              <FlaskConical className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-on-surface truncate">
                {isEdit ? "Editar Prescrição de Exames" : "Nova Prescrição de Exames"}
              </h2>
              <p className="text-xs text-on-surface-variant truncate">
                Dra. Juliana Sena • Solicitação laboratorial personalizada com hash SHA-256
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer flex items-center justify-center"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Formulário com Rolagem Segura */}
        <form
          id="form-prescricao-exame"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5"
        >
          {/* Mensagem de Erro */}
          {errorMsg && (
            <div className="p-3.5 rounded-md-lg bg-error-container text-on-error-container border border-error/30 flex items-start gap-2.5 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-error" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {/* Aviso de Versionamento em Edição */}
          {isEdit && (
            <div className="p-3.5 rounded-md-lg bg-warning-container text-on-warning-container border border-warning/30 flex items-start gap-2.5 text-xs">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-warning" />
              <div className="flex-1">
                <strong>Regra de Versionamento Ativa:</strong> Ao salvar as alterações, a versão anterior será arquivada automaticamente no histórico como <em>Suspensa</em> (&quot;Prescrição de exames ajustada&quot;). O registro atual continuará ativo com um novo hash criptográfico recalculado.
              </div>
            </div>
          )}

          {/* Linha 1: Paciente, Título e Data */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
            {/* Seletor de Paciente */}
            <div className="md:col-span-5 space-y-1">
              <label className="text-xs font-semibold text-on-surface block">
                Paciente <span className="text-error">*</span>
              </label>
              {patients && patients.length > 0 ? (
                <select
                  value={pacienteId || selectedPatient?.id || ""}
                  onChange={(e) => setPacienteId(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-md-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                  disabled={isSubmitting}
                >
                  {selectedPatient && !patients.some((p) => p.id === selectedPatient.id) && (
                    <option value={selectedPatient.id}>{selectedPatient.nome}</option>
                  )}
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} {p.cpf ? `(${p.cpf})` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  readOnly
                  value={pacienteAtualNome}
                  className="w-full min-h-[44px] px-3.5 rounded-md-lg border border-outline-variant bg-surface-container-low text-on-surface text-xs sm:text-sm"
                />
              )}
            </div>

            {/* Título da Prescrição */}
            <div className="md:col-span-4 space-y-1">
              <label className="text-xs font-semibold text-on-surface block">
                Título do Documento <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Solicitação de Exames Laboratoriais"
                className="w-full min-h-[44px] px-3.5 rounded-md-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Data da Prescrição */}
            <div className="md:col-span-3 space-y-1">
              <label className="text-xs font-semibold text-on-surface block">
                Data de Emissão <span className="text-error">*</span>
              </label>
              <input
                type="date"
                value={dataPrescricao}
                onChange={(e) => setDataPrescricao(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-md-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Descrição / Mensagem ao Laboratório */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-on-surface block">
              Descrição / Indicação Clínica
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              placeholder="Descreva a finalidade clínica ou introdução aos exames..."
              className="w-full p-3 rounded-md-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
              disabled={isSubmitting}
            />
          </div>

          {/* =============================================================== */}
          {/* SEÇÃO: GRUPOS E EXAMES                                          */}
          {/* =============================================================== */}
          <div className="space-y-3.5 pt-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-on-surface">
                  Grupos de Exames Laboratoriais ({grupos.length})
                </h3>
              </div>

              <button
                type="button"
                onClick={handleAddGrupo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] text-xs font-semibold rounded-md-full bg-primary-container text-on-primary-container hover:brightness-95 transition-all cursor-pointer shadow-2xs"
                disabled={isSubmitting}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Grupo</span>
              </button>
            </div>

            <div className="space-y-4">
              {grupos.map((grupo, gIdx) => (
                <div
                  key={grupo.id || `grp_${gIdx}`}
                  className="p-4 rounded-md-xl border border-outline-variant bg-surface-container-lowest space-y-3 shadow-2xs"
                >
                  {/* Cabeçalho do Grupo */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-[240px] space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-primary">
                          Grupo #{gIdx + 1}
                        </label>
                        <span className="text-[10px] text-on-surface-variant">
                          {grupo.exames.length} {grupo.exames.length === 1 ? "exame" : "exames"}
                        </span>
                      </div>
                      <GrupoSearchDropdown
                        value={grupo.nome_grupo}
                        onChange={(newName) => handleGrupoNameChange(gIdx, newName)}
                        suggestions={catalogo.gruposSugeridos}
                        grupoItensMap={catalogo.grupoItensMap}
                        onSelectSuggestion={(groupName, suggestedExames) =>
                          handleSelectGrupoSuggestion(gIdx, groupName, suggestedExames)
                        }
                        disabled={isSubmitting}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveGrupo(gIdx)}
                      className="p-2 min-h-[44px] min-w-[44px] text-on-surface-variant hover:text-error hover:bg-error-container/40 rounded-full transition-colors cursor-pointer self-end flex items-center justify-center"
                      title="Excluir este grupo"
                      disabled={isSubmitting}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Lista de Exames do Grupo */}
                  <div className="space-y-2 pl-1 sm:pl-3 border-l-2 border-primary/30">
                    <div className="text-[11px] font-medium text-on-surface-variant">
                      Exames Solicitados neste Grupo:
                    </div>

                    {grupo.exames.map((exame, eIdx) => (
                      <div
                        key={`ex_${gIdx}_${eIdx}`}
                        className="flex items-center gap-2"
                      >
                        <span className="text-xs text-on-surface-variant font-mono w-5 text-right shrink-0">
                          {eIdx + 1}.
                        </span>
                        <ExameSearchDropdown
                          value={exame}
                          onChange={(newValue) =>
                            handleExameChange(gIdx, eIdx, newValue)
                          }
                          suggestions={catalogo.examesSugeridos}
                          prioritySuggestions={
                            catalogo.grupoItensMap?.[grupo.nome_grupo]
                          }
                          disabled={isSubmitting}
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveExame(gIdx, eIdx)}
                          className="p-2 min-h-[44px] min-w-[44px] text-on-surface-variant hover:text-error hover:bg-error-container/40 rounded-full transition-colors cursor-pointer flex items-center justify-center shrink-0"
                          title="Remover exame"
                          disabled={isSubmitting}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleAddExame(gIdx)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] text-xs font-medium text-primary hover:text-on-surface hover:bg-surface-container rounded-md-md transition-colors cursor-pointer"
                        disabled={isSubmitting}
                      >
                        <Plus className="w-3 h-3" />
                        <span>Adicionar Exame ao Grupo</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* =============================================================== */}
          {/* SEÇÃO: ORIENTAÇÕES AO PACIENTE                                   */}
          {/* =============================================================== */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-on-surface">
                  Orientações para Realização ({orientacoes.length})
                </h3>
              </div>

              <button
                type="button"
                onClick={() => handleAddOrientacao("")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] text-xs font-semibold rounded-md-full bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-all cursor-pointer shadow-2xs"
                disabled={isSubmitting}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Orientação</span>
              </button>
            </div>

            {/* Sugestões Rápidas de Orientações */}
            {catalogo.orientacoesSugeridas.length > 0 && (
              <div className="p-3 rounded-md-lg bg-surface-container-low border border-outline-variant space-y-1.5">
                <span className="text-[11px] font-semibold text-on-surface-variant block">
                  Sugestões Rápidas (clique para adicionar):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {catalogo.orientacoesSugeridas.map((sug, sIdx) => {
                    const alreadyAdded = orientacoes.includes(sug);
                    return (
                      <button
                        key={`sug_${sIdx}`}
                        type="button"
                        onClick={() => {
                          if (!alreadyAdded) {
                            handleAddOrientacao(sug);
                          }
                        }}
                        disabled={alreadyAdded || isSubmitting}
                        className={`text-[11px] px-2.5 py-1 rounded-md-full border text-left transition-colors cursor-pointer flex items-center gap-1 ${
                          alreadyAdded
                            ? "bg-primary-container text-on-primary-container border-primary/30 opacity-70"
                            : "bg-surface-container-lowest text-on-surface border-outline-variant hover:border-primary/50"
                        }`}
                      >
                        {alreadyAdded && <Check className="w-3 h-3 text-primary" />}
                        <span>{sug}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Lista Editável de Orientações */}
            <div className="space-y-2">
              {orientacoes.map((ori, oIdx) => (
                <div key={`ori_${oIdx}`} className="flex items-center gap-2">
                  <span className="text-xs text-on-surface-variant font-mono w-5 text-right shrink-0">
                    {oIdx + 1}.
                  </span>
                  <input
                    type="text"
                    value={ori}
                    onChange={(e) => handleOrientacaoChange(oIdx, e.target.value)}
                    placeholder="Ex: Jejum obrigatório de 8 a 12 horas."
                    className="flex-1 min-h-[44px] px-3.5 rounded-md-md border border-outline-variant bg-surface-container-lowest text-on-surface text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    disabled={isSubmitting}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveOrientacao(oIdx)}
                    className="p-2 min-h-[44px] min-w-[44px] text-on-surface-variant hover:text-error hover:bg-error-container/40 rounded-full transition-colors cursor-pointer flex items-center justify-center shrink-0"
                    title="Remover orientação"
                    disabled={isSubmitting}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Rodapé com Ações */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-t border-outline-variant bg-surface-container-low shrink-0 flex-wrap gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 min-h-[44px] rounded-md-full border border-outline-variant text-on-surface text-xs sm:text-sm font-semibold hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="submit"
            form="form-prescricao-exame"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 min-h-[44px] rounded-md-full bg-primary text-on-primary text-xs sm:text-sm font-semibold hover:brightness-105 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>Gravando e Assinando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{isEdit ? "Salvar Alterações (Nova Versão)" : "Emitir e Assinar Solicitação"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
