import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildPrescriptionPdf,
  prescriptionPdfFileName,
  type PrescriptionPdfInput,
} from "@/lib/prescricoes/pdf";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDatePtBr(dateStr?: string | null): string {
  if (!dateStr) return new Date().toLocaleDateString("pt-BR");
  const clean = String(dateStr).trim().split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? String(dateStr) : parsed.toLocaleDateString("pt-BR");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: prescriptionId } = await params;
    const body = await request.json().catch(() => ({}));

    let patientName = body.patientName as string | undefined;
    let patientEmail = body.patientEmail as string | undefined;
    let formulaName = body.formulaName as string | undefined;
    let pdfUrl = body.pdfUrl as string | undefined;
    let prescriptionDate = (body.prescriptionDate as string | undefined) || new Date().toISOString();
    const isReactivation = Boolean(body.isReactivation);

    let prescData: any = null;

    if (prescriptionId) {
      try {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          const selectFields = `
            id,
            paciente_id,
            pdf_assinado_url,
            data_prescricao,
            observacoes,
            pacientes (
              id,
              nome,
              cpf,
              email
            ),
            prescricao_itens (*)
          `;

          const { data } = await supabase
            .from("prescricoes")
            .select(selectFields)
            .eq("id", prescriptionId)
            .maybeSingle();

          prescData = data;

          // Contingência: se o ID recebido for de prescricao_itens, resolve o prescricao_id pai
          if (!prescData) {
            const { data: itemRef } = await supabase
              .from("prescricao_itens")
              .select("prescricao_id")
              .eq("id", prescriptionId)
              .maybeSingle();

            if (itemRef?.prescricao_id) {
              const { data: parentData } = await supabase
                .from("prescricoes")
                .select(selectFields)
                .eq("id", itemRef.prescricao_id)
                .maybeSingle();
              prescData = parentData;
            }
          }

          if (prescData) {
            const pacienteObj = Array.isArray(prescData.pacientes)
              ? prescData.pacientes[0]
              : prescData.pacientes;

            if (!pdfUrl && prescData.pdf_assinado_url) {
              pdfUrl = prescData.pdf_assinado_url;
            }
            if (!patientEmail && pacienteObj?.email) {
              patientEmail = pacienteObj.email;
            }
            if (!patientName && pacienteObj?.nome) {
              patientName = pacienteObj.nome;
            }
            if (prescData.data_prescricao) {
              prescriptionDate = prescData.data_prescricao;
            }
            if (
              !formulaName &&
              Array.isArray(prescData.prescricao_itens) &&
              prescData.prescricao_itens.length > 0
            ) {
              formulaName = (prescData.prescricao_itens[0] as any)?.nome_formula;
            }
          }
        }
      } catch (dbErr) {
        console.warn("[notify-email] Aviso ao consultar dados complementares no banco:", dbErr);
      }
    }

    if (!patientEmail || !String(patientEmail).trim()) {
      return NextResponse.json(
        { success: false, message: "E-mail do paciente não informado ou não cadastrado." },
        { status: 400 }
      );
    }

    const safeEmail = String(patientEmail).trim();
    const safePatientName = (patientName || "Paciente").trim();
    const safeFormulaName = (formulaName || "Fórmula Magistral").trim();

    const externalSignedUrl =
      typeof pdfUrl === "string" && pdfUrl.startsWith("http") ? pdfUrl : null;
    const isSigned = Boolean(externalSignedUrl);

    // 1. Tenta baixar o PDF assinado externo se disponível
    let pdfBase64: string | null = null;
    if (externalSignedUrl) {
      try {
        const pdfResponse = await fetch(externalSignedUrl);
        if (pdfResponse.ok) {
          const pdfArrayBuffer = await pdfResponse.arrayBuffer();
          pdfBase64 = Buffer.from(pdfArrayBuffer).toString("base64");
        } else {
          console.warn(
            `[notify-email] Aviso: Status ${pdfResponse.status} ao baixar PDF assinado de ${externalSignedUrl}`
          );
        }
      } catch (fetchErr) {
        console.warn("[notify-email] Aviso ao processar download do PDF assinado:", fetchErr);
      }
    }

    // 2. Caso ainda não tenha PDF (receita recém-emitida/reativada ou fallback), gera no servidor
    if (!pdfBase64 && prescData) {
      try {
        const pacienteObj = Array.isArray(prescData.pacientes)
          ? prescData.pacientes[0]
          : prescData.pacientes;
        const item = (
          Array.isArray(prescData.prescricao_itens) && prescData.prescricao_itens.length > 0
            ? prescData.prescricao_itens[0]
            : {}
        ) as PrescriptionPdfInput["item"];

        const pdfBytes = await buildPrescriptionPdf({
          id: prescData.id || prescriptionId,
          dataPrescricao: prescData.data_prescricao || prescriptionDate,
          observacoes: prescData.observacoes,
          paciente: {
            nome: pacienteObj?.nome || safePatientName,
            cpf: pacienteObj?.cpf || null,
          },
          item,
        });
        pdfBase64 = Buffer.from(pdfBytes).toString("base64");
      } catch (pdfErr) {
        console.error("[notify-email] Falha ao gerar PDF da prescrição no servidor:", pdfErr);
      }
    }

    if (!pdfBase64) {
      return NextResponse.json(
        {
          success: false,
          message: "Não foi possível gerar ou localizar o documento PDF da prescrição.",
        },
        { status: 400 }
      );
    }

    const fileName = isSigned
      ? `Receita_Assinada_${safePatientName
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`
      : prescriptionPdfFileName(safePatientName, prescriptionDate);

    const introText = isSigned
      ? `Sua prescrição médica <strong>${escapeHtml(safeFormulaName)}</strong> foi assinada digitalmente com certificado padrão <strong>ICP-Brasil / VIDaaS</strong> e já está vinculada com segurança ao seu histórico clínico.`
      : isReactivation
      ? `Sua prescrição magistral <strong>${escapeHtml(safeFormulaName)}</strong> foi <strong>reativada</strong> pela <strong>Dra. Juliana Sena</strong> e já está disponível novamente no seu tratamento ativo.`
      : `Sua prescrição magistral <strong>${escapeHtml(safeFormulaName)}</strong> foi emitida pela <strong>Dra. Juliana Sena</strong> e já está vinculada ao seu prontuário clínico.`;

    const statusBadgeText = isSigned
      ? "ICP-Brasil Digital (VIDaaS)"
      : isReactivation
      ? "Prescrição Reativada • Ativa"
      : "Receituário Magistral Ativo";

    const emailSubject = isSigned
      ? `Receita Digital Assinada - ${safeFormulaName}`
      : isReactivation
      ? `Receita Reativada - ${safeFormulaName}`
      : `Receituário Magistral - ${safeFormulaName}`;

    const htmlContent = `
      <div style="font-family: 'Plus Jakarta Sans', Arial, -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px 24px; border: 1px solid #e2e8f0; border-radius: 20px; color: #1e293b; background-color: #ffffff;">
        <div style="margin-bottom: 20px; text-align: left;">
          <h2 style="color: #004d40; margin: 0 0 4px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Dra. Juliana Sena</h2>
          <p style="font-size: 13px; color: #64748b; margin: 0; font-weight: 500;">Enfermeira Esteta • COREN-BA 366.344</p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 18px 0;" />
        
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Olá, <strong>${escapeHtml(safePatientName)}</strong>!</p>
        
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
          ${introText}
        </p>
        
        <div style="margin: 20px 0; padding: 18px; background-color: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 16px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #0f766e;">
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Prescrição:</td>
              <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #004d40;">${escapeHtml(safeFormulaName)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Status:</td>
              <td style="padding: 4px 0; text-align: right; color: #059669; font-weight: 700;">${statusBadgeText}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Data do Registro:</td>
              <td style="padding: 4px 0; text-align: right; color: #475569;">${formatDatePtBr(prescriptionDate)}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
          O documento oficial em formato <strong>PDF</strong> segue anexado diretamente a esta mensagem. Você também pode visualizá-lo e baixá-lo a qualquer momento através do seu <strong>Portal do Paciente</strong>.
        </p>

        ${
          externalSignedUrl
            ? `
        <div style="text-align: center; margin: 28px 0;">
          <a href="${externalSignedUrl}" target="_blank" rel="noopener noreferrer" style="background-color: #004d40; color: #ffffff; padding: 12px 24px; border-radius: 9999px; text-decoration: none; font-size: 13px; font-weight: 700; display: inline-block; box-shadow: 0 2px 6px rgba(0,77,64,0.2);">
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

    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom =
      process.env.EMAIL_FROM || "Dra. Juliana Sena <nao-responda@julianasena.com.br>";

    if (!resendApiKey) {
      console.warn(
        "[Resend API] RESEND_API_KEY não configurada no ambiente (Vercel / servidor). " +
          "Configure RESEND_API_KEY (e opcionalmente EMAIL_FROM) no painel de variáveis de ambiente."
      );
      console.log(
        `[E-mail Simulado com Anexo] Para: ${safeEmail} | Paciente: ${safePatientName} | Prescrição: ${safeFormulaName} | Anexo: ${fileName} (${pdfBase64.length} bytes base64)`
      );

      return NextResponse.json({
        success: true,
        mocked: true,
        message:
          "Receita processada. Aviso: RESEND_API_KEY ausente no painel da Vercel para despacho de e-mails em produção.",
        recipient: safeEmail,
      });
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [safeEmail],
        subject: emailSubject,
        html: htmlContent,
        attachments: [
          {
            filename: fileName,
            content: pdfBase64,
          },
        ],
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.warn("[Resend API] Aviso ao enviar e-mail via Resend:", errText);
      return NextResponse.json(
        { success: false, error: errText || "Falha ao enviar e-mail pelo provedor Resend." },
        { status: 502 }
      );
    }

    const resendData = await resendRes.json().catch(() => ({}));

    return NextResponse.json({
      success: true,
      message: "Receita enviada com PDF em anexo para o e-mail do paciente com sucesso.",
      data: resendData,
      recipient: safeEmail,
    });
  } catch (error: any) {
    console.error("[notify-email] Erro ao enviar e-mail da prescrição:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Falha interna ao processar envio de e-mail." },
      { status: 500 }
    );
  }
}
