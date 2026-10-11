import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    if (!supabase) {
      return new NextResponse("Falha de conexão com banco de dados", { status: 500 });
    }

    // Busca prescrição com itens e paciente
    const { data: prescricao, error } = await supabase
      .from("prescricoes")
      .select(`
        id,
        data_prescricao,
        observacoes,
        pacientes (
          nome,
          cpf,
          data_nascimento
        ),
        prescricao_itens (
          nome_formula,
          via,
          veiculo,
          dosagem,
          tipo_veiculo,
          posologia,
          duracao,
          orient_paciente,
          orient_farmacia,
          componentes_snapshot
        )
      `)
      .eq("id", id)
      .single();

    if (error || !prescricao) {
      return new NextResponse("Prescrição não encontrada", { status: 404 });
    }

    const paciente = prescricao.pacientes as any;
    const item = prescricao.prescricao_itens?.[0] as any || {};
    const cleanCpf = paciente?.cpf ? paciente.cpf.replace(/\D/g, "") : "";
    const formattedCpf = cleanCpf.length === 11 
      ? `${cleanCpf.slice(0,3)}.${cleanCpf.slice(3,6)}.${cleanCpf.slice(6,9)}-${cleanCpf.slice(9,11)}`
      : paciente?.cpf || "Não informado";

    const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(prescricao.data_prescricao ? new Date(prescricao.data_prescricao + "T12:00:00") : new Date());

    const safeFileName = `Receita_${(paciente?.nome || "Paciente").replace(/\s+/g, "_")}.html`;

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Receituário - ${paciente?.nome}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background: #fff; color: #1e293b; padding: 15mm; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
    .title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; }
    .doc-name { font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 2px; }
    .doc-sub { font-size: 11px; color: #0d9488; font-weight: 600; }
    .coren { font-size: 11px; font-weight: 700; color: #475569; }
    .patient-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 18px; display: flex; justify-content: space-between; }
    .label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
    .val { font-size: 12px; font-weight: 700; color: #1e293b; }
    .formula-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
    .formula-title { font-size: 14px; font-weight: 800; color: #0f172a; }
    .formula-via { font-size: 11px; font-weight: 600; color: #64748b; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 14px; background: #f8fafc; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0; }
    .table th { background: #f1f5f9; text-align: left; padding: 8px 12px; font-size: 10px; font-weight: 700; color: #475569; }
    .table td { padding: 8px 12px; font-size: 11px; font-weight: 600; color: #1e293b; border-top: 1px solid #e2e8f0; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; font-size: 11px; }
    .posologia-box { background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; padding: 12px; margin-bottom: 14px; font-size: 11px; line-height: 1.5; color: #134e4a; }
    .obs-box { font-size: 10px; color: #64748b; margin-bottom: 25px; line-height: 1.4; }
    .date-line { text-align: center; font-size: 11px; color: #64748b; margin-bottom: 25px; }
    .signature-box { border: 2px dashed #0d9488; border-radius: 10px; background: #f0fdfa; padding: 12px; text-align: center; width: 340px; margin: 0 auto; }
    .sig-name { font-size: 11px; font-weight: 700; color: #0f172a; }
    .sig-sub { font-size: 10px; font-weight: 600; color: #0d9488; }
    .sig-note { font-size: 8.5px; color: #64748b; margin-top: 4px; line-height: 1.2; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">RECEITUÁRIO / PRESCRIÇÃO MAGISTRAL</div>
      <div class="doc-name">Juliana Sena de Souza Vieira</div>
      <div class="doc-sub">Enfermeira Esteta</div>
    </div>
    <div class="coren">COREN-BA 366.344</div>
  </div>

  <div class="patient-box">
    <div>
      <div class="label">Paciente</div>
      <div class="val">${paciente?.nome || "Paciente"}</div>
    </div>
    <div style="text-align: right;">
      <div class="label">CPF</div>
      <div class="val">${formattedCpf}</div>
    </div>
  </div>

  <div class="formula-header">
    <div class="formula-title">${item?.nome_formula || "Reposição Férrica (uso Condicional)"}</div>
    <div class="formula-via">Uso ${item?.via || "Oral"}</div>
  </div>

  <table class="table">
    <thead>
      <tr>
        <th>COMPONENTE / ATIVO</th>
        <th style="text-align: right;">CONCENTRAÇÃO</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Ferro Quelato (bisglicinato De Ferro)</td>
        <td style="text-align: right;">20mg</td>
      </tr>
    </tbody>
  </table>

  <div class="info-grid">
    <div><strong>Veículo:</strong> ${item?.veiculo || "Cápsula"}</div>
    <div><strong>Dose:</strong> 1 dose(s) | <strong>Total:</strong> ${item?.duracao || "30 dose(s)"}</div>
  </div>

  <div class="posologia-box">
    <strong>POSOLOGIA (FREQUÊNCIA E HORÁRIOS):</strong><br/>
    ${item?.posologia || "Tomar 1 cápsula ao dia pela manhã com água com limão."}
  </div>

  ${item?.orient_paciente ? `<div class="obs-box"><strong>Orientações ao Paciente:</strong> ${item.orient_paciente}</div>` : ""}

  <div class="date-line">${dataFormatada}</div>

  <div class="signature-box">
    <div class="sig-name">Juliana Sena de Souza Vieira</div>
    <div class="sig-sub">Enfermeira Esteta • COREN-BA 366.344</div>
    <div class="sig-note">Espaço reservado para aposição de Assinatura Digital Qualificada ICP-Brasil (VIDaaS / Validador ITI)</div>
  </div>
</body>
</html>`;

    return new NextResponse(htmlContent, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFileName}"`
      }
    });
  } catch (err: any) {
    return new NextResponse(err.message || "Erro interno", { status: 500 });
  }
}
