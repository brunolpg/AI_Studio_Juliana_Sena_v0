"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, AlertCircle, Save } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { saveAestheticEvaluationAction } from "@/actions/clinical-actions";

interface AestheticEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  initialFacial?: any;
  initialCorporal?: any;
  onSuccess?: () => void;
}

export function AestheticEvaluationModal({
  isOpen,
  onClose,
  patientId,
  initialFacial,
  initialCorporal,
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
      setHidratacaoCutanea(
        initialFacial.hidratacao !== null && initialFacial.hidratacao !== undefined
          ? String(initialFacial.hidratacao)
          : ""
      );
      setOleosidadeSebo(
        initialFacial.oleosidade !== null && initialFacial.oleosidade !== undefined
          ? String(initialFacial.oleosidade)
          : ""
      );
      setGlogau(initialFacial.escala_glogau || "");
      setAcneGrau(initialFacial.acne_grau || "");
      setDiscromias(Array.isArray(initialFacial.discromias) ? initialFacial.discromias : []);
      setTexturaRelevo(Array.isArray(initialFacial.textura_relevo) ? initialFacial.textura_relevo : []);
      setVascularizacao(Array.isArray(initialFacial.vascularizacao) ? initialFacial.vascularizacao : []);
      setOutros(Array.isArray(initialFacial.outras_alteracoes) ? initialFacial.outras_alteracoes : []);
      setAvaliacaoLupa(initialFacial.avaliacao_lupa || "");
      setExamesLaboratoriais(initialFacial.exames_laboratoriais || "");
    } else {
      setTipoPele("");
      setTextura("");
      setFototipoFacial("");
      setHidratacaoCutanea("");
      setOleosidadeSebo("");
      setGlogau("");
      setAcneGrau("");
      setDiscromias([]);
      setTexturaRelevo([]);
      setVascularizacao([]);
      setOutros([]);
      setAvaliacaoLupa("");
      setExamesLaboratoriais("");
    }

    if (initialCorporal) {
      setFototipoCorporal(initialCorporal.fototipo || "");
      setHidratacaoLocal(initialCorporal.hidratacao_pele || "");
      setEstriasLocalizacao(Array.isArray(initialCorporal.estrias_localizacao) ? initialCorporal.estrias_localizacao : []);
      setEstriasLocalizacaoOutro(initialCorporal.estrias_localizacao_outros || "");
      setEstriasTipoColoracao(Array.isArray(initialCorporal.estrias_tipo_coloracao) ? initialCorporal.estrias_tipo_coloracao : []);
      setEstriasEspessuraProfundidade(Array.isArray(initialCorporal.estrias_espessura) ? initialCorporal.estrias_espessura : []);
      setEstriasTempoSurgimento(initialCorporal.tempo_estimado_surgimento || "");
      setEstriasFatorDesencadeante(Array.isArray(initialCorporal.fatores_desencadeantes) ? initialCorporal.fatores_desencadeantes : []);
      setAlteracoesAssociadas(Array.isArray(initialCorporal.alteracoes_associadas) ? initialCorporal.alteracoes_associadas : []);
    } else {
      setFototipoCorporal("");
      setHidratacaoLocal("");
      setEstriasLocalizacao([]);
      setEstriasLocalizacaoOutro("");
      setEstriasTipoColoracao([]);
      setEstriasEspessuraProfundidade([]);
      setEstriasTempoSurgimento("");
      setEstriasFatorDesencadeante([]);
      setAlteracoesAssociadas([]);
    }
  }, [initialFacial, initialCorporal, isOpen]);

  if (!isOpen) return null;

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

    const payload = {
      facial: {
        tipo_pele: tipoPele || null,
        textura: textura || null,
        fototipo: fototipoFacial || null,
        hidratacao: parseNum(hidratacaoCutanea),
        oleosidade: parseNum(oleosidadeSebo),
        escala_glogau: glogau || null,
        acne_grau: acneGrau || null,
        discromias,
        textura_relevo: texturaRelevo,
        vascularizacao,
        outras_alteracoes: outros,
        avaliacao_lupa: avaliacaoLupa.trim() || null,
        exames_laboratoriais: examesLaboratoriais.trim() || null,
      },
      corporal: {
        fototipo: fototipoCorporal || null,
        hidratacao_pele: hidratacaoLocal || null,
        estrias_localizacao: estriasLocalizacao,
        estrias_localizacao_outros: estriasLocalizacaoOutro.trim() || null,
        estrias_tipo_coloracao: estriasTipoColoracao,
        estrias_espessura: estriasEspessuraProfundidade,
        tempo_estimado_surgimento: estriasTempoSurgimento.trim() || null,
        fatores_desencadeantes: estriasFatorDesencadeante,
        alteracoes_associadas: alteracoesAssociadas,
      }
    };

    try {
      const res = await saveAestheticEvaluationAction(patientId, payload);
      if (res.success) {
        toast({
          type: "success",
          title: "Avaliação Estética Atualizada!",
          description: "Os registros estéticos foram atualizados no Supabase.",
        });
        if (onSuccess) onSuccess();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative max-w-4xl w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden shadow-2xl my-6 max-h-[90vh]">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Avaliação Estética Integrada
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ficha Técnica Facial e Corporal para Estética Regenerativa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alternador de Abas */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 px-6 py-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("facial")}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
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
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === "corporal"
                ? "bg-teal-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Avaliação Corporal
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-400 text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-900/50 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Área Rolável */}
        <form onSubmit={handleSave} className="overflow-y-auto p-4 sm:p-6 space-y-6 flex-1 text-slate-900 dark:text-slate-100">
          {activeTab === "facial" && (
            <div className="space-y-6">
              
              {/* Tipo de Pele e Textura */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block">
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
                          className="text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 dark:border-slate-700 rounded"
                        />
                        <span>{t}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block">
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
                          className="text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 dark:border-slate-700 rounded"
                        />
                        <span>{tx}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fototipo Fitzpatrick e Biometria Cutânea */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block">
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
                          className="text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 dark:border-slate-700 rounded"
                        />
                        <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">{foto}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block">
                    Biometria Cutânea
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Hidratação (%)</label>
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
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Oleosidade (%)</label>
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

              {/* Escala Glogau */}
              <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block">
                  Escala de Fotoenvelhecimento de Glogau
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                        className="text-teal-600 mt-0.5 h-4 w-4 border-slate-300 dark:border-slate-700 rounded"
                      />
                      <span>{g.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Alterações Dérmicas */}
              <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
                <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block">
                  Alterações Dérmicas
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                  {/* Acne */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">Acne (Graus)</span>
                    {["Grau I", "Grau II", "Grau III", "Grau IV"].map((ac) => (
                      <label key={ac} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name="acne"
                          value={ac}
                          checked={acneGrau === ac}
                          onChange={(e) => setAcneGrau(e.target.value)}
                          className="text-teal-600 h-4 w-4 border-slate-300 dark:border-slate-700 rounded"
                        />
                        <span>{ac}</span>
                      </label>
                    ))}
                    {acneGrau && (
                      <button
                        type="button"
                        onClick={() => setAcneGrau("")}
                        className="text-[10px] text-rose-500 hover:underline block mt-1 cursor-pointer"
                      >
                        Limpar seleção
                      </button>
                    )}
                  </div>

                  {/* Discromias */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">Discromias</span>
                    {["Melasma", "Efélides", "HPI", "Melanose Solar"].map((dis) => (
                      <label key={dis} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={discromias.includes(dis)}
                          onChange={() => handleToggleCheckbox(dis, discromias, setDiscromias)}
                          className="text-teal-600 rounded border-slate-300 dark:border-slate-700"
                        />
                        <span>{dis}</span>
                      </label>
                    ))}
                  </div>

                  {/* Textura e Relevo */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">Textura e Relevo</span>
                    {["Óstios Dilatados", "Cicatrizes Atróficas", "Hiperqueratose"].map((tr) => (
                      <label key={tr} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={texturaRelevo.includes(tr)}
                          onChange={() => handleToggleCheckbox(tr, texturaRelevo, setTexturaRelevo)}
                          className="text-teal-600 rounded border-slate-300 dark:border-slate-700"
                        />
                        <span>{tr}</span>
                      </label>
                    ))}
                  </div>

                  {/* Vascularização */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">Vascularização</span>
                    {["Telangiectasias", "Eritema Ativo", "Rosácea"].map((v) => (
                      <label key={v} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={vascularizacao.includes(v)}
                          onChange={() => handleToggleCheckbox(v, vascularizacao, setVascularizacao)}
                          className="text-teal-600 rounded border-slate-300 dark:border-slate-700"
                        />
                        <span>{v}</span>
                      </label>
                    ))}
                  </div>

                  {/* Outras Alterações */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">Outras Alterações</span>
                    {["Míliuns", "Ceratose", "Sinais suspeitos", "Lesões ativas"].map((o) => (
                      <label key={o} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={outros.includes(o)}
                          onChange={() => handleToggleCheckbox(o, outros, setOutros)}
                          className="text-teal-600 rounded border-slate-300 dark:border-slate-700"
                        />
                        <span>{o}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Textareas de Observações */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                    Avaliação com Lupa
                  </label>
                  <textarea
                    placeholder="Descreva as alterações observadas com o auxílio da lupa de magnificação..."
                    value={avaliacaoLupa}
                    onChange={(e) => setAvaliacaoLupa(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                    Exames Laboratoriais Relevantes
                  </label>
                  <textarea
                    placeholder="Anote resultados ou exames pendentes (ex: Perfil hormonal, Vitaminas, Marcadores inflamatórios)..."
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
              
              {/* Fototipo e Hidratação Local */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block">
                    Fototipo de Fitzpatrick
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
                          className="text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 dark:border-slate-700 rounded"
                        />
                        <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">{foto}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block">
                    Hidratação Local
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
                          className="text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 dark:border-slate-700 rounded"
                        />
                        <span>{hl}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Características das Estrias */}
              <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
                <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block">
                  Características das Estrias
                </span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Localização */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">Localizações</span>
                    <div className="grid grid-cols-2 gap-2">
                      {["Abdômen", "Flancos", "Glúteos", "Coxas", "Panturrilhas", "Costas", "Mamas"].map((loc) => (
                        <label key={loc} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={estriasLocalizacao.includes(loc)}
                            onChange={() => handleToggleCheckbox(loc, estriasLocalizacao, setEstriasLocalizacao)}
                            className="text-teal-600 rounded border-slate-300 dark:border-slate-700"
                          />
                          <span>{loc}</span>
                        </label>
                      ))}
                    </div>
                    <div className="pt-2">
                      <input
                        type="text"
                        placeholder="Outras localizações..."
                        value={estriasLocalizacaoOutro}
                        onChange={(e) => setEstriasLocalizacaoOutro(e.target.value)}
                        className="w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Tipos e Coloração */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">Tipos e Coloração</span>
                    {["Rubras", "Albas", "Hiperpigmentadas"].map((tipo) => (
                      <label key={tipo} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={estriasTipoColoracao.includes(tipo)}
                          onChange={() => handleToggleCheckbox(tipo, estriasTipoColoracao, setEstriasTipoColoracao)}
                          className="text-teal-600 rounded border-slate-300 dark:border-slate-700"
                        />
                        <span>{tipo}</span>
                      </label>
                    ))}
                  </div>

                  {/* Espessura */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">Espessura e Profundidade</span>
                    {["Finas", "Médias", "Largas", "Superficiais", "Atróficas"].map((esp) => (
                      <label key={esp} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={estriasEspessuraProfundidade.includes(esp)}
                          onChange={() => handleToggleCheckbox(esp, estriasEspessuraProfundidade, setEstriasEspessuraProfundidade)}
                          className="text-teal-600 rounded border-slate-300 dark:border-slate-700"
                        />
                        <span>{esp}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tempo de Surgimento e Fatores Desencadeantes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block">
                    Fatores Desencadeantes
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      "Implante de Prótese",
                      "Hipertrofia Muscular",
                      "Efeito Sanfona",
                      "Cortisol Alto",
                      "Estirão de Crescimento",
                      "Corticoides",
                      "Gestação",
                    ].map((fator) => (
                      <label key={fator} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={estriasFatorDesencadeante.includes(fator)}
                          onChange={() => handleToggleCheckbox(fator, estriasFatorDesencadeante, setEstriasFatorDesencadeante)}
                          className="text-teal-600 rounded border-slate-300 dark:border-slate-700"
                        />
                        <span>{fator}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block">
                    Informações Gerais
                  </span>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Tempo Estimado de Surgimento</label>
                    <input
                      type="text"
                      placeholder="Ex: 6 meses, desde a puberdade..."
                      value={estriasTempoSurgimento}
                      onChange={(e) => setEstriasTempoSurgimento(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Alterações Associadas */}
              <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block">
                  Alterações Associadas
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    "Flacidez Tissular",
                    "FEG (Celulite)",
                    "Lipodistrofia",
                    "Outras Cicatrizes",
                  ].map((alt) => (
                    <label key={alt} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alteracoesAssociadas.includes(alt)}
                        onChange={() => handleToggleCheckbox(alt, alteracoesAssociadas, setAlteracoesAssociadas)}
                        className="text-teal-600 rounded border-slate-300 dark:border-slate-700"
                      />
                      <span>{alt}</span>
                    </label>
                  ))}
                </div>
              </div>

            </div>
          )}
        </form>

        {/* Rodapé */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors disabled:opacity-60 cursor-pointer"
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
