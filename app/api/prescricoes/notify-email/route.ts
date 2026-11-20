import { NextResponse } from "next/server";
import { denyUnlessStaff } from "@/lib/prescricoes/access";
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

export async function POST(request: Request) {
  try {
    const denied = await denyUnlessStaff();
    if (denied) return denied;

    const body = await request.json();
    const {
      patientName,
      patientEmail,
      formulaName,
      pdfUrl,
    } = body;

    if (!patientEmail || !pdfUrl) {
      return NextResponse.json(
        { success: false, error: "E-mail do paciente e URL do PDF são obrigatórios." },
        { status: 400 }
      );
    }

    const urlCheck = resolveAllowedPdfUrl(String(pdfUrl), request.url);
    if (!urlCheck.allowed) {
      return NextResponse.json(
        { success: false, error: "URL do documento PDF inválida ou não autorizada." },
        { status: 400 }
      );
    }

    // Baixa os bytes do PDF assinado para anexar ao e-mail
    const cookieHeader = request.headers.get("cookie");
    const pdfResponse = await fetch(urlCheck.resolvedUrl, {
      headers: urlCheck.isSameOrigin && cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    if (!pdfResponse.ok) {
      throw new Error("Não foi possível obter o arquivo PDF assinado.");
    }
    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfArrayBuffer).toString("base64");

    const safePatientName = String(patientName || "Paciente");
    const safeFormulaName = String(formulaName || "Fórmula Magistral");

    const fileName = `Receita_Assinada_${safePatientName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`;

    const htmlContent = `
      <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; color: #1e293b;">
        <h2 style="color: #0d9488; margin-top: 0;">Dra. Juliana Sena</h2>
        <p style="font-size: 13px; color: #64748b; margin-top: -8px;">Enfermeira Esteta • COREN-BA 366.344</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
        <p>Olá, <strong>${escapeHtml(safePatientName)}</strong>!</p>
        <p>Sua prescrição <strong>${escapeHtml(safeFormulaName)}</strong> foi assinada digitalmente com certificado ICP-Brasil e já está disponível.</p>
        <p>Segue em anexo neste e-mail o arquivo PDF assinado. Você também pode consultá-lo e baixá-lo a qualquer momento acessando o seu <strong>Portal do Paciente</strong> em nosso site.</p>
        <div style="margin: 24px 0; padding: 14px; background-color: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 12px; font-size: 13px; color: #0f766e;">
          <strong>Prescrição:</strong> ${escapeHtml(safeFormulaName || "Receituário Magistral")}<br/>
          <strong>Status:</strong> Assinada Digitalmente (ICP-Brasil / VIDaaS)
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">
          Atenciosamente,<br/>
          <strong>Dra. Juliana Sena</strong><br/>
          Estética Avançada e Regenerativa • Salvador - BA
        </p>
      </div>
    `;

    const gmailResult = await sendEmailViaGmail({
      to: String(patientEmail).trim(),
      subject: `Receita Digital Assinada - ${formulaName || "Dra. Juliana Sena"}`,
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
      message: "E-mail com PDF assinado enviado com sucesso.",
      data: {
        id: gmailResult.messageId,
        threadId: gmailResult.threadId,
        sender: gmailResult.sender,
      },
      recipient: String(patientEmail).trim(),
    });
  } catch (error: any) {
    console.error("Erro ao enviar e-mail da prescrição:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Falha ao enviar e-mail." },
      { status: 500 }
    );
  }
}
