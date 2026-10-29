import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: prescriptionId } = await params;
    const body = await request.json().catch(() => ({}));

    let patientName = body.patientName;
    let patientEmail = body.patientEmail;
    let formulaName = body.formulaName;
    let pdfUrl = body.pdfUrl;
    let prescriptionDate = body.prescriptionDate || new Date().toISOString();

    // Se algum dado essencial não veio no body, busca no banco via Supabase
    if ((!patientEmail || !pdfUrl || !patientName || !formulaName) && prescriptionId) {
      try {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          const { data: prescData } = await supabase
            .from("prescricoes")
            .select(`
              id,
              pdf_assinado_url,
              data_prescricao,
              pacientes (
                id,
                nome,
                email
              ),
              prescricao_itens (
                nome_formula
              )
            `)
            .eq("id", prescriptionId)
            .maybeSingle();

          if (prescData) {
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

    if (!pdfUrl) {
      return NextResponse.json(
        { success: false, message: "URL do documento PDF assinado não fornecida." },
        { status: 400 }
      );
    }

    // Baixa o PDF assinado para inclusão em anexo
    let pdfBase64: string | null = null;
    try {
      const fullPdfUrl = pdfUrl.startsWith("http")
        ? pdfUrl
        : new URL(pdfUrl, request.url).toString();

      const pdfResponse = await fetch(fullPdfUrl);
      if (pdfResponse.ok) {
        const pdfArrayBuffer = await pdfResponse.arrayBuffer();
        pdfBase64 = Buffer.from(pdfArrayBuffer).toString("base64");
      } else {
        console.warn(`[notify-email] Aviso: Status ${pdfResponse.status} ao baixar PDF de ${fullPdfUrl}`);
      }
    } catch (fetchErr) {
      console.warn("[notify-email] Aviso ao processar download do PDF para anexo:", fetchErr);
    }

    const safePatientName = patientName || "Paciente";
    const safeFormulaName = formulaName || "Fórmula Magistral";
    const fileName = `Receita_Assinada_${safePatientName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`;

    const htmlContent = `
      <div style="font-family: 'Plus Jakarta Sans', Arial, -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px 24px; border: 1px solid #e2e8f0; border-radius: 20px; color: #1e293b; background-color: #ffffff;">
        <div style="margin-bottom: 20px; text-align: left;">
          <h2 style="color: #004d40; margin: 0 0 4px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Dra. Juliana Sena</h2>
          <p style="font-size: 13px; color: #64748b; margin: 0; font-weight: 500;">Enfermeira Esteta • COREN-BA 366.344</p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 18px 0;" />
        
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Olá, <strong>${safePatientName}</strong>!</p>
        
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
          Sua prescrição médica <strong>${safeFormulaName}</strong> foi assinada digitalmente com certificado padrão <strong>ICP-Brasil / VIDaaS</strong> e já está vinculada com segurança ao seu histórico clínico.
        </p>
        
        <div style="margin: 20px 0; padding: 18px; background-color: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 16px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #0f766e;">
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Prescrição:</td>
              <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #004d40;">${safeFormulaName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Validação:</td>
              <td style="padding: 4px 0; text-align: right; color: #059669; font-weight: 700;">ICP-Brasil Digital (VIDaaS)</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Data do Registro:</td>
              <td style="padding: 4px 0; text-align: right; color: #475569;">${new Date(prescriptionDate).toLocaleDateString("pt-BR")}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
          O documento oficial em formato <strong>PDF assinado</strong> segue anexado diretamente a esta mensagem. Você também pode visualizá-lo e baixá-lo a qualquer momento através do seu <strong>Portal do Paciente</strong>.
        </p>

        ${
          pdfUrl.startsWith("http")
            ? `
        <div style="text-align: center; margin: 28px 0;">
          <a href="${pdfUrl}" target="_blank" rel="noopener noreferrer" style="background-color: #004d40; color: #ffffff; padding: 12px 24px; border-radius: 9999px; text-decoration: none; font-size: 13px; font-weight: 700; display: inline-block; box-shadow: 0 2px 6px rgba(0,77,64,0.2);">
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

    // 3. Verificação e envio via Resend API
    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || "Dra. Juliana Sena <nao-responda@julianasena.com.br>";

    if (!resendApiKey) {
      console.warn(
        "[Resend API] RESEND_API_KEY não configurada no ambiente (Vercel / servidor). " +
        "Para ativar o disparo automático de e-mails em produção com o PDF assinado anexo, " +
        "configure a variável de ambiente RESEND_API_KEY (e opcionalmente EMAIL_FROM) no painel do seu provedor (Vercel > Settings > Environment Variables)."
      );
      console.log(
        `[E-mail Simulado com Anexo] Para: ${patientEmail} | Paciente: ${safePatientName} | Prescrição: ${safeFormulaName} | Anexo: ${fileName} (${pdfBase64 ? `${pdfBase64.length} bytes base64` : "sem bytes"})`
      );

      return NextResponse.json({
        success: true,
        mocked: true,
        message: "Receita vinculada ao prontuário. Aviso: RESEND_API_KEY ausente no painel da Vercel para despacho de e-mails em produção.",
        recipient: patientEmail,
      });
    }

    const attachments = pdfBase64
      ? [
          {
            filename: fileName,
            content: pdfBase64,
          },
        ]
      : [];

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [patientEmail],
        subject: `Receita Digital Assinada - ${safeFormulaName}`,
        html: htmlContent,
        attachments,
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
      message: "Receita assinada enviada com anexo para o e-mail do paciente com sucesso.",
      data: resendData,
      recipient: patientEmail,
    });
  } catch (error: any) {
    console.error("[notify-email] Erro ao enviar e-mail da prescrição:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Falha interna ao processar envio de e-mail." },
      { status: 500 }
    );
  }
}
