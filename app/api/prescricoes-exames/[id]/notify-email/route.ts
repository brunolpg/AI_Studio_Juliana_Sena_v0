import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildExamNotificationMessage,
  buildExamPrescriptionPdf,
  examPrescriptionPdfFileName,
} from "@/lib/prescricoes-exames/pdf";
import type { GrupoExameItem, PrescricaoExame, PrescricaoExameStatus } from "@/types/prescricao-exame";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: prescricaoId } = await params;
    const body = await request.json().catch(() => ({}));

    if (!prescricaoId) {
      return NextResponse.json(
        { success: false, message: "ID da solicitação de exames não informado." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, message: "Cliente administrativo do Supabase não configurado." },
        { status: 500 }
      );
    }

    const { data: prescRow, error: prescError } = await supabase
      .from("prescricoes_exames")
      .select(`
        id,
        paciente_id,
        titulo,
        data,
        descricao,
        grupos_exames,
        orientacoes,
        status,
        justificativa_suspensao,
        data_suspensao,
        profissional,
        payload_canonico,
        payload_hash,
        assinatura,
        algoritmo,
        assinado_em,
        created_at,
        updated_at,
        pacientes (
          id,
          nome,
          email,
          cpf,
          idade,
          status
        )
      `)
      .eq("id", prescricaoId)
      .maybeSingle();

    if (prescError) {
      console.error("[prescricoes-exames/notify-email] Erro ao buscar solicitação:", prescError);
      return NextResponse.json(
        { success: false, message: "Erro ao consultar a solicitação de exames no banco de dados." },
        { status: 500 }
      );
    }

    if (!prescRow) {
      return NextResponse.json(
        { success: false, message: "Solicitação de exames não encontrada." },
        { status: 404 }
      );
    }

    let pacienteRow: {
      id?: string;
      nome?: string;
      email?: string;
      cpf?: string;
      idade?: number | string;
      status?: string;
    } | null = Array.isArray(prescRow.pacientes)
      ? prescRow.pacientes[0] || null
      : (prescRow.pacientes as any) || null;

    if (!pacienteRow && prescRow.paciente_id) {
      const { data: fallbackPaciente } = await supabase
        .from("pacientes")
        .select("id, nome, email, cpf, idade, status")
        .eq("id", prescRow.paciente_id)
        .is("deleted_at", null)
        .maybeSingle();
      if (fallbackPaciente) {
        pacienteRow = fallbackPaciente;
      }
    }

    const patientEmail: string = (body?.patientEmail || pacienteRow?.email || "").trim();
    const patientName: string = (pacienteRow?.nome || body?.patientName || "Paciente").trim();

    if (!patientEmail) {
      return NextResponse.json(
        { success: false, message: "E-mail do paciente não informado ou não cadastrado." },
        { status: 400 }
      );
    }

    const gruposExames: GrupoExameItem[] = Array.isArray(prescRow.grupos_exames)
      ? (prescRow.grupos_exames as GrupoExameItem[])
      : [];
    const orientacoes: string[] = Array.isArray(prescRow.orientacoes)
      ? (prescRow.orientacoes as string[])
      : [];

    const prescricao: PrescricaoExame = {
      id: prescRow.id,
      paciente_id: prescRow.paciente_id,
      titulo: prescRow.titulo || "Solicitação de Exames Laboratoriais",
      data: prescRow.data,
      descricao: prescRow.descricao ?? null,
      grupos_exames: gruposExames,
      orientacoes,
      status: (prescRow.status || "Ativo") as PrescricaoExameStatus,
      justificativa_suspensao: prescRow.justificativa_suspensao ?? null,
      data_suspensao: prescRow.data_suspensao ?? null,
      profissional: prescRow.profissional || "Dra. Juliana Sena",
      payload_canonico: prescRow.payload_canonico ?? null,
      payload_hash: prescRow.payload_hash ?? null,
      assinatura: prescRow.assinatura ?? null,
      algoritmo: prescRow.algoritmo || "SHA-256",
      assinado_em: prescRow.assinado_em ?? null,
      created_at: prescRow.created_at,
      updated_at: prescRow.updated_at,
      paciente: pacienteRow
        ? {
            id: pacienteRow.id || prescRow.paciente_id,
            nome: patientName,
            cpf: pacienteRow.cpf,
            email: patientEmail,
          }
        : undefined,
    };

    const pdfBytes = await buildExamPrescriptionPdf(prescricao, {
      nome: patientName,
      cpf: pacienteRow?.cpf,
      idade: pacienteRow?.idade,
      status: pacienteRow?.status,
    });
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
    const fileName = examPrescriptionPdfFileName(patientName, prescricao.data);

    const notificationMessage = buildExamNotificationMessage(
      patientName,
      prescricao.titulo,
      prescricao.data
    );
    const formattedDate = formatDateBR(prescricao.data);
    const totalExames = gruposExames.reduce(
      (acc, grp) => acc + (Array.isArray(grp.exames) ? grp.exames.length : 0),
      0
    );

    const htmlContent = `
      <div style="font-family: 'Plus Jakarta Sans', Arial, -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px 24px; border: 1px solid #e2e8f0; border-radius: 20px; color: #1e293b; background-color: #ffffff;">
        <div style="margin-bottom: 20px; text-align: left;">
          <h2 style="color: #004d40; margin: 0 0 4px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Dra. Juliana Sena</h2>
          <p style="font-size: 13px; color: #64748b; margin: 0; font-weight: 500;">Biomedicina Estética &amp; Práticas Integrativas em Saúde • COREN-BA 366.344</p>
        </div>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 18px 0;" />

        <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 18px 0;">
          ${escapeHtml(notificationMessage)}
        </p>

        <div style="margin: 20px 0; padding: 18px; background-color: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 16px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #0f766e;">
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Solicitação:</td>
              <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #004d40;">${escapeHtml(prescricao.titulo)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Data de Emissão:</td>
              <td style="padding: 4px 0; text-align: right; color: #475569;">${escapeHtml(formattedDate)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Painel Solicitado:</td>
              <td style="padding: 4px 0; text-align: right; color: #475569;">${gruposExames.length} grupo(s) • ${totalExames} exame(s)</td>
            </tr>
            ${
              prescricao.payload_hash
                ? `
            <tr>
              <td colspan="2" style="padding-top: 10px;">
                <div style="padding: 10px 12px; background-color: #ffffff; border: 1px solid #ccfbf1; border-radius: 10px; font-family: monospace; font-size: 11px; color: #475569; word-break: break-all;">
                  <strong style="color: #004d40;">Hash de Integridade (${escapeHtml(prescricao.algoritmo || "SHA-256")}):</strong><br />
                  ${escapeHtml(prescricao.payload_hash)}
                </div>
              </td>
            </tr>
            `
                : ""
            }
          </table>
        </div>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 18px 0;" />

        <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
          Atenciosamente,<br />
          <strong style="color: #475569;">Dra. Juliana Sena</strong><br />
          Biomedicina Estética &amp; Práticas Integrativas em Saúde • Salvador - BA
        </p>
      </div>
    `;

    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || "Dra. Juliana Sena <nao-responda@julianasena.com.br>";

    if (!resendApiKey) {
      console.warn("[prescricoes-exames/notify-email] RESEND_API_KEY não configurada.");
      return NextResponse.json({
        success: true,
        mocked: true,
        message: "RESEND_API_KEY não configurada.",
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
        to: [patientEmail],
        subject: `Solicitação de Exames Laboratoriais - ${prescricao.titulo}`,
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
      console.warn("[prescricoes-exames/notify-email] Falha ao enviar e-mail via Resend:", errText);
      return NextResponse.json(
        { success: false, error: errText || "Falha ao enviar e-mail pelo provedor Resend." },
        { status: 502 }
      );
    }

    const resendData = await resendRes.json().catch(() => ({}));

    return NextResponse.json({
      success: true,
      message: "Solicitação de exames enviada em PDF para o e-mail do paciente com sucesso.",
      data: resendData,
      recipient: patientEmail,
      filename: fileName,
    });
  } catch (error: any) {
    console.error("[prescricoes-exames/notify-email] Erro interno:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Falha interna ao processar envio de e-mail." },
      { status: 500 }
    );
  }
}
