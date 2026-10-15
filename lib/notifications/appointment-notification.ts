import { PROCEDIMENTOS_CADASTRAIS } from "@/lib/procedimentos-mock";

export interface AppointmentNotificationData {
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  data: string; // "YYYY-MM-DD"
  horario_inicio: string; // "HH:MM"
  horario_fim: string; // "HH:MM"
  procedimento: string;
  valor?: number | string;
  observacoes?: string | null;
}

/**
 * Formata data no timezone 'America/Bahia' (UTC-3)
 */
function formatBahiaDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-");
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Bahia",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Formata valor em BRL (R$)
 */
function formatBrl(valor?: number | string): string {
  if (valor === undefined || valor === null || valor === "") return "A consultar";
  const num = typeof valor === "string" ? parseFloat(valor.replace(/[^\d.,]/g, "").replace(",", ".")) : valor;
  if (isNaN(num)) return "A consultar";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

/**
 * Envia notificação em segundo plano (assíncrona e não-bloqueante)
 * para a Dra. Juliana Sena via E-mail (julianasevieira@gmail.com) e WhatsApp (5571986612878)
 */
export async function sendNewAppointmentAdminNotification(data: AppointmentNotificationData) {
  const ADMIN_EMAIL = "julianasevieira@gmail.com";
  const ADMIN_WHATSAPP = "5571986612878";

  const formattedDate = formatBahiaDate(data.data);
  const timeRange = `${data.horario_inicio} às ${data.horario_fim}`;

  // Busca valor do procedimento se não informado
  let price = data.valor;
  if (price === undefined || price === null || price === 0) {
    const foundProc = PROCEDIMENTOS_CADASTRAIS.find((p) => p.procedimento === data.procedimento);
    if (foundProc) {
      price = foundProc.valor;
    }
  }
  const formattedPrice = formatBrl(price);

  // 1. Envio de E-mail em segundo plano via Resend API
  const sendEmailPromise = (async () => {
    try {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        console.warn("[Notificação Admin E-mail] RESEND_API_KEY não configurada. E-mail omitido.");
        return;
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <body style="font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
            <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
              <div style="background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); padding: 28px 24px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">Novo Agendamento Confirmado!</h1>
                <p style="color: #ccfbf1; margin: 6px 0 0 0; font-size: 13px;">Dra. Juliana Sena • Notificação do Sistema</p>
              </div>
              <div style="padding: 24px;">
                <p style="font-size: 14px; color: #334155; margin-top: 0;">
                  Um novo agendamento foi realizado pelo Portal do Paciente:
                </p>
                <div style="background-color: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 14px; padding: 18px; margin: 18px 0; font-size: 13px; color: #0f766e;">
                  <p style="margin: 0 0 8px 0;"><strong>👤 Paciente:</strong> ${data.patientName}</p>
                  ${data.patientEmail ? `<p style="margin: 0 0 8px 0;"><strong>✉️ E-mail do Paciente:</strong> ${data.patientEmail}</p>` : ""}
                  ${data.patientPhone ? `<p style="margin: 0 0 8px 0;"><strong>📱 Telefone:</strong> ${data.patientPhone}</p>` : ""}
                  <p style="margin: 0 0 8px 0;"><strong>✨ Procedimento:</strong> ${data.procedimento}</p>
                  <p style="margin: 0 0 8px 0;"><strong>📅 Data:</strong> ${formattedDate} (Timezone: America/Bahia)</p>
                  <p style="margin: 0 0 8px 0;"><strong>⏰ Horário:</strong> ${timeRange}</p>
                  <p style="margin: 0 0 8px 0;"><strong>💰 Valor:</strong> ${formattedPrice}</p>
                  ${data.observacoes ? `<p style="margin: 0;"><strong>📝 Observações:</strong> ${data.observacoes}</p>` : ""}
                </div>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
                  Notificação automática enviada para Dra. Juliana Sena (${ADMIN_EMAIL})
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "Dra. Juliana Sena <nao-responda@julianasena.com.br>",
          to: [ADMIN_EMAIL],
          subject: `⚡ Novo Agendamento: ${data.patientName} - ${data.procedimento} (${formattedDate})`,
          html: htmlContent,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn("[Notificação Admin E-mail] Falha na Resend API:", res.status, errText);
      } else {
        console.log(`[Notificação Admin E-mail] Enviado com sucesso para ${ADMIN_EMAIL}`);
      }
    } catch (err) {
      console.error("[Notificação Admin E-mail Error]:", err);
    }
  })();

  // 2. Envio de WhatsApp em segundo plano via API/Webhook ou fallback silencioso
  const sendWhatsAppPromise = (async () => {
    try {
      const whatsappApiUrl = process.env.WHATSAPP_API_URL || process.env.ZAPI_URL || process.env.EVOLUTION_API_URL;
      const whatsappToken = process.env.WHATSAPP_API_TOKEN || process.env.ZAPI_TOKEN || process.env.EVOLUTION_API_TOKEN;

      const whatsappText = [
        `✨ *Novo Agendamento Realizado!*`,
        ``,
        `👤 *Paciente:* ${data.patientName}`,
        data.patientPhone ? `📱 *Telefone:* ${data.patientPhone}` : "",
        `✨ *Procedimento:* ${data.procedimento}`,
        `📅 *Data:* ${formattedDate}`,
        `⏰ *Horário:* ${timeRange}`,
        `💰 *Valor:* ${formattedPrice}`,
        data.observacoes ? `📝 *Obs:* ${data.observacoes}` : "",
        ``,
        `_Agendamento registrado via Portal do Paciente._`,
      ]
        .filter(Boolean)
        .join("\n");

      if (whatsappApiUrl) {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (whatsappToken) {
          headers["Authorization"] = `Bearer ${whatsappToken}`;
          headers["apikey"] = whatsappToken;
        }

        const res = await fetch(whatsappApiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            phone: ADMIN_WHATSAPP,
            number: ADMIN_WHATSAPP,
            message: whatsappText,
            text: whatsappText,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.warn("[Notificação Admin WhatsApp] Falha na API WhatsApp:", res.status, errText);
        } else {
          console.log(`[Notificação Admin WhatsApp] Enviado com sucesso para ${ADMIN_WHATSAPP}`);
        }
      } else {
        console.log(
          `[Notificação Admin WhatsApp - Fallback Log]\nDestinatário: ${ADMIN_WHATSAPP}\nMensagem:\n${whatsappText}`
        );
      }
    } catch (err) {
      console.error("[Notificação Admin WhatsApp Error]:", err);
    }
  })();

  // Garante execução assíncrona não-bloqueante
  Promise.allSettled([sendEmailPromise, sendWhatsAppPromise]).catch((err) => {
    console.warn("[Notificação Admin Agregador Error]:", err);
  });
}
