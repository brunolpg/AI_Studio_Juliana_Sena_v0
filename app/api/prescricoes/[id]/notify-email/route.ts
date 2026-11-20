import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { denyUnlessStaff } from "@/lib/prescricoes/access";
import { buildPrescriptionPdf, type PrescriptionPdfInput } from "@/lib/prescricoes/pdf";
import { sendEmailViaGmail } from "@/lib/google-gmail/gmail-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveAllowedPdfUrl(
  rawUrl: string,
  requestUrl: string
): { allowed: boolean; resolvedUrl: string; isSameOrigin: boolean } {
  const trimmed = rawUrl.trim();
  const reqOriginUrl = new URL(requestUrl);

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return {
      allowed: true,
      resolvedUrl: new URL(trimmed, reqOriginUrl.origin).toString(),
      isSameOrigin: true,
    };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.origin !== reqOriginUrl.origin) {
      return { allowed: false, resolvedUrl: "", isSameOrigin: false };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const allowedHosts = new Set<string>([reqOriginUrl.hostname]);
    if (supabaseUrl) {
      try {
        allowedHosts.add(new URL(supabaseUrl).hostname);
      } catch {
        // ignora URL inválida
      }
    }

    if (!allowedHosts.has(parsed.hostname)) {
      return { allowed: false, resolvedUrl: "", isSameOrigin: false };
    }

    return {
      allowed: true,
      resolvedUrl: parsed.toString(),
      isSameOrigin: parsed.origin === reqOriginUrl.origin,
    };
  } catch {
    return { allowed: false, resolvedUrl: "", isSameOrigin: false };
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await denyUnlessStaff();
    if (denied) return denied;

    const { id: prescriptionId } = await params;
    const body = await request.json().catch(() => ({}));

    let patientName = body.patientName;
    let patientEmail = body.patientEmail;
    let formulaName = body.formulaName;
    let pdfUrl = body.pdfUrl;
    const prescriptionDate = body.prescriptionDate || new Date().toISOString();
    let prescRecordForPdf: any = null;

    // Se algum dado essencial não veio no body, busca no banco via Supabase
    if ((!patientEmail || !pdfUrl || !patientName || !formulaName) && prescriptionId) {
      try {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          const { data: prescData } = await supabase
            .from("prescricoes")
            .select(`
              id,
              paciente_id,
              pdf_assinado_url,
              data_prescricao,
              observacoes,
              pacientes (
                id,
                nome,
                email,
                cpf
              ),
              prescricao_itens (*)
            `)
            .eq("id", prescriptionId)
            .maybeSingle();

          if (prescData) {
            prescRecordForPdf = prescData;
            if (!pdfUrl) pdfUrl = prescData.pdf_assinado_url;
            if (!patientEmail) patientEmail = (prescData.pacientes as any)?.email;
            if (!patientName) patientName = (prescData.pacientes as any)?.nome;
            if (!formulaName && Array.isArray(prescData.prescricao_itens) && prescData.prescricao_itens.length > 0) {
              formulaName = (prescData.prescricao_itens[0] as any)?.nome_formula;
            }
          }
        }
      } catch (dbErr) {
        console.warn("[notify-email] Aviso ao consultar dados complementares no banco:", dbErr);
      }
    }

    if (!patientEmail) {
      return NextResponse.json(
        { success: false, message: "E-mail do paciente não informado ou não cadastrado." },
        { status: 400 }
      );
    }

    if (!pdfUrl && !prescRecordForPdf) {
      return NextResponse.json(
        { success: false, message: "URL do documento PDF assinado não fornecida." },
        { status: 400 }
      );
    }

    // Baixa o PDF assinado (ou gera o PDF oficial da receita em fallback) para inclusão em anexo
    let pdfBase64: string | null = null;
    if (pdfUrl) {
      try {
        const check = resolveAllowedPdfUrl(String(pdfUrl), request.url);
        if (check.allowed) {
          const cookieHeader = request.headers.get("cookie");
          const pdfResponse = await fetch(check.resolvedUrl, {
            headers: check.isSameOrigin && cookieHeader ? { cookie: cookieHeader } : undefined,
          });
          if (pdfResponse.ok) {
            const pdfArrayBuffer = await pdfResponse.arrayBuffer();
            pdfBase64 = Buffer.from(pdfArrayBuffer).toString("base64");
          } else {
            console.warn(`[notify-email] Aviso: Status ${pdfResponse.status} ao baixar PDF de ${check.resolvedUrl}`);
          }
        } else {
          console.warn("[notify-email] URL de PDF fora da lista permitida ignorada.");
        }
      } catch (fetchErr) {
        console.warn("[notify-email] Aviso ao processar download do PDF para anexo:", fetchErr);
      }
    }

    if (!pdfBase64 && prescRecordForPdf) {
      try {
        const pac = Array.isArray(prescRecordForPdf.pacientes)
          ? prescRecordForPdf.pacientes[0]
          : prescRecordForPdf.pacientes;
        const item = (prescRecordForPdf.prescricao_itens?.[0] ?? {}) as PrescriptionPdfInput["item"];
        const generated = await buildPrescriptionPdf({
          id: prescRecordForPdf.id,
          dataPrescricao: prescRecordForPdf.data_prescricao,
          observacoes: prescRecordForPdf.observacoes,
          paciente: { nome: pac?.nome || patientName, cpf: pac?.cpf },
          item,
        });
        pdfBase64 = Buffer.from(generated).toString("base64");
      } catch (genErr) {
        console.warn("[notify-email] Aviso ao gerar PDF fallback da prescrição:", genErr);
      }
    }

    const safePatientName = String(patientName || "Paciente");
    const safeFormulaName = String(formulaName || "Fórmula Magistral");
    const fileName = `Receita_Assinada_${safePatientName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`;

    const safeLinkUrl =
      typeof pdfUrl === "string" && pdfUrl.startsWith("http")
        ? resolveAllowedPdfUrl(pdfUrl, request.url)
        : null;

    const htmlContent = `
      <div style="font-family: 'Plus Jakarta Sans', Arial, -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px 24px; border: 1px solid #e2e8f0; border-radius: 20px; color: #1e293b; background-color: #ffffff;">
        <div style="margin-bottom: 20px; text-align: left;">
          <h2 style="color: #004d40; margin: 0 0 4px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Dra. Juliana Sena</h2>
          <p style="font-size: 13px; color: #64748b; margin: 0; font-weight: 500;">Enfermeira Esteta • COREN-BA 366.344</p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 18px 0;" />
        
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Olá, <strong>${escapeHtml(safePatientName)}</strong>!</p>
        
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
          Sua prescrição médica <strong>${escapeHtml(safeFormulaName)}</strong> foi assinada digitalmente com certificado padrão <strong>ICP-Brasil / VIDaaS</strong> e já está vinculada com segurança ao seu histórico clínico.
        </p>
        
        <div style="margin: 20px 0; padding: 18px; background-color: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 16px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #0f766e;">
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Prescrição:</td>
              <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #004d40;">${escapeHtml(safeFormulaName)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Validação:</td>
              <td style="padding: 4px 0; text-align: right; color: #059669; font-weight: 700;">ICP-Brasil Digital (VIDaaS)</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Data do Registro:</td>
              <td style="padding: 4px 0; text-align: right; color: #475569;">${escapeHtml(new Date(prescriptionDate).toLocaleDateString("pt-BR"))}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
          O documento oficial em formato <strong>PDF assinado</strong> segue anexado diretamente a esta mensagem. Você também pode visualizá-lo e baixá-lo a qualquer momento através do seu <strong>Portal do Paciente</strong>.
        </p>

        ${
          safeLinkUrl?.allowed
            ? `
        <div style="text-align: center; margin: 28px 0;">
          <a href="${escapeHtml(safeLinkUrl.resolvedUrl)}" target="_blank" rel="noopener noreferrer" style="background-color: #004d40; color: #ffffff; padding: 12px 24px; border-radius: 9999px; text-decoration: none; font-size: 13px; font-weight: 700; display: inline-block; box-shadow: 0 2px 6px rgba(0,77,64,0.2);">
            Visualizar Receita Assinada Online
          </a>
        </div>
        `
            : ""
        }

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 18px 0;" />

        <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
          Atenciosamente,<br />
          <strong style="color: #475569;">Dra. Juliana Sena</strong><br />
          Estética Avançada e Regenerativa • Salvador - BA
        </p>
      </div>
    `;

    const attachments = pdfBase64
      ? [
          {
            filename: fileName,
            content: pdfBase64,
            contentType: "application/pdf",
          },
        ]
      : [];

    const gmailResult = await sendEmailViaGmail({
      to: String(patientEmail).trim(),
      subject: `Receita Digital Assinada - ${safeFormulaName}`,
      html: htmlContent,
      attachments,
    });

    if (!gmailResult.success) {
      return NextResponse.json(
        {
          success: false,
          code: gmailResult.code,
          ...(gmailResult.authUrl ? { authUrl: gmailResult.authUrl } : {}),
          message: gmailResult.error,
          error: gmailResult.error,
        },
        { status: gmailResult.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Receita assinada enviada com anexo para o e-mail do paciente com sucesso.",
      data: {
        id: gmailResult.messageId,
        threadId: gmailResult.threadId,
        sender: gmailResult.sender,
      },
      recipient: String(patientEmail).trim(),
    });
  } catch (error: any) {
    console.error("[notify-email] Erro ao enviar e-mail da prescrição:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Falha interna ao processar envio de e-mail." },
      { status: 500 }
    );
  }
}
