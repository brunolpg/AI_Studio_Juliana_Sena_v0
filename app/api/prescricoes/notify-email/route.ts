import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      patientName,
      patientEmail,
      formulaName,
      pdfUrl,
      prescriptionDate,
    } = body;

    if (!patientEmail || !pdfUrl) {
      return NextResponse.json(
        { error: "E-mail do paciente e URL do PDF são obrigatórios." },
        { status: 400 }
      );
    }

    // Baixa os bytes do PDF assinado para anexar ao e-mail
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error("Não foi possível obter o arquivo PDF assinado.");
    }
    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfArrayBuffer).toString("base64");

    const fileName = `Receita_Assinada_${(patientName || "Paciente")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`;

    const htmlContent = `
      <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; color: #1e293b;">
        <h2 style="color: #0d9488; margin-top: 0;">Dra. Juliana Sena</h2>
        <p style="font-size: 13px; color: #64748b; margin-top: -8px;">Enfermeira Esteta • COREN-BA 366.344</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
        <p>Olá, <strong>${patientName || "Paciente"}</strong>!</p>
        <p>Sua prescrição <strong>${formulaName || "Fórmula Magistral"}</strong> foi assinada digitalmente com certificado ICP-Brasil e já está disponível.</p>
        <p>Segue em anexo neste e-mail o arquivo PDF assinado. Você também pode consultá-lo e baixá-lo a qualquer momento acessando o seu <strong>Portal do Paciente</strong> em nosso site.</p>
        <div style="margin: 24px 0; padding: 14px; background-color: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 12px; font-size: 13px; color: #0f766e;">
          <strong>Prescrição:</strong> ${formulaName || "Receituário Magistral"}<br/>
          <strong>Status:</strong> Assinada Digitalmente (ICP-Brasil / VIDaaS)
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">
          Atenciosamente,<br/>
          <strong>Dra. Juliana Sena</strong><br/>
          Estética Avançada e Regenerativa • Salvador - BA
        </p>
      </div>
    `;

    // Integração via Resend API (se RESEND_API_KEY estiver configurada)
    if (process.env.RESEND_API_KEY) {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "Dra. Juliana Sena <nao-responda@julianasena.com.br>",
          to: [patientEmail],
          subject: `Receita Digital Assinada - ${formulaName || "Dra. Juliana Sena"}`,
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
        console.warn("Aviso ao enviar via Resend:", errText);
      }
    } else {
      console.log(
        `[E-mail em 2º Plano] Destinatário: ${patientEmail} | Anexo: ${fileName} (${pdfBase64.length} bytes base64)`
      );
    }

    return NextResponse.json({
      success: true,
      message: "E-mail com PDF assinado processado em segundo plano.",
    });
  } catch (error: any) {
    console.error("Erro ao enviar e-mail da prescrição:", error);
    return NextResponse.json(
      { error: error?.message || "Falha ao enviar e-mail." },
      { status: 500 }
    );
  }
}
