import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Extrai identificadores da notificação da InfinitePay
    const appointmentId = body.order_nsu || body.data?.order_nsu;
    const status = body.status || body.data?.status;
    const transactionNsu =
      body.transaction_nsu || body.data?.transaction_nsu || body.id;
    const receiptUrl =
      body.receipt_url || body.data?.receipt_url || body.data?.receipt;

    if (!appointmentId) {
      return NextResponse.json(
        { error: "order_nsu não informado no payload." },
        { status: 400 }
      );
    }

    // Verifica se o status reflete pagamento concluído
    const isPaid =
      status === "paid" ||
      status === "approved" ||
      status === "confirmed" ||
      body.event === "payment.approved";

    if (isPaid) {
      const supabase = await createClient();
      if (supabase) {
        await supabase
          .from("appointments")
          .update({
            status_pagamento: "Pago",
            metodo_pagamento: "infinitepay",
            transacao_id: String(transactionNsu || ""),
            comprovante_url: receiptUrl || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", appointmentId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[InfinitePay Webhook Error]", err);
    return NextResponse.json(
      { error: "Erro ao processar webhook." },
      { status: 500 }
    );
  }
}
