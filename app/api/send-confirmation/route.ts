import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientName, patientEmail, date, startTime, endTime, procedimento, observacoes } = body;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[API send-confirmation] RESEND_API_KEY não configurada.");
      return NextResponse.json({ success: false, message: "Resend API key não configurada." }, { status: 400 });
    }

    if (!patientEmail) {
      return NextResponse.json({ success: false, message: "E-mail do paciente é obrigatório." }, { status: 400 });
    }

    const [year, month, day] = (date || "").split("-");
    const formattedDate = day && month && year ? `${day}/${month}/${year}` : date;

    const calendarTitle = encodeURIComponent(`Consulta: ${procedimento} - Dra. Juliana Sena`);
    const startIso = `${date}T${startTime}:00-03:00`.replace(/[-:]/g, "").replace(".000", "");
    const endIso = `${date}T${endTime}:00-03:00`.replace(/[-:]/g, "").replace(".000", "");
    const startCompact = startIso.substring(0, 15) + "Z";
    const endCompact = endIso.substring(0, 15) + "Z";
    const calendarDetails = encodeURIComponent(
      `Paciente: ${patientName}\nProcedimento: ${procedimento}\nHorário: ${startTime} às ${endTime}\n\nFavor comparecer com antecedência.`
    );
    const addToCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calendarTitle}&dates=${startCompact}/${endCompact}&details=${calendarDetails}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 30px;">
          <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="background-color: #0d9488; padding: 28px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Agendamento Confirmado</h1>
              <p style="color: #ccfbf1; margin: 6px 0 0 0; font-size: 14px;">Clínica Dra. Juliana Sena</p>
            </div>
            <div style="padding: 24px;">
              <p style="font-size: 15px; color: #334155; margin-top: 0;">Olá, <strong>${patientName}</strong>!</p>
              <p style="font-size: 14px; color: #64748b; line-height: 1.6;">
                Seu agendamento foi realizado com sucesso. Confira os detalhes abaixo:
              </p>
              <div style="background-color: #f1f5f9; border-radius: 12px; padding: 18px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #1e293b;"><strong>Procedimento:</strong> ${procedimento}</p>
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #1e293b;"><strong>Data:</strong> ${formattedDate}</p>
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #1e293b;"><strong>Horário:</strong> ${startTime} às ${endTime}</p>
                ${observacoes ? `<p style="margin: 0; font-size: 14px; color: #1e293b;"><strong>Observações:</strong> ${observacoes}</p>` : ""}
              </div>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${addToCalendarUrl}" target="_blank" style="background-color: #0f766e; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                  📅 Adicionar à minha Agenda
                </a>
              </div>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
              <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin-bottom: 0;">
                Em caso de dúvidas, entre em contato diretamente com a clínica.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Clínica Dra. Juliana Sena <onboarding@resend.dev>",
        to: [patientEmail],
        subject: `Confirmação de Agendamento: ${procedimento} - ${formattedDate}`,
        html: htmlContent,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Resend API Error]:", res.status, errText);
      return NextResponse.json({ success: false, message: errText }, { status: 500 });
    }

    const dataRes = await res.json();
    return NextResponse.json({ success: true, emailId: dataRes.id });
  } catch (error) {
    console.error("[API send-confirmation Error]:", error);
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
