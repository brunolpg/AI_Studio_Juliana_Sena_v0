"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, AlertCircle, Save } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { saveAestheticEvaluationAction } from "@/actions/clinical-actions";

interface AestheticEvaluationModalProps {
  pacienteId: string;
  pacienteNome: string;
  initialFacial?: any;
  initialCorporal?: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function AestheticEvaluationModal({
  pacienteId,
  pacienteNome,
  initialFacial,
  initialCorporal,
  onClose,
  onSuccess,
}: AestheticEvaluationModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"facial" | "corporal">("facial");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // --- FACIAL STATE ---
  const [tipoPele, setTipoPele] = useState<string>("");
  const [textura, setTextura] = useState<string>("");
  const [fototipoFacial, setFototipoFacial] = useState<string>("");
  const [hidratacaoCutanea, setHidratacaoCutanea] = useState<string>("");
  const [oleosidadeSebo, setOleosidadeSebo] = useState<string>("");
  const [glogau, setGlogau] = useState<string>("");
  const [acneGrau, setAcneGrau] = useState<string>("");
  const [discromias, setDiscromias] = useState<string[]>([]);
  const [texturaRelevo, setTexturaRelevo] = useState<string[]>([]);
  const [vascularizacao, setVascularizacao] = useState<string[]>([]);
  const [outros, setOutros] = useState<string[]>([]);
  const [avaliacaoLupa, setAvaliacaoLupa] = useState("");
  const [examesLaboratoriais, setExamesLaboratoriais] = useState("");

  // --- CORPORAL STATE ---
  const [fototipoCorporal, setFototipoCorporal] = useState<string>("");
  const [hidratacaoLocal, setHidratacaoLocal] = useState<string>("");
  const [estriasLocalizacao, setEstriasLocalizacao] = useState<string[]>([]);
  const [estriasLocalizacaoOutro, setEstriasLocalizacaoOutro] = useState("");
  const [estriasTipoColoracao, setEstriasTipoColoracao] = useState<string[]>([]);
  const [estriasEspessuraProfundidade, setEstriasEspessuraProfundidade] = useState<string[]>([]);
  const [estriasTempoSurgimento, setEstriasTempoSurgimento] = useState("");
  const [estriasFatorDesencadeante, setEstriasFatorDesencadeante] = useState<string[]>([]);
  const [alteracoesAssociadas, setAlteracoesAssociadas] = useState<string[]>([]);

  // Popular estados iniciais se fornecidos
  useEffect(() => {
    if (initialFacial) {
      setTipoPele(initialFacial.tipo_pele || "");
      setTextura(initialFacial.textura || "");
      setFototipoFacial(initialFacial.fototipo || "");
      setHidratacaoCutanea(initialFacial.hidratacao_cutanea !== null ? String(initialFacial.hidratacao_cutanea) : "");
      setOleosidadeSebo(initialFacial.oleosidade_sebo !== null ? String(initialFacial.oleosidade_sebo) : "");
      setGlogau(initialFacial.glogau || "");
      setAcneGrau(initialFacial.acne_grau || "");
      setDiscromias(Array.isArray(initialFacial.discromias) ? initialFacial.discromias : []);
      setTexturaRelevo(Array.isArray(initialFacial.textura_relevo) ? initialFacial.textura_relevo : []);
      setVascularizacao(Array.isArray(initialFacial.vascularizacao) ? initialFacial.vascularizacao : []);
      setOutros(Array.isArray(initialFacial.outros) ? initialFacial.outros : []);
      setAvaliacaoLupa(initialFacial.avaliacao_lupa || "");
      setExamesLaboratoriais(initialFacial.exames_laboratoriais || "");
    }

    if (initialCorporal) {
      setFototipoCorporal(initialCorporal.fototipo || "");
      setHidratacaoLocal(initialCorporal.hidratacao_local || "");
      setEstriasLocalizacao(Array.isArray(initialCorporal.estrias_localizacao) ? initialCorporal.estrias_localizacao : []);
      setEstriasLocalizacaoOutro(initialCorporal.estrias_localizacao_outro || "");
      setEstriasTipoColoracao(Array.isArray(initialCorporal.estrias_tipo_coloracao) ? initialCorporal.estrias_tipo_coloracao : []);
      setEstriasEspessuraProfundidade(Array.isArray(initialCorporal.estrias_espessura_profundidade) ? initialCorporal.estrias_espessura_profundidade : []);
      setEstriasTempoSurgimento(initialCorporal.estrias_tempo_surgimento || "");
      setEstriasFatorDesencadeante(Array.isArray(initialCorporal.estrias_fator_desencadeante) ? initialCorporal.estrias_fator_desencadeante : []);
      setAlteracoesAssociadas(Array.isArray(initialCorporal.alteracoes_associadas) ? initialCorporal.alteracoes_associadas : []);
    }
  }, [initialFacial, initialCorporal]);

  // Helper toggle array
  const handleToggleCheckbox = (item: string, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (list.includes(item)) {
      setList(list.filter((x) => x !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");

    const parseNum = (val: string): number | null => {
      if (!val || val.trim() === "") return null;
      const num = parseFloat(val.replace(",", "."));
      return isNaN(num) ? null : num;
    };

    const facialPayload = {
      tipo_pele: tipoPele || null,
      textura: textura || null,
      fototipo: fototipoFacial || null,
      hidratacao_cutanea: parseNum(hidratacaoCutanea),
      oleosidade_sebo: parseNum(oleosidadeSebo),
      glogau: glogau || null,
      acne_grau: acneGrau || null,
      discromias,
      textura_relevo: texturaRelevo,
      vascularizacao,
      outros,
      avaliacao_lupa: avaliacaoLupa.trim() || null,
      exames_laboratoriais: examesLaboratoriais.trim() || null,
    };

    const corporalPayload = {
      fototipo: fototipoCorporal || null,
      hidratacao_local: hidratacaoLocal || null,
      estrias_localizacao: estriasLocalizacao,
      estrias_localizacao_outro: estriasLocalizacaoOutro.trim() || null,
      estrias_tipo_coloracao: estriasTipoColoracao,
      estrias_espessura_profundidade: estriasEspessuraProfundidade,
      estrias_tempo_surgimento: estriasTempoSurgimento.trim() || null,
      estrias_fator_desencadeante: estriasFatorDesencadeante,
      alteracoes_associadas: alteracoesAssociadas,
    };

    try {
      const res = await saveAestheticEvaluationAction(pacienteId, facialPayload, corporalPayload);
      if (res.success) {
        toast({
          type: "success",
          title: "Avaliação Estética Atualizada!",
          description: `Os registros estéticos de ${pacienteNome} foram atualizados no Supabase.`,
        });
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message || "Ocorreu um erro ao gravar a avaliação.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Erro de conexão ao tentar salvar os dados.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative max-w-4xl w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Avaliação Estética Integrada (A&E)
              </h3>
              <p className="text-xs text-slate-500">
                Ficha Técnica Regenerativa • Paciente: <strong>{pacienteNome}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900 px-6 py-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("facial")}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
              activeTab === "facial"
                ? "bg-teal-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Avaliação Facial
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("corporal")}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
              activeTab === "corporal"
                ? "bg-teal-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Avaliação Corporal
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 text-rose-800 text-xs flex items-center gap-2 border border-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-900 dark:text-slate-100">
          {activeTab === "facial" && (
            <div className="space-y-6">
              
              {/* Seção 1: Tipo de Pele e Textura */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block uppercase tracking-wider">
                    Tipo de Pele (Cutânea)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {["Seca", "Normal", "Mista", "Oleosa"].map((t) => (
                      <label key={t} className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="tipoPele"
                          value={t}
                          checked={tipoPele === t}
                          onChange={(e) => setTipoPele(e.target.value)}
                          className="text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 rounded"
                        />
                        <span>{t}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block uppercase tracking-wider">
                    Textura Cutânea
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {["Lisa", "Irregular", "Normal", "Mista"].map((tx) => (
                      <label key={tx} className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="textura"
                          value={tx}
                          checked={textura === tx}
                          onChange={(e) => setTextura(e.target.value)}
                          className="text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 rounded"
                        />
                        <span>{tx}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Seção 2: Fototipo Fitzpatrick e Biometria Cutânea */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block uppercase tracking-wider">
                    Fototipo de Fitzpatrick (Escala I a VI)
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {["I", "II", "III", "IV", "V", "VI"].map((foto) => (
                      <label key={foto} className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                        <input
                          type="radio"
                          name="fototipoFacial"
                          value={foto}
                          checked={fototipoFacial === foto}
                          onChange={(e) => setFototipoFacial(e.target.value)}
                          className="text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 rounded"
                        />
                        <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">{foto}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block uppercase tracking-wider">
                    Biometria Cutânea
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Hidratação (%)</label>
                      <div className="relative">
                        <input
                          type="number"
                          placeholder="Ex: 45"
                          min="0"
                          max="100"
                          value={hidratacaoCutanea}
                          onChange={(e) => setHidratacaoCutanea(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pr-7 focus:outline-none focus:border-teal-500"
                        />
                        <span className="absolute right-2.5 top-1.5 text-xs font-bold text-slate-400">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Oleosidade (%)</label>
                      <div className="relative">
                        <input
                          type="number"
                          placeholder="Ex: 35"
                          min="0"
                          max="100"
                          value={oleosidadeSebo}
                          onChange={(e) => setOleosidadeSebo(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pr-7 focus:outline-none focus:border-teal-500"
                        />
                        <span className="absolute right-2.5 top-1.5 text-xs font-bold text-slate-400">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 3: Glogau e Acne */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block uppercase tracking-wider">
                    Escala de Fotoenvelhecimento de Glogau
                  </span>
                  <div className="space-y-2">
                    {[
                      { val: "I", desc: "I (Sem rugas / Estágio Inicial)" },
                      { val: "II", desc: "II (Rugas dinâmicas ao movimento)" },
                      { val: "III", desc: "III (Rugas estáticas em repouso)" },
                      { val: "IV", desc: "IV (Apenas rugas / Envelhecimento Severo)" },
                    ].map((g) => (
                      <label key={g.val} className="flex items-start gap-2.5 text-xs font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="glogau"
                          value={g.val}
                          checked={glogau === g.val}
                          onChange={(e) => setGlogau(e.target.value)}
                          className="text-teal-600 mt-0.5 h-4 w-4 border-slate-300 rounded"
                        />
                        <span>{g.desc}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block uppercase tracking-wider">
                    Grau de Acne Clínico (Se houver)
                  </span>
                  <div className="space-y-2">
                    {[
                      { val: "I", desc: "Grau I (Comedônica - Cravos apenas)" },
                      { val: "II", desc: "Grau II (Pápulo-pustulosa - Lesões inflamadas)" },
                      { val: "III", desc: "Grau III (Nódulo-cística - Nódulos profundos)" },
                      { val: "IV", desc: "Grau IV (Conglobata - Lesões intercomunicantes)" },
                    ].map((a) => (
                      <label key={a.val} className="flex items-start gap-2.5 text-xs font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="acneGrau"
                          value={a.val}
                          checked={acneGrau === a.val}
                          onChange={(e) => setAcneGrau(e.target.value)}
                          className="text-teal-600 mt-0.5 h-4 w-4 border-slate-300 rounded"
                        />
                        <span>{a.desc}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Seção 4: Alterações Observadas na Pele */}
              <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
                <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block uppercase tracking-wider">
                  Alterações Observadas na Pele (Múltipla Escolha)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Discromias */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Discromias</span>
                    {["Melasma", "Efélides (Sardas)", "HPI (Hiperpigmentação)", "Melanose Solar"].map((dis) => (
                      <label key={dis} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={discromias.includes(dis)}
                          onChange={() => handleToggleCheckbox(dis, discromias, setDiscromias)}
                          className="text-teal-600 rounded"
                        />
                        <span>{dis}</span>
                      </label>
                    ))}
                  </div>

                  {/* Textura e Relevo */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Textura & Relevo</span>
                    {["Óstios Dilatados (Poros)", "Cicatrizes Atróficas", "Hiperqueratose"].map((tr) => (
                      <label key={tr} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={texturaRelevo.includes(tr)}
                          onChange={() => handleToggleCheckbox(tr, texturaRelevo, setTexturaRelevo)}
                          className="text-teal-600 rounded"
                        />
                        <span>{tr}</span>
                      </label>
                    ))}
                  </div>

                  {/* Vascularização */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Vascularização</span>
                    {["Telangiectasias", "Eritema Ativo", "Rosácea"].map((v) => (
                      <label key={v} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={vascularizacao.includes(v)}
                          onChange={() => handleToggleCheckbox(v, vascularizacao, setVascularizacao)}
                          className="text-teal-600 rounded"
                        />
                        <span>{v}</span>
                      </label>
                    ))}
                  </div>

                  {/* Outros */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Outras Ocorrências</span>
                    {["Míliuns", "Ceratose seborreica", "Sinais/nevos suspeitos", "Lesões ativas"].map((o) => (
                      <label key={o} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={outros.includes(o)}
                          onChange={() => handleToggleCheckbox(o, outros, setOutros)}
                          className="text-teal-600 rounded"
                        />
                        <span>{o}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Seção 5: Lupa e Laboratório */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                    Avaliação minuciosa com lupa (Luz polarizada / Wood)
                  </label>
                  <textarea
                    placeholder="Descreva as alterações de relevo, brilho, descamação e lesões sob magnificação..."
                    value={avaliacaoLupa}
                    onChange={(e) => setAvaliacaoLupa(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                    Exames laboratoriais relevantes trazidos pelo paciente
                  </label>
                  <textarea
                    placeholder="Ex: Hemograma, Perfil hormonal, Vitaminas (D, B12), Ferritina..."
                    value={examesLaboratoriais}
                    onChange={(e) => setExamesLaboratoriais(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

            </div>
          )}

          {activeTab === "corporal" && (
            <div className="space-y-6">
              
              {/* Seção 1: Fototipo e Hidratação Local */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block uppercase tracking-wider">
                    Fototipo de Fitzpatrick (Corporal)
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {["I", "II", "III", "IV", "V", "VI"].map((foto) => (
                      <label key={foto} className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                        <input
                          type="radio"
                          name="fototipoCorporal"
                          value={foto}
                          checked={fototipoCorporal === foto}
                          onChange={(e) => setFototipoCorporal(e.target.value)}
                          className="text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 rounded"
                        />
                        <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">{foto}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block uppercase tracking-wider">
                    Hidratação local (Região Alvo)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {["Seca", "Normal", "Mista", "Oleosa"].map((hl) => (
                      <label key={hl} className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="hidratacaoLocal"
                          value={hl}
                          checked={hidratacaoLocal === hl}
                          onChange={(e) => setHidratacaoLocal(e.target.value)}
                          className="text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 rounded"
                        />
                        <span>{hl}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Seção 2: Características das Estrias (Foco Corporal Regenerativo) */}
              <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
                <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block uppercase tracking-wider">
                  Características de Estrias & Turgor Tissular
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Localização */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Localização das Estrias</span>
                    <div className="grid grid-cols-2 gap-2">
                      {["Abdômen", "Flancos", "Glúteos", "Coxas", "Panturrilhas", "Costas", "Mamas"].map((loc) => (
                        <label key={loc} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={estriasLocalizacao.includes(loc)}
                            onChange={() => handleToggleCheckbox(loc, estriasLocalizacao, setEstriasLocalizacao)}
                            className="text-teal-600 rounded"
                          />
                          <span>{loc}</span>
                        </label>
                      ))}
                    </div>
                    <div className="pt-1.5">
                      <input
                        type="text"
                        placeholder="Outro local complementar..."
                        value={estriasLocalizacaoOutro}
                        onChange={(e) => setEstriasLocalizacaoOutro(e.target.value)}
                        className="w-full px-2 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Tipo e Coloração */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Tipo & Coloração</span>
                    {["Rubras (Fase Inflamatória)", "Albas (Fase Cicatricial)", "Hiperpigmentadas (Escuras)"].map((tipo) => (
                      <label key={tipo} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={estriasTipoColoracao.includes(tipo)}
                          onChange={() => handleToggleCheckbox(tipo, estriasTipoColoracao, setEstriasTipoColoracao)}
                          className="text-teal-600 rounded"
                        />
                        <span>{tipo}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200/40 dark:border-slate-800/60 pt-4">
                  {/* Espessura e Profundidade */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Espessura & Profundidade</span>
                    <div className="grid grid-cols-2 gap-2">
                      {["Finas", "Médias", "Largas", "Superficiais", "Atróficas (Profundas)"].map((esp) => (
                        <label key={esp} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={estriasEspessuraProfundidade.includes(esp)}
                            onChange={() => handleToggleCheckbox(esp, estriasEspessuraProfundidade, setEstriasEspessuraProfundidade)}
                            className="text-teal-600 rounded"
                          />
                          <span>{esp}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Tempo e Fatores */}
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Tempo estimado de surgimento</span>
                      <input
                        type="text"
                        placeholder="Ex: Cerca de 2 anos, após gestação, puberdade..."
                        value={estriasTempoSurgimento}
                        onChange={(e) => setEstriasTempoSurgimento(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 3: Fator Desencadeante Provável */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block uppercase tracking-wider">
                    Fator Desencadeante Provável
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      "Implante de Prótese (silicone)",
                      "Hipertrofia Muscular",
                      "Efeito Sanfona (Ganho/perda de peso)",
                      "Cortisol alto / Alterações Hormonais",
                      "Estirão de Crescimento / Puberdade",
                      "Uso de Corticoides / Medicamentoso",
                      "Gestação",
                    ].map((fator) => (
                      <label key={fator} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={estriasFatorDesencadeante.includes(fator)}
                          onChange={() => handleToggleCheckbox(fator, estriasFatorDesencadeante, setEstriasFatorDesencadeante)}
                          className="text-teal-600 rounded"
                        />
                        <span>{fator}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block uppercase tracking-wider">
                    Alterações Corporais Associadas
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      "Flacidez Tissular (Pele)",
                      "FEG (Celulite)",
                      "Lipodistrofia Localizada (Gordura)",
                      "Outras Cicatrizes",
                    ].map((alt) => (
                      <label key={alt} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={alteracoesAssociadas.includes(alt)}
                          onChange={() => handleToggleCheckbox(alt, alteracoesAssociadas, setAlteracoesAssociadas)}
                          className="text-teal-600 rounded"
                        />
                        <span>{alt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl disabled:opacity-60 transition-colors cursor-pointer"
          >
            {isSubmitting ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Gravar Registros Estéticos</span>
          </button>
        </div>

      </div>
    </div>
  );
}
