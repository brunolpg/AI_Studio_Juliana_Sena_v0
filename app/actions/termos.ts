"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfissionalAccess } from "@/lib/auth/session";
import {
  criarTermoSchema,
  normalizeDeclaracaoOrdem,
  termoModeloSchema,
  termoSnapshotSchema,
  uploadTermoAssinadoSchema,
  type CriarTermoInput,
  type TermoModeloInput,
} from "@/lib/validations/termo";
import type {
  TermoActionResult,
  TermoConsentimento,
  TermoDeclaracao,
  TermoDeclaracaoBloco,
  TermoModelo,
  TermoProcedimento,
  TermoSnapshot,
  TermoTopico,
} from "@/types/termo";

const TERMOS_BUCKET = "termos-consentimento";
const MAX_TERMO_PDF_BYTES = 1 * 1024 * 1024; // 1MB
const SIGNED_URL_EXPIRES_IN = 300; // 300s
const DEFAULT_PROFISSIONAL = "Dra. Juliana Sena";
const DECLARACAO_ORDEM_META_PREFIX = "__ordem_blocos__:";

const uuidSchema = z.string().uuid();

function getTodaySaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

function isPdfBuffer(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 5) return false;
  // Magic header "%PDF-" (0x25 0x50 0x44 0x46 0x2D)
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

function extractDeclaracaoLinhasAndOrdem(
  rawLinhas: unknown,
  rawOrdemBlocos: unknown
): { linhas_checkbox: string[]; ordem_blocos: TermoDeclaracaoBloco[] } {
  const rawArray = Array.isArray(rawLinhas)
    ? rawLinhas.map((item: unknown) => String(item))
    : [];

  let fallbackOrdem: string[] | null = null;
  const cleanLinhas: string[] = [];

  for (const item of rawArray) {
    if (item.startsWith(DECLARACAO_ORDEM_META_PREFIX)) {
      fallbackOrdem = item
        .slice(DECLARACAO_ORDEM_META_PREFIX.length)
        .split(",")
        .map((s) => s.trim());
    } else {
      cleanLinhas.push(item);
    }
  }

  const ordemSource = Array.isArray(rawOrdemBlocos)
    ? rawOrdemBlocos.map((item: unknown) => String(item))
    : fallbackOrdem;

  return {
    linhas_checkbox: cleanLinhas,
    ordem_blocos: normalizeDeclaracaoOrdem(ordemSource),
  };
}

function encodeDeclaracaoLinhasWithOrdemFallback(
  linhas: string[],
  ordemBlocos: TermoDeclaracaoBloco[]
): string[] {
  const cleanLinhas = linhas.filter(
    (item) => !item.startsWith(DECLARACAO_ORDEM_META_PREFIX)
  );
  if (ordemBlocos[0] === "confirmacoes") {
    return [
      `${DECLARACAO_ORDEM_META_PREFIX}${ordemBlocos.join(",")}`,
      ...cleanLinhas,
    ];
  }
  return cleanLinhas;
}

function isMissingOrdemBlocosColumnError(
  error: { code?: string; message?: string } | null
): boolean {
  if (!error) return false;
  const code = String(error.code || "");
  const message = String(error.message || "").toLowerCase();
  return (
    (code === "42703" ||
      code === "PGRST204" ||
      message.includes("schema cache") ||
      message.includes("does not exist")) &&
    message.includes("ordem_blocos")
  );
}

function normalizeTermoModelo(raw: any): TermoModelo {
  const procedimentoRaw = Array.isArray(raw?.procedimento)
    ? raw.procedimento[0]
    : raw?.procedimento;

  const topicosRaw: any[] = Array.isArray(raw?.topicos) ? raw.topicos : [];
  const topicos: TermoTopico[] = [...topicosRaw]
    .sort((a, b) => (a?.ordem ?? 0) - (b?.ordem ?? 0))
    .map((t) => ({
      id: t.id,
      modelo_id: t.modelo_id,
      ordem: Number(t.ordem) || 0,
      titulo: String(t.titulo || ""),
      texto_topico: String(t.texto_topico || ""),
      linhas_checkbox: Array.isArray(t.linhas_checkbox)
        ? t.linhas_checkbox.map((item: unknown) => String(item))
        : [],
      created_at: t.created_at,
      updated_at: t.updated_at,
    }));

  const declaracaoRaw = Array.isArray(raw?.declaracao)
    ? raw.declaracao[0]
    : raw?.declaracao;

  const declaracaoParsed = declaracaoRaw
    ? extractDeclaracaoLinhasAndOrdem(
        declaracaoRaw.linhas_checkbox,
        declaracaoRaw.ordem_blocos
      )
    : null;

  const declaracao: TermoDeclaracao | null =
    declaracaoRaw && declaracaoParsed
      ? {
          id: declaracaoRaw.id,
          modelo_id: declaracaoRaw.modelo_id,
          titulo: String(declaracaoRaw.titulo || ""),
          texto_topico: String(declaracaoRaw.texto_topico || ""),
          linhas_checkbox: declaracaoParsed.linhas_checkbox,
          ordem_blocos: declaracaoParsed.ordem_blocos,
          created_at: declaracaoRaw.created_at,
          updated_at: declaracaoRaw.updated_at,
        }
      : null;

  return {
    id: raw.id,
    procedimento_id: raw.procedimento_id,
    titulo: String(raw.titulo || ""),
    ativo: Boolean(raw.ativo),
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    procedimento: procedimentoRaw
      ? {
          id: procedimentoRaw.id,
          procedimento: String(procedimentoRaw.procedimento || ""),
        }
      : undefined,
    topicos,
    declaracao,
  };
}

async function fetchTermoModeloById(
  supabase: NonNullable<
    Extract<Awaited<ReturnType<typeof requireProfissionalAccess>>, { authorized: true }>["supabase"]
  >,
  modeloId: string
): Promise<TermoModelo | null> {
  const { data, error } = await supabase
    .from("termos_modelos")
    .select(
      `
      id,
      procedimento_id,
      titulo,
      ativo,
      created_at,
      updated_at,
      procedimento:procedimentos ( id, procedimento ),
      topicos:termos_topicos ( id, modelo_id, ordem, titulo, texto_topico, linhas_checkbox, created_at, updated_at ),
      declaracao:termos_declaracao ( * )
    `
    )
    .eq("id", modeloId)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeTermoModelo(data);
}

function revalidateTermosPaths(pacienteId?: string) {
  try {
    revalidatePath("/clinical");
    revalidatePath("/patients");
    revalidatePath("/dashboard");
    if (pacienteId) {
      revalidatePath(`/pacientes/${pacienteId}`);
    }
  } catch {
    // Revalidação segura fora de contexto de rota
  }
}

/**
 * 1. getTermosModelos
 * Retorna modelos ativos com join em procedimentos, tópicos ordenados e declaração,
 * além da lista de procedimentos para o dropdown.
 */
export async function getTermosModelos(): Promise<
  TermoActionResult<{
    modelos: TermoModelo[];
    procedimentos: TermoProcedimento[];
  }>
> {
  try {
    const auth = await requireProfissionalAccess();
    if (!auth.authorized) {
      return {
        success: false,
        error: auth.message,
        message: auth.message,
      };
    }

    const supabase = auth.supabase;

    const [modelosResult, procedimentosResult] = await Promise.all([
      supabase
        .from("termos_modelos")
        .select(
          `
          id,
          procedimento_id,
          titulo,
          ativo,
          created_at,
          updated_at,
          procedimento:procedimentos ( id, procedimento ),
          topicos:termos_topicos ( id, modelo_id, ordem, titulo, texto_topico, linhas_checkbox, created_at, updated_at ),
          declaracao:termos_declaracao ( * )
        `
        )
        .eq("ativo", true)
        .order("titulo", { ascending: true }),
      supabase
        .from("procedimentos")
        .select("id, procedimento")
        .order("procedimento", { ascending: true }),
    ]);

    if (modelosResult.error) {
      return {
        success: false,
        error: modelosResult.error.message || "Erro ao consultar modelos de termos.",
      };
    }

    if (procedimentosResult.error) {
      return {
        success: false,
        error: procedimentosResult.error.message || "Erro ao consultar procedimentos.",
      };
    }

    const modelos = (modelosResult.data || []).map(normalizeTermoModelo);
    const procedimentos: TermoProcedimento[] = (procedimentosResult.data || []).map(
      (p: any) => ({
        id: p.id,
        procedimento: String(p.procedimento || ""),
      })
    );

    return {
      success: true,
      data: {
        modelos,
        procedimentos,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro inesperado ao carregar modelos de termos.";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * 2. saveTermoModelo
 * Cria ou atualiza um modelo de termo de consentimento (termos_modelos, termos_topicos e termos_declaracao).
 */
export async function saveTermoModelo(
  input: TermoModeloInput
): Promise<TermoActionResult<TermoModelo>> {
  try {
    const auth = await requireProfissionalAccess();
    if (!auth.authorized) {
      return {
        success: false,
        error: auth.message,
        message: auth.message,
      };
    }

    const parsed = termoModeloSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error:
          parsed.error.issues[0]?.message ||
          "Dados inválidos para o modelo de termo de consentimento.",
      };
    }

    const validData = parsed.data;
    const supabase = auth.supabase;

    const { data: procedimento, error: procError } = await supabase
      .from("procedimentos")
      .select("id, procedimento")
      .eq("id", validData.procedimento_id)
      .maybeSingle();

    if (procError || !procedimento) {
      return {
        success: false,
        error: "Procedimento selecionado não encontrado.",
      };
    }

    const tituloFinal =
      validData.titulo?.trim() ||
      `Termo de Consentimento — ${procedimento.procedimento}`;
    const nowIso = new Date().toISOString();

    let modeloId = validData.id;

    if (modeloId) {
      const { data: updatedModelo, error: updateErr } = await supabase
        .from("termos_modelos")
        .update({
          procedimento_id: validData.procedimento_id,
          titulo: tituloFinal,
          updated_at: nowIso,
        })
        .eq("id", modeloId)
        .select("id")
        .maybeSingle();

      if (updateErr || !updatedModelo) {
        return {
          success: false,
          error: updateErr?.message || "Modelo de termo não encontrado para atualização.",
        };
      }

      const { error: deleteTopicosErr } = await supabase
        .from("termos_topicos")
        .delete()
        .eq("modelo_id", modeloId);

      if (deleteTopicosErr) {
        return {
          success: false,
          error: deleteTopicosErr.message || "Erro ao substituir tópicos do modelo.",
        };
      }

      const topicosRows = validData.topicos.map((topico, idx) => ({
        modelo_id: modeloId,
        ordem: idx + 1,
        titulo: topico.titulo,
        texto_topico: topico.texto_topico,
        linhas_checkbox: topico.linhas_checkbox,
        created_at: nowIso,
        updated_at: nowIso,
      }));

      const { error: insertTopicosErr } = await supabase
        .from("termos_topicos")
        .insert(topicosRows);

      if (insertTopicosErr) {
        return {
          success: false,
          error: insertTopicosErr.message || "Erro ao gravar tópicos do modelo.",
        };
      }

      const ordemBlocos = normalizeDeclaracaoOrdem(
        validData.declaracao.ordem_blocos
      );
      const declBasePayload = {
        modelo_id: modeloId,
        titulo: validData.declaracao.titulo,
        texto_topico: validData.declaracao.texto_topico ?? "",
        linhas_checkbox: validData.declaracao.linhas_checkbox,
        updated_at: nowIso,
      };

      let { error: upsertDeclErr } = await supabase
        .from("termos_declaracao")
        .upsert(
          {
            ...declBasePayload,
            ordem_blocos: ordemBlocos,
          },
          { onConflict: "modelo_id" }
        );

      if (isMissingOrdemBlocosColumnError(upsertDeclErr)) {
        const retry = await supabase.from("termos_declaracao").upsert(
          {
            ...declBasePayload,
            linhas_checkbox: encodeDeclaracaoLinhasWithOrdemFallback(
              validData.declaracao.linhas_checkbox,
              ordemBlocos
            ),
          },
          { onConflict: "modelo_id" }
        );
        upsertDeclErr = retry.error;
      }

      if (upsertDeclErr) {
        return {
          success: false,
          error: upsertDeclErr.message || "Erro ao salvar declaração do modelo.",
        };
      }
    } else {
      const { data: insertedModelo, error: insertModErr } = await supabase
        .from("termos_modelos")
        .insert({
          procedimento_id: validData.procedimento_id,
          titulo: tituloFinal,
          ativo: true,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("id")
        .single();

      if (insertModErr || !insertedModelo) {
        return {
          success: false,
          error: insertModErr?.message || "Erro ao criar modelo de termo.",
        };
      }

      modeloId = insertedModelo.id;

      const topicosRows = validData.topicos.map((topico, idx) => ({
        modelo_id: modeloId,
        ordem: idx + 1,
        titulo: topico.titulo,
        texto_topico: topico.texto_topico,
        linhas_checkbox: topico.linhas_checkbox,
        created_at: nowIso,
        updated_at: nowIso,
      }));

      const { error: insertTopicosErr } = await supabase
        .from("termos_topicos")
        .insert(topicosRows);

      if (insertTopicosErr) {
        return {
          success: false,
          error: insertTopicosErr.message || "Erro ao gravar tópicos do novo modelo.",
        };
      }

      const ordemBlocos = normalizeDeclaracaoOrdem(
        validData.declaracao.ordem_blocos
      );
      const declInsertBase = {
        modelo_id: modeloId,
        titulo: validData.declaracao.titulo,
        texto_topico: validData.declaracao.texto_topico ?? "",
        linhas_checkbox: validData.declaracao.linhas_checkbox,
        created_at: nowIso,
        updated_at: nowIso,
      };

      let { error: insertDeclErr } = await supabase
        .from("termos_declaracao")
        .insert({
          ...declInsertBase,
          ordem_blocos: ordemBlocos,
        });

      if (isMissingOrdemBlocosColumnError(insertDeclErr)) {
        const retry = await supabase.from("termos_declaracao").insert({
          ...declInsertBase,
          linhas_checkbox: encodeDeclaracaoLinhasWithOrdemFallback(
            validData.declaracao.linhas_checkbox,
            ordemBlocos
          ),
        });
        insertDeclErr = retry.error;
      }

      if (insertDeclErr) {
        return {
          success: false,
          error: insertDeclErr.message || "Erro ao gravar declaração do novo modelo.",
        };
      }
    }

    if (!modeloId) {
      return {
        success: false,
        error: "Não foi possível identificar o modelo salvo.",
      };
    }

    const modeloCompleto = await fetchTermoModeloById(supabase, modeloId);
    if (!modeloCompleto) {
      return {
        success: false,
        error: "Modelo salvo, mas não foi possível recarregar os dados completos.",
      };
    }

    revalidateTermosPaths();

    return {
      success: true,
      data: modeloCompleto,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro inesperado ao salvar modelo de termo.";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * 3. getTermosByPaciente
 * Retorna lista de termos de consentimento do paciente ordenada por data DESC, created_at DESC.
 */
export async function getTermosByPaciente(
  pacienteId: string
): Promise<TermoActionResult<TermoConsentimento[]>> {
  try {
    if (!uuidSchema.safeParse(pacienteId).success) {
      return {
        success: false,
        error: "Identificador do paciente inválido.",
      };
    }

    const auth = await requireProfissionalAccess();
    if (!auth.authorized) {
      return {
        success: false,
        error: auth.message,
        message: auth.message,
      };
    }

    const supabase = auth.supabase;

    const [
      { data: paciente, error: pacError },
      { data, error },
    ] = await Promise.all([
      supabase
        .from("pacientes")
        .select("id")
        .eq("id", pacienteId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("termos")
        .select(
          "id, paciente_id, modelo_id, procedimento_nome, data, conteudo_snapshot, assinado, origem_pdf, pdf_path, assinado_em, profissional, created_at, updated_at"
        )
        .eq("paciente_id", pacienteId)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    if (pacError || !paciente) {
      return {
        success: false,
        error: "Paciente não encontrado ou inativo.",
      };
    }

    if (error) {
      return {
        success: false,
        error: error.message || "Erro ao consultar termos do paciente.",
      };
    }

    return {
      success: true,
      data: (data || []) as TermoConsentimento[],
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro inesperado ao consultar termos do paciente.";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Cria um registro de termo gerado a partir de um modelo e snapshot (origem_pdf = 'gerado').
 */
export async function createTermoConsentimento(
  input: CriarTermoInput
): Promise<TermoActionResult<TermoConsentimento>> {
  try {
    const auth = await requireProfissionalAccess();
    if (!auth.authorized) {
      return {
        success: false,
        error: auth.message,
        message: auth.message,
      };
    }

    const parsed = criarTermoSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Dados inválidos para criação do termo.",
      };
    }

    const validData = parsed.data;
    const supabase = auth.supabase;

    const { data: paciente, error: pacError } = await supabase
      .from("pacientes")
      .select("id")
      .eq("id", validData.paciente_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (pacError || !paciente) {
      return {
        success: false,
        error: "Paciente não encontrado ou inativo.",
      };
    }

    const dataFinal = validData.data || getTodaySaoPaulo();
    const nowIso = new Date().toISOString();

    const { data: inserted, error: insertErr } = await supabase
      .from("termos")
      .insert({
        paciente_id: validData.paciente_id,
        modelo_id: validData.modelo_id,
        procedimento_nome: validData.procedimento_nome,
        data: dataFinal,
        conteudo_snapshot: validData.conteudo_snapshot,
        assinado: false,
        origem_pdf: "gerado",
        pdf_path: null,
        assinado_em: null,
        profissional: DEFAULT_PROFISSIONAL,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("*")
      .single();

    if (insertErr || !inserted) {
      return {
        success: false,
        error: insertErr?.message || "Erro ao registrar termo de consentimento.",
      };
    }

    revalidateTermosPaths(validData.paciente_id);

    return {
      success: true,
      data: inserted as TermoConsentimento,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro inesperado ao registrar termo de consentimento.";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * 4. uploadTermoAssinadoAction
 * Valida arquivo PDF (máx 1MB, header %PDF-), faz upload no bucket privado `termos-consentimento`
 * em `{paciente_id}/{termo_id}.pdf` e insere registro em `termos` com assinado = true.
 */
export async function uploadTermoAssinadoAction(
  formData: FormData
): Promise<TermoActionResult<TermoConsentimento>> {
  try {
    const auth = await requireProfissionalAccess();
    if (!auth.authorized) {
      return {
        success: false,
        error: auth.message,
        message: auth.message,
      };
    }

    const supabase = auth.supabase;

    const fileEntry = formData.get("file");
    const snapshotRaw = formData.get("conteudo_snapshot");
    const assinaturaApenasNoPdfRaw = String(
      formData.get("assinatura_apenas_no_pdf") || ""
    )
      .trim()
      .toLowerCase();

    const parsedMeta = uploadTermoAssinadoSchema.safeParse({
      paciente_id: String(formData.get("paciente_id") || "").trim(),
      modelo_id: String(formData.get("modelo_id") || "").trim(),
      procedimento_nome: String(formData.get("procedimento_nome") || "").trim(),
      data: String(formData.get("data") || "").trim(),
      profissional: String(formData.get("profissional") || "").trim(),
      assinatura_apenas_no_pdf:
        assinaturaApenasNoPdfRaw === "true" || assinaturaApenasNoPdfRaw === "1",
      origem_pdf: "upload",
    });

    if (!parsedMeta.success) {
      return {
        success: false,
        error:
          parsedMeta.error.issues[0]?.message ||
          "Dados inválidos para registro do termo assinado.",
      };
    }

    const {
      paciente_id: pacienteId,
      modelo_id: modeloId,
      procedimento_nome: procedimentoNomeRaw,
      data: dataInformed,
      profissional: profissionalRaw,
      assinatura_apenas_no_pdf: assinaturaApenasNoPdf,
    } = parsedMeta.data;

    if (!fileEntry || !(fileEntry instanceof File)) {
      return {
        success: false,
        error: "Selecione um arquivo PDF válido.",
      };
    }

    if (fileEntry.size <= 0) {
      return {
        success: false,
        error: "O arquivo PDF enviado está vazio.",
      };
    }

    if (fileEntry.size > MAX_TERMO_PDF_BYTES) {
      const sizeInMb = (
        Math.ceil((fileEntry.size / (1024 * 1024)) * 100) / 100
      )
        .toFixed(2)
        .replace(".", ",");
      return {
        success: false,
        error: `O arquivo selecionado possui ${sizeInMb} MB e excede o limite máximo de 1 MB. Reduza ou comprima o PDF antes de anexá-lo.`,
      };
    }

    const arrayBuffer = await fileEntry.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (!isPdfBuffer(bytes)) {
      return {
        success: false,
        error: "Arquivo inválido. Envie um documento PDF legítimo (assinatura %PDF- ausente).",
      };
    }

    const { data: paciente, error: pacError } = await supabase
      .from("pacientes")
      .select("id")
      .eq("id", pacienteId)
      .is("deleted_at", null)
      .maybeSingle();

    if (pacError || !paciente) {
      return {
        success: false,
        error: "Paciente não encontrado ou inativo.",
      };
    }

    let procedimentoNomeFinal = procedimentoNomeRaw;
    if (!procedimentoNomeFinal && modeloId) {
      const { data: modeloInfo } = await supabase
        .from("termos_modelos")
        .select("titulo, procedimento:procedimentos ( procedimento )")
        .eq("id", modeloId)
        .maybeSingle();

      const procObj = Array.isArray((modeloInfo as any)?.procedimento)
        ? (modeloInfo as any).procedimento[0]
        : (modeloInfo as any)?.procedimento;
      procedimentoNomeFinal =
        procObj?.procedimento || (modeloInfo as any)?.titulo || "";
    }

    if (!procedimentoNomeFinal) {
      return {
        success: false,
        error: "Informe o nome do procedimento referente ao termo assinado.",
      };
    }

    const todaySaoPaulo = getTodaySaoPaulo();
    const dataFinal = dataInformed || todaySaoPaulo;

    let conteudoSnapshot: TermoSnapshot | null = null;
    if (
      !assinaturaApenasNoPdf &&
      typeof snapshotRaw === "string" &&
      snapshotRaw.trim()
    ) {
      try {
        const parsedJson = JSON.parse(snapshotRaw);
        const validatedSnapshot = termoSnapshotSchema.safeParse(parsedJson);
        if (!validatedSnapshot.success) {
          return {
            success: false,
            error:
              validatedSnapshot.error.issues[0]?.message ||
              "Snapshot do conteúdo do termo inválido.",
          };
        }
        conteudoSnapshot = validatedSnapshot.data;
      } catch {
        return {
          success: false,
          error: "Formato JSON inválido para conteudo_snapshot.",
        };
      }
    }

    const termoId = randomUUID();
    const pdfPath = `${pacienteId}/${termoId}.pdf`;
    const nowIso = new Date().toISOString();
    // Em termos antigos ou com data retroativa cuja assinatura consta apenas no PDF anexado,
    // mantemos assinado = true com a data histórica em `data` e sem carimbo digital atual em `assinado_em`.
    const assinadoEmFinal =
      assinaturaApenasNoPdf || dataFinal !== todaySaoPaulo ? null : nowIso;

    const { error: uploadError } = await supabase.storage
      .from(TERMOS_BUCKET)
      .upload(pdfPath, Buffer.from(bytes), {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      return {
        success: false,
        error: uploadError.message || "Falha ao enviar o PDF assinado para o armazenamento.",
      };
    }

    const profissionalFinal = profissionalRaw || DEFAULT_PROFISSIONAL;

    const { data: insertedTermo, error: insertError } = await supabase
      .from("termos")
      .insert({
        id: termoId,
        paciente_id: pacienteId,
        modelo_id: modeloId,
        procedimento_nome: procedimentoNomeFinal,
        data: dataFinal,
        conteudo_snapshot:
          conteudoSnapshot ?? ({} as unknown as TermoSnapshot),
        assinado: true,
        origem_pdf: "upload",
        pdf_path: pdfPath,
        assinado_em: assinadoEmFinal,
        profissional: profissionalFinal,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("*")
      .single();

    if (insertError || !insertedTermo) {
      await supabase.storage.from(TERMOS_BUCKET).remove([pdfPath]);
      return {
        success: false,
        error: insertError?.message || "Erro ao registrar termo assinado no banco de dados.",
      };
    }

    revalidateTermosPaths(pacienteId);

    return {
      success: true,
      data: insertedTermo as TermoConsentimento,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro inesperado ao enviar termo assinado.";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * 5. getTermoPdfSignedUrl
 * Busca o pdf_path do termo e gera Signed URL temporária (300s) do bucket `termos-consentimento`.
 */
export async function getTermoPdfSignedUrl(
  termoId: string
): Promise<TermoActionResult<{ signedUrl: string }>> {
  try {
    if (!uuidSchema.safeParse(termoId).success) {
      return {
        success: false,
        error: "Identificador do termo inválido.",
      };
    }

    const auth = await requireProfissionalAccess();
    if (!auth.authorized) {
      return {
        success: false,
        error: auth.message,
        message: auth.message,
      };
    }

    const supabase = auth.supabase;

    const { data: termo, error: termoError } = await supabase
      .from("termos")
      .select("id, pdf_path")
      .eq("id", termoId)
      .maybeSingle();

    if (termoError || !termo) {
      return {
        success: false,
        error: "Termo de consentimento não encontrado.",
      };
    }

    if (!termo.pdf_path) {
      return {
        success: false,
        error: "Este termo não possui arquivo PDF vinculado.",
      };
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from(TERMOS_BUCKET)
      .createSignedUrl(termo.pdf_path, SIGNED_URL_EXPIRES_IN);

    if (signedError || !signedData?.signedUrl) {
      return {
        success: false,
        error: signedError?.message || "Não foi possível gerar a URL temporária do PDF.",
      };
    }

    return {
      success: true,
      data: {
        signedUrl: signedData.signedUrl,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro inesperado ao gerar URL do PDF do termo.";
    return {
      success: false,
      error: message,
    };
  }
}
