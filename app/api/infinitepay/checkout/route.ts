import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PROCEDIMENTOS_CADASTRAIS } from "@/lib/procedimentos-mock";

export async function POST(req: Request) {
  try {
    const { appointmentId } = await req.json();

    if (!appointmentId) {
      return NextResponse.json(
        { error: "appointmentId é obrigatório." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Falha na conexão com o banco de dados." },
        { status: 500 }
      );
    }

    // 1. Busca agendamento e paciente vinculado
    const { data: appointment, error: appError } = await supabase
      .from("appointments")
      .select(`
        id,
        procedimento,
        procedimento_id,
        valor_cobrado,
        pacientes (
          nome,
          email,
          telefone
        )
      `)
      .eq("id", appointmentId)
      .single();

    if (appError || !appointment) {
      return NextResponse.json(
        { error: "Agendamento não encontrado." },
        { status: 404 }
      );
    }

    // 2. Busca dinâmica do valor do procedimento vinculado no banco de dados
    let procedurePrice: number | null = null;

    if (appointment.valor_cobrado && Number(appointment.valor_cobrado) > 0) {
      procedurePrice = Number(appointment.valor_cobrado);
    } else {
      // Busca pelo ID do procedimento na tabela 'procedimentos'
      if (appointment.procedimento_id) {
        const { data: procById } = await supabase
          .from("procedimentos")
          .select("valor, procedimento")
          .eq("id", appointment.procedimento_id)
          .maybeSingle();

        if (procById?.valor && Number(procById.valor) > 0) {
          procedurePrice = Number(procById.valor);
        }
      }

      // Se não encontrou por ID, busca pelo nome do procedimento
      if (!procedurePrice && appointment.procedimento) {
        const { data: procByName } = await supabase
          .from("procedimentos")
          .select("valor, procedimento")
          .ilike("procedimento", appointment.procedimento.trim())
          .maybeSingle();

        if (procByName?.valor && Number(procByName.valor) > 0) {
          procedurePrice = Number(procByName.valor);
        }
      }

      // Fallback para o catálogo cadastral
      if (!procedurePrice && appointment.procedimento) {
        const matched = PROCEDIMENTOS_CADASTRAIS.find(
          (p) => p.procedimento.toLowerCase().trim() === appointment.procedimento.toLowerCase().trim()
        );
        if (matched?.valor && Number(matched.valor) > 0) {
          procedurePrice = Number(matched.valor);
        }
      }
    }

    const handle = process.env.INFINITEPAY_HANDLE || "juliana-sena-rgl";
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://drajulianasena.vercel.app";

    // Limpeza do telefone (apenas números com DDD)
    const rawPhone = (appointment.pacientes as any)?.telefone || "";
    const cleanPhone = rawPhone.replace(/\D/g, "");
    const phoneWithCountry = cleanPhone.startsWith("55")
      ? cleanPhone
      : `55${cleanPhone}`;

    // Valor em centavos dinâmico baseado no procedimento vinculado
    const amountNumber = procedurePrice && procedurePrice > 0 ? procedurePrice : 200;
    const priceInCents = Math.round(amountNumber * 100);

    const payload = {
      handle,
      order_nsu: appointment.id,
      items: [
        {
          quantity: 1,
          price: priceInCents,
          description: appointment.procedimento || "Consulta / Procedimento Estético",
        },
      ],
      customer: {
        name: appointment.pacientes?.nome || "Paciente",
        email: appointment.pacientes?.email || undefined,
        phone_number: phoneWithCountry.length >= 10 ? phoneWithCountry : undefined,
      },
      redirect_url: `${appUrl}/paciente?payment_status=success&id=${appointment.id}`,
      webhook_url: `${appUrl}/api/webhooks/infinitepay`,
    };

    const response = await fetch("https://api.checkout.infinitepay.io/links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[InfinitePay Error]", data);
      return NextResponse.json(
        { error: data.message || "Erro ao gerar checkout na InfinitePay." },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: data.url,
      valor: amountNumber,
    });
  } catch (err: any) {
    console.error("[InfinitePay Route Error]", err);
    return NextResponse.json(
      { error: err.message || "Erro interno do servidor." },
      { status: 500 }
    );
  }
}
