"use client";

import React, { useState, useTransition } from "react";
import { X, UserCheck, AlertCircle, CheckCircle2, Calendar, MapPin, Phone, Mail, FileText, Search, Loader2 } from "lucide-react";
import { BRAZILIAN_STATES, CITIES_BY_STATE, formatCPF, formatPhone, formatCEP, isValidCPF, calculateAge, fetchAddressByCEP } from "@/lib/brazil-data";
import { createClientAction, updateClientAction } from "@/actions/client-actions";
import { clientSchema } from "@/lib/validations/client-schema";
import { useToast } from "@/components/ui/toast";
import type { Client } from "@/types/client";

interface ClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientToEdit?: Client | null;
}

interface ClientFormContentProps {
  onClose: () => void;
  onSuccess: () => void;
  clientToEdit?: Client | null;
}

function ClientFormContent({ onClose, onSuccess, clientToEdit }: ClientFormContentProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Estados inicializados a partir das props (resetados automaticamente via key)
  const [nome, setNome] = useState(clientToEdit?.nome ?? "");
  const [dataNascimento, setDataNascimento] = useState(clientToEdit?.data_nascimento ?? "");
  const [email, setEmail] = useState(clientToEdit?.email ?? "");
  const [sexo, setSexo] = useState<"Masculino" | "Feminino" | "Outros">(clientToEdit?.sexo ?? "Feminino");
  const [telefone, setTelefone] = useState(clientToEdit?.telefone ?? "");
  const [cpf, setCpf] = useState(clientToEdit?.cpf ?? "");
  const [cep, setCep] = useState(clientToEdit?.cep ?? "");
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [cepFeedback, setCepFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [logradouro, setLogradouro] = useState(clientToEdit?.logradouro ?? "");
  const [numero, setNumero] = useState(clientToEdit?.numero ?? "");
  const [complemento, setComplemento] = useState(clientToEdit?.complemento ?? "");
  const [estado, setEstado] = useState(clientToEdit?.estado ?? "SP");
  const [cidade, setCidade] = useState(clientToEdit?.cidade ?? CITIES_BY_STATE["SP"]?.[0] ?? "");
  const [profissao, setProfissao] = useState(clientToEdit?.profissao ?? "");
  const [status, setStatus] = useState<"Ativo" | "Inativo">(clientToEdit?.status ?? "Ativo");
  const [observacoes, setObservacoes] = useState(clientToEdit?.observacoes ?? "");

  // Foto de Perfil & Corte (Crop 1:1)
  const [fotoPerfil, setFotoPerfil] = useState<string | null>(clientToEdit?.foto_perfil ?? null);
  const [tempImgSrc, setTempImgSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Estado para erros de validação por campo
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Idade é derivada matematicamente em tempo real (sem useEffect!)
  const idade = dataNascimento ? calculateAge(dataNascimento) : null;

  // Cidades dinâmicas pelo estado selecionado
  const availableCities = CITIES_BY_STATE[estado] || [];

  // Atualiza cidade ao trocar estado
  const handleEstadoChange = (newEstado: string) => {
    setEstado(newEstado);
    const cities = CITIES_BY_STATE[newEstado] || [];
    setCidade(cities[0] || "");
  };

  const searchCepAddress = async (cepDigits: string) => {
    const clean = cepDigits.replace(/\D/g, "");
    if (clean.length !== 8) return;

    setIsSearchingCep(true);
    setCepFeedback({ type: "info", message: "Buscando dados do endereço..." });

    try {
      const address = await fetchAddressByCEP(clean);
      if (address && address.logradouro) {
        // Preenche o campo Logradouro automaticamente
        setLogradouro(address.logradouro);

        // Se houver UF identificada, sincroniza estado e cidades
        if (address.uf && BRAZILIAN_STATES.some((s) => s.uf === address.uf)) {
          setEstado(address.uf);
          if (address.localidade) {
            setCidade(address.localidade);
          }
        }

        if (address.complemento && !complemento) {
          setComplemento(address.complemento);
        }

        // Limpa possíveis erros prévios de logradouro e cep
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.logradouro;
          delete next.cep;
          return next;
        });

        setCepFeedback({
          type: "success",
          message: `Logradouro preenchido com sucesso: ${address.logradouro}${address.bairro ? ` (${address.bairro})` : ""}`,
        });
      } else {
        setCepFeedback({
          type: "error",
          message: "CEP não localizado nos Correios. Preencha o logradouro manualmente.",
        });
      }
    } catch {
      setCepFeedback({
        type: "error",
        message: "Não foi possível consultar o CEP agora. Preencha o logradouro manualmente.",
      });
    } finally {
      setIsSearchingCep(false);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCEP(e.target.value);
    setCep(formatted);

    if (fieldErrors.cep) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.cep;
        return next;
      });
    }

    const clean = formatted.replace(/\D/g, "");
    if (clean.length === 8) {
      searchCepAddress(clean);
    } else {
      setCepFeedback(null);
    }
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setCpf(formatted);
    if (fieldErrors.cpf) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.cpf;
        return next;
      });
    }
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setTelefone(formatted);
    if (fieldErrors.telefone) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.telefone;
        return next;
      });
    }
  };

  // Upload e Crop 1:1 handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validação de tamanho (5 MB = 5 * 1024 * 1024 bytes)
    const limit = 5 * 1024 * 1024;
    if (file.size > limit) {
      toast({
        type: "error",
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido para a foto é de 5 MB.",
      });
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setTempImgSrc(reader.result);
        setZoom(1);
        setPosition({ x: 0, y: 0 });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Dragging mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Dragging touch (Mobile support!)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleConfirmCrop = () => {
    if (!tempImgSrc) return;

    const img = new Image();
    img.src = tempImgSrc;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext("2d");

      if (!ctx) return;

      // Fill white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 300, 300);

      // Calcular dimensões iniciais enquadradas no box de 300x300
      let initW = img.naturalWidth;
      let initH = img.naturalHeight;
      const ratio = initW / initH;
      if (initW > initH) {
        initH = 300;
        initW = 300 * ratio;
      } else {
        initW = 300;
        initH = 300 / ratio;
      }

      const initX = (300 - initW) / 2;
      const initY = (300 - initH) / 2;

      ctx.save();
      // Transforma e translada baseado na origem center-center
      ctx.translate(150, 150);
      ctx.translate(position.x, position.y);
      ctx.scale(zoom, zoom);
      ctx.translate(-150, -150);

      ctx.drawImage(img, initX, initY, initW, initH);
      ctx.restore();

      const croppedBase64 = canvas.toDataURL("image/jpeg", 0.85);
      setFotoPerfil(croppedBase64);
      setTempImgSrc(null);
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const calculated = calculateAge(dataNascimento);
    const payload = {
      nome: nome.trim(),
      data_nascimento: dataNascimento,
      idade: calculated ?? 0,
      email: email.trim(),
      sexo,
      telefone: telefone.trim(),
      cpf: cpf.trim(),
      cep: cep.trim() || null,
      logradouro: logradouro.trim(),
      numero: numero.trim(),
      complemento: complemento.trim() || null,
      estado,
      cidade: cidade.trim(),
      profissao: profissao.trim() || null,
      status,
      observacoes: observacoes.trim() || null,
      foto_perfil: fotoPerfil || null,
    };

    // Validação preliminar com Zod no cliente para feedback instantâneo
    const validation = clientSchema.safeParse(payload);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] ? String(issue.path[0]) : "geral";
        if (!errors[field]) {
          errors[field] = issue.message;
        }
      });
      setFieldErrors(errors);
      toast({
        type: "error",
        title: "Campos obrigatórios pendentes",
        description: "Verifique os avisos em destaque vermelho no formulário.",
      });
      return;
    }

    setFieldErrors({});

    startTransition(async () => {
      let result;
      if (clientToEdit) {
        result = await updateClientAction(clientToEdit.id, payload);
      } else {
        result = await createClientAction(payload);
      }

      if (result.success) {
        toast({
          type: "success",
          title: clientToEdit ? "Cadastro atualizado" : "Paciente cadastrado",
          description: result.message,
        });
        onSuccess();
        onClose();
      } else {
        if (result.errors) {
          const mappedErrors: Record<string, string> = {};
          Object.entries(result.errors).forEach(([key, messages]) => {
            mappedErrors[key] = messages[0];
          });
          setFieldErrors(mappedErrors);
        }
        toast({
          type: "error",
          title: "Não foi possível salvar",
          description: result.message || "Revise os dados informados.",
        });
      }
    });
  };

  const isCpfValid = cpf.length === 14 ? isValidCPF(cpf) : null;

  return (
    <div
      id="client-form-modal-dialog"
      className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 my-8 overflow-hidden transition-all"
    >
      {/* Cabeçalho do Modal */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-400">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-lg leading-none">
              {clientToEdit ? "Editar Dados do Paciente" : "Novo Cadastro de Paciente"}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Preencha todos os campos obrigatórios. A idade é calculada dinamicamente.
            </p>
          </div>
        </div>
        <button
          id="close-client-form-modal"
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-700 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
        {/* Seção 1: Identificação Pessoal */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5" /> Identificação e Dados Pessoais
          </h4>

          {/* Área do Avatar */}
          <div className="mb-5 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-teal-500/10 border border-teal-500/20 shadow-xs flex items-center justify-center shrink-0">
              {fotoPerfil ? (
                <img src={fotoPerfil} alt="Prévia" className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <div className="text-teal-600 dark:text-teal-400 font-bold text-2xl uppercase">
                  {nome ? nome.charAt(0).toUpperCase() : "P"}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 text-center sm:text-left">
                Foto de Perfil do Paciente
              </span>
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <label className="px-3 py-1.5 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-lg cursor-pointer shadow-xs transition-colors">
                  <span>+ Foto</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/jpg"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                {fotoPerfil && (
                  <button
                    type="button"
                    onClick={() => setFotoPerfil(null)}
                    className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer transition-colors"
                  >
                    Remover foto
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400 text-center sm:text-left mt-0.5">
                PNG ou JPG de até 5 MB (crop 1:1 automático).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Nome */}
            <div className="md:col-span-8">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nome Completo *
              </label>
              <input
                id="client-form-nome"
                type="text"
                required
                placeholder="Ex: Mariana Alcantara Silveira"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={`w-full px-3.5 py-2 text-sm rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                  fieldErrors.nome
                    ? "border-rose-500 focus:ring-rose-500/20"
                    : "border-slate-300 dark:border-slate-700 focus:ring-teal-500/20 focus:border-teal-500"
                }`}
              />
              {fieldErrors.nome && (
                <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.nome}
                </p>
              )}
            </div>

            {/* Sexo */}
            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sexo *
              </label>
              <select
                id="client-form-sexo"
                value={sexo}
                onChange={(e) => setSexo(e.target.value as "Masculino" | "Feminino" | "Outros")}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              >
                <option value="Feminino">Feminino</option>
                <option value="Masculino">Masculino</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            {/* Data de Nascimento */}
            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Data de Nascimento *
              </label>
              <input
                id="client-form-data-nascimento"
                type="date"
                required
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                className={`w-full px-3.5 py-2 text-sm rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                  fieldErrors.data_nascimento
                    ? "border-rose-500 focus:ring-rose-500/20"
                    : "border-slate-300 dark:border-slate-700 focus:ring-teal-500/20 focus:border-teal-500"
                }`}
              />
              {fieldErrors.data_nascimento && (
                <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.data_nascimento}
                </p>
              )}
            </div>

            {/* Idade (Calculada Automaticamente e NÃO Editável) */}
            <div className="md:col-span-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Idade (Automática)
                </label>
                <span className="text-[10px] uppercase font-semibold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                  Não editável
                </span>
              </div>
              <div className="relative">
                <input
                  id="client-form-idade"
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={idade !== null ? `${idade} anos` : "Aguardando data..."}
                  className="w-full px-3.5 py-2 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 cursor-not-allowed select-none"
                />
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                Derivada dinamicamente da data de nascimento.
              </p>
            </div>

            {/* CPF com validação */}
            <div className="md:col-span-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  CPF Válido *
                </label>
                {isCpfValid !== null && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                      isCpfValid
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                        : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
                    }`}
                  >
                    {isCpfValid ? (
                      <>
                        <CheckCircle2 className="w-2.5 h-2.5" /> Válido
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-2.5 h-2.5" /> Inválido
                      </>
                    )}
                  </span>
                )}
              </div>
              <input
                id="client-form-cpf"
                type="text"
                required
                placeholder="000.000.000-00"
                maxLength={14}
                value={cpf}
                onChange={handleCpfChange}
                className={`w-full px-3.5 py-2 text-sm rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                  fieldErrors.cpf
                    ? "border-rose-500 focus:ring-rose-500/20"
                    : "border-slate-300 dark:border-slate-700 focus:ring-teal-500/20 focus:border-teal-500"
                }`}
              />
              {fieldErrors.cpf && (
                <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.cpf}
                </p>
              )}
            </div>

            {/* Telefone */}
            <div className="md:col-span-6">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" /> Telefone / WhatsApp *
              </label>
              <input
                id="client-form-telefone"
                type="text"
                required
                placeholder="(11) 98765-4321"
                maxLength={15}
                value={telefone}
                onChange={handleTelefoneChange}
                className={`w-full px-3.5 py-2 text-sm rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                  fieldErrors.telefone
                    ? "border-rose-500 focus:ring-rose-500/20"
                    : "border-slate-300 dark:border-slate-700 focus:ring-teal-500/20 focus:border-teal-500"
                }`}
              />
              {fieldErrors.telefone && (
                <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.telefone}
                </p>
              )}
            </div>

            {/* E-mail */}
            <div className="md:col-span-6">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> E-mail *
              </label>
              <input
                id="client-form-email"
                type="email"
                required
                placeholder="paciente@exemplo.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-3.5 py-2 text-sm rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                  fieldErrors.email
                    ? "border-rose-500 focus:ring-rose-500/20"
                    : "border-slate-300 dark:border-slate-700 focus:ring-teal-500/20 focus:border-teal-500"
                }`}
              />
              {fieldErrors.email && (
                <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.email}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Seção 2: Endereço e Localização */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Endereço Residencial / Comercial
            </h4>
            <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium flex items-center gap-1">
              ✨ Digite o CEP para autopreencher o logradouro
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* 1º CAMPO: CEP (com busca automática e preenchimento de logradouro) */}
            <div className="md:col-span-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  CEP *
                </label>
                {isSearchingCep ? (
                  <span className="text-[10px] font-medium text-teal-600 dark:text-teal-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">1º campo</span>
                )}
              </div>
              <div className="relative">
                <input
                  id="client-form-cep"
                  type="text"
                  placeholder="00000-000"
                  maxLength={9}
                  value={cep}
                  onChange={handleCepChange}
                  className={`w-full pl-3.5 pr-9 py-2 text-sm rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                    fieldErrors.cep
                      ? "border-rose-500 focus:ring-rose-500/20"
                      : "border-slate-300 dark:border-slate-700 focus:ring-teal-500/20 focus:border-teal-500"
                  }`}
                />
                <button
                  type="button"
                  title="Consultar CEP"
                  onClick={() => searchCepAddress(cep)}
                  disabled={isSearchingCep || cep.replace(/\D/g, "").length !== 8}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-teal-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>
              {fieldErrors.cep && (
                <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.cep}
                </p>
              )}
              {cepFeedback && (
                <p
                  className={`text-[11px] mt-1 flex items-start gap-1 leading-snug ${
                    cepFeedback.type === "success"
                      ? "text-emerald-700 dark:text-emerald-400 font-medium"
                      : cepFeedback.type === "error"
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-slate-500"
                  }`}
                >
                  {cepFeedback.type === "success" && <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5" />}
                  {cepFeedback.type === "error" && <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />}
                  <span>{cepFeedback.message}</span>
                </p>
              )}
            </div>

            {/* 2º CAMPO: Logradouro (Preenchido Automaticamente a partir do CEP) */}
            <div className="md:col-span-8">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Logradouro (Rua, Av, etc.) *
                </label>
                {cepFeedback?.type === "success" && (
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Preenchido via CEP
                  </span>
                )}
              </div>
              <input
                id="client-form-logradouro"
                type="text"
                required
                placeholder="Ex: Avenida Paulista"
                value={logradouro}
                onChange={(e) => setLogradouro(e.target.value)}
                className={`w-full px-3.5 py-2 text-sm rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                  fieldErrors.logradouro
                    ? "border-rose-500 focus:ring-rose-500/20"
                    : "border-slate-300 dark:border-slate-700 focus:ring-teal-500/20 focus:border-teal-500"
                }`}
              />
              {fieldErrors.logradouro && (
                <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.logradouro}
                </p>
              )}
            </div>

            {/* Número */}
            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Número *
              </label>
              <input
                id="client-form-numero"
                type="text"
                required
                placeholder="Ex: 1578 ou S/N"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className={`w-full px-3.5 py-2 text-sm rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                  fieldErrors.numero
                    ? "border-rose-500 focus:ring-rose-500/20"
                    : "border-slate-300 dark:border-slate-700 focus:ring-teal-500/20 focus:border-teal-500"
                }`}
              />
              {fieldErrors.numero && (
                <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.numero}
                </p>
              )}
            </div>

            {/* Complemento */}
            <div className="md:col-span-8">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Complemento (opcional)
              </label>
              <input
                id="client-form-complemento"
                type="text"
                placeholder="Ex: Apto 84, Bloco B"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            {/* Estado (Combobox) */}
            <div className="md:col-span-6">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Estado (UF) *
              </label>
              <select
                id="client-form-estado"
                value={estado}
                onChange={(e) => handleEstadoChange(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              >
                {BRAZILIAN_STATES.map((st) => (
                  <option key={st.uf} value={st.uf}>
                    {st.uf} — {st.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Cidade (Combobox Associado ao Estado) */}
            <div className="md:col-span-6">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cidade (Associada à seleção da UF) *
              </label>
              <input
                id="client-form-cidade"
                type="text"
                required
                list="cidades-list"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Selecione ou digite a cidade"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
              <datalist id="cidades-list">
                {availableCities.map((cityName) => (
                  <option key={cityName} value={cityName} />
                ))}
              </datalist>
            </div>
          </div>
        </div>

        {/* Seção 3: Dados Complementares e Status */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Informações Complementares e Observações
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Profissão */}
            <div className="md:col-span-6">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Profissão (opcional)
              </label>
              <input
                id="client-form-profissao"
                type="text"
                placeholder="Ex: Arquiteta, Advogado, Estudante"
                value={profissao}
                onChange={(e) => setProfissao(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            {/* Status Ativo / Inativo */}
            <div className="md:col-span-6">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status no Sistema *
              </label>
              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="status"
                    value="Ativo"
                    checked={status === "Ativo"}
                    onChange={() => setStatus("Ativo")}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Ativo
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="status"
                    value="Inativo"
                    checked={status === "Inativo"}
                    onChange={() => setStatus("Inativo")}
                    className="text-slate-500 focus:ring-slate-400"
                  />
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400" /> Inativo
                  </span>
                </label>
              </div>
            </div>

            {/* Observações */}
            <div className="md:col-span-12">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Observações Clínicas / Administrativas
              </label>
              <textarea
                id="client-form-observacoes"
                rows={3}
                placeholder="Informações médicas relevantes, histórico de alergias, preferências de contato, etc."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Rodapé e Botões de Ação */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            id="client-form-cancel-btn"
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            id="client-form-submit-btn"
            type="submit"
            disabled={isPending}
            className="px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Salvando dados...
              </>
            ) : clientToEdit ? (
              "Salvar Alterações"
            ) : (
              "Cadastrar Paciente"
            )}
          </button>
        </div>
      </form>

      {/* Submodal de Corte 1:1 */}
      {tempImgSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="relative max-w-sm w-full bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h5 className="font-bold text-sm text-slate-900 dark:text-white">
                Ajustar e Enquadrar Foto
              </h5>
              <button
                type="button"
                onClick={() => setTempImgSrc(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Arraste a imagem para reposicionar e ajuste o controle deslizante abaixo para o enquadramento ideal.
            </p>

            {/* Área de Visualização e Movimento (300x300) */}
            <div
              className="relative w-[300px] h-[300px] mx-auto overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 cursor-move select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img
                id="cropper-image"
                src={tempImgSrc}
                alt="Ajustar"
                draggable={false}
                className="absolute max-w-none pointer-events-none origin-center"
                style={{
                  left: "50%",
                  top: "50%",
                  transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                }}
              />
              <div className="absolute inset-0 border-2 border-dashed border-teal-500/40 rounded-2xl pointer-events-none" />
            </div>

            {/* Slider de Zoom */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                <span>Zoom</span>
                <span>{Math.round(zoom * 100)}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none"
              />
            </div>

            {/* Botões do Submodal */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTempImgSrc(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCrop}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl"
              >
                Confirmar Foto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ClientFormModal({
  isOpen,
  onClose,
  onSuccess,
  clientToEdit,
}: ClientFormModalProps) {
  if (!isOpen) return null;

  return (
    <div
      id="client-form-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <ClientFormContent
        key={clientToEdit ? clientToEdit.id : "new"}
        onClose={onClose}
        onSuccess={onSuccess}
        clientToEdit={clientToEdit}
      />
    </div>
  );
}
