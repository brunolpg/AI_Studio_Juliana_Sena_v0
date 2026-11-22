import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProfissionalAccess } from "@/lib/auth/session";
import { sendEmailViaGmail } from "@/lib/google-gmail/gmail-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TERMOS_BUCKET = "termos-consentimento";

const uuidSchema = z.string().uuid("Identificador do termo inválido.");

const notifyEmailBodySchema = z.object({
  patientEmail: z.string().trim().email("E-mail do paciente inválido.").optional(),
  patientName: z.string().trim().max(200).optional(),
});

const emailSchema = z.string().trim().email("Endereço de e-mail inválido.");

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

function isTrustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (request.headers.get("x-requested-with")) return true;

  try {
    const originHost = new URL(origin).host.toLowerCase();
    const forwardedHost = (request.headers.get("x-forwarded-host") || "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    const host = (request.headers.get("host") || "").trim().toLowerCase();
    return Boolean(
      (forwardedHost && originHost === forwardedHost) ||
        (host && originHost === host)
    );
  } catch {
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const clean = String(dateStr).trim().split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
  }
  return clean;
}

function formatDateTimeSaoPaulo(isoStr?: string | null): string {
  if (!isoStr) return "—";
  const parsed = new Date(isoStr);
  if (Number.isNaN(parsed.getTime())) return isoStr;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function sanitizePatientPdfFileName(patientName?: string | null): string {
  const sanitized = (patientName || "Paciente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return `Termo_Consentimento_${sanitized || "Paciente"}.pdf`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isTrustedOrigin(request)) {
      return jsonResponse(
        { success: false, message: "Origem da requisição não autorizada." },
        403
      );
    }

    const auth = await requireProfissionalAccess();
    if (!auth.authorized) {
      const status = auth.message.toLowerCase().includes("não autenticado")
        ? 401
        : 403;
      return jsonResponse({ success: false, message: auth.message }, status);
    }

    const { id: termoId } = await params;
    if (!uuidSchema.safeParse(termoId).success) {
      return jsonResponse(
        { success: false, message: "Identificador do termo inválido." },
        400
      );
    }

    const rawBody = await request.json().catch(() => ({}));
    const parsedBody = notifyEmailBodySchema.safeParse(rawBody);
    const bodyData = parsedBody.success ? parsedBody.data : {};

    const supabase = auth.supabase;

    const { data: termo, error: termoError } = await supabase
      .from("termos")
      .select(
        "id, paciente_id, procedimento_nome, data, assinado, assinado_em, pdf_path, profissional"
      )
      .eq("id", termoId)
      .maybeSingle();

    if (termoError) {
      return jsonResponse(
        {
          success: false,
          message: "Erro ao consultar o termo de consentimento no banco de dados.",
        },
        500
      );
    }

    if (!termo) {
      return jsonResponse(
        { success: false, message: "Termo de consentimento não encontrado." },
        404
      );
    }

    if (!termo.pdf_path) {
      return jsonResponse(
        {
          success: false,
          message: "Este termo não possui arquivo PDF vinculado para envio.",
        },
        400
      );
    }

    const { data: paciente, error: pacError } = await supabase
      .from("pacientes")
      .select("id, nome, email")
      .eq("id", termo.paciente_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (pacError || !paciente) {
      return jsonResponse(
        { success: false, message: "Paciente não encontrado ou inativo." },
        404
      );
    }

    const recipientEmail = (paciente.email || bodyData.patientEmail || "").trim();
    if (!recipientEmail || !emailSchema.safeParse(recipientEmail).success) {
      return jsonResponse(
        {
          success: false,
          message: "E-mail do paciente não cadastrado ou inválido.",
        },
        400
      );
    }

    const { data: pdfBlob, error: downloadError } = await supabase.storage
      .from(TERMOS_BUCKET)
      .download(termo.pdf_path);

    if (downloadError || !pdfBlob) {
      return jsonResponse(
        {
          success: false,
          message: "Não foi possível obter o arquivo PDF do termo no armazenamento.",
        },
        502
      );
    }

    const pdfArrayBuffer = await pdfBlob.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfArrayBuffer).toString("base64");

    const patientName = (paciente.nome || bodyData.patientName || "Paciente").trim();
    const procedimentoNome = String(
      termo.procedimento_nome || "Procedimento Clínico"
    ).trim();
    const profissionalNome = String(
      termo.profissional || "Dra. Juliana Sena"
    ).trim();
    const dataLabel = termo.assinado_em
      ? formatDateTimeSaoPaulo(termo.assinado_em)
      : formatDateBR(termo.data);
    const statusLabel = termo.assinado ? "Assinado" : "Pendente";
    const fileName = sanitizePatientPdfFileName(patientName);

    const htmlContent = `
      <div style="font-family: 'Plus Jakarta Sans', Arial, -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px 24px; border: 1px solid #e2e8f0; border-radius: 20px; color: #1e293b; background-color: #ffffff;">
        <div style="margin-bottom: 20px; text-align: left;">
          <h2 style="color: #004d40; margin: 0 0 4px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Dra. Juliana Sena</h2>
          <p style="font-size: 13px; color: #64748b; margin: 0; font-weight: 500;">Enfermeira Esteta • COREN-BA 366.344</p>
        </div>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 18px 0;" />

        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Olá, <strong>${escapeHtml(patientName)}</strong>!</p>

        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
          Segue em anexo a cópia oficial em PDF do seu <strong>Termo de Consentimento</strong> referente ao procedimento <strong>${escapeHtml(procedimentoNome)}</strong>.
        </p>

        <div style="margin: 20px 0; padding: 18px; background-color: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 16px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #0f766e;">
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Procedimento:</td>
              <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #004d40;">${escapeHtml(procedimentoNome)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Status:</td>
              <td style="padding: 4px 0; text-align: right; color: #059669; font-weight: 700;">${escapeHtml(statusLabel)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Data / Assinatura:</td>
              <td style="padding: 4px 0; text-align: right; color: #475569;">${escapeHtml(dataLabel)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Profissional:</td>
              <td style="padding: 4px 0; text-align: right; color: #475569;">${escapeHtml(profissionalNome)}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
          O documento em formato <strong>PDF</strong> segue anexado a esta mensagem para sua guarda e consulta.
        </p>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 18px 0;" />

        <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
          Atenciosamente,<br />
          <strong style="color: #475569;">Dra. Juliana Sena</strong><br />
          Estética Avançada e Regenerativa • Salvador - BA
        </p>
      </div>
    `;

    const gmailResult = await sendEmailViaGmail({
      to: recipientEmail,
      subject: `Termo de Consentimento - ${procedimentoNome}`,
      html: htmlContent,
      attachments: [
        {
          filename: fileName,
          content: pdfBase64,
          contentType: "application/pdf",
        },
      ],
    });

    if (!gmailResult.success) {
      return jsonResponse(
        {
          success: false,
          code: gmailResult.code,
          ...(gmailResult.authUrl ? { authUrl: gmailResult.authUrl } : {}),
          message: gmailResult.error,
          error: gmailResult.error,
        },
        gmailResult.status
      );
    }

    return jsonResponse({
      success: true,
      message: "Termo de consentimento enviado em PDF para o e-mail do paciente com sucesso.",
      data: {
        id: gmailResult.messageId,
        threadId: gmailResult.threadId,
        sender: gmailResult.sender,
      },
      recipient: recipientEmail,
      filename: fileName,
    });
  } catch (error: unknown) {
    console.error("[termos/notify-email] Erro interno:", error);
    return jsonResponse(
      {
        success: false,
        message: "Falha interna ao processar envio de e-mail do termo.",
      },
      500
    );
  }
}
