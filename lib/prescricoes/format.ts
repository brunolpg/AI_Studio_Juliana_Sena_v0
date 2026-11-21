export interface PrescriptionComponentDisplay {
  nome: string;
  qtd: string;
}

export interface PrescriptionDetailsInput {
  medicamento: string;
  dosagem?: string | null;
  via?: string | null;
  duracao?: string | null;
  instrucoes?: string | null;
  orient_paciente?: string | null;
  orient_farmacia?: string | null;
  componentes?: Array<{
    nome: string;
    quantidade?: number | string | null;
    unidade?: string | null;
  }> | null;
  item?: {
    nome_formula?: string | null;
    via?: string | null;
    veiculo?: string | null;
    dosagem?: number | string | null;
    dosagem_unidade?: string | null;
    tipo_veiculo?: string | null;
    duracao?: number | string | null;
    orient_paciente?: string | null;
    orient_farmacia?: string | null;
    componentes_snapshot?: Array<{
      nome: string;
      quantidade?: number | string | null;
      unidade?: string | null;
    }> | null;
  } | null;
}

export interface ParsedPrescriptionDetails {
  componentes: PrescriptionComponentDisplay[];
  veiculo: string;
  dosagem: string;
  total: string;
  orientPaciente: string;
  orientFarmacia: string;
}

/**
 * Remove parênteses órfãos de fechamento ')' e fecha/remove parênteses '(' sem fechamento,
 * garantindo texto limpo e sempre com parênteses balanceados.
 */
export function balanceParentheses(raw?: string | null): string {
  const normalized = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const out: string[] = [];
  const openIndices: number[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === "(") {
      openIndices.push(out.length);
      out.push(ch);
    } else if (ch === ")") {
      if (openIndices.length > 0) {
        openIndices.pop();
        out.push(ch);
      }
      // ')' órfão sem '(' correspondente é ignorado
    } else {
      out.push(ch);
    }
  }

  // Trata '(' não fechados
  if (openIndices.length > 0) {
    for (let i = openIndices.length - 1; i >= 0; i--) {
      const idx = openIndices[i];
      const after = out.slice(idx + 1).join("").trim();
      if (!after || /^[\s)]*$/.test(after)) {
        out.splice(idx, 1);
      } else {
        out.push(")");
      }
    }
  }

  return out
    .join("")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\)/g, ")")
    .replace(/\(\s+/g, "(")
    .trim();
}

/**
 * Sanitiza a descrição do veículo base removendo resíduos de q.s.p. ou metadados (Dose/Total)
 * e garantindo parênteses balanceados.
 */
export function sanitizeVehicleText(raw?: string | null): string {
  const base = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!base) return "";

  let cleaned = base;

  // Remove metadados residuais caso tenham vazado para o veículo
  const metaMatches = [...cleaned.matchAll(/\s*\(\s*(?:Dose:|Total:)/gi)];
  if (metaMatches.length > 0) {
    const lastMeta = metaMatches[metaMatches.length - 1];
    if (lastMeta.index !== undefined) {
      cleaned = cleaned.slice(0, lastMeta.index).trim();
    }
  }

  cleaned = cleaned
    .replace(/\s*\(\s*(?:Dose:\s*[^|)]*\s*\|\s*)?Total:\s*[^)]*\)?\s*$/i, "")
    .replace(/\s*\bq\.?\s*s\.?\s*p\.?\s*(?:[0-9]+(?:[.,][0-9]+)?\s*(?:g|ml|mg|mcg|ui|un(?:idades?)?)?)?\s*$/i, "")
    .trim();

  return balanceParentheses(cleaned);
}

/**
 * Extrai quantidade numérica + unidade (ex.: "30 g", "50 ml") de uma dosagem tópica.
 */
export function extractTopicalQuantityWithUnit(
  dosagem?: number | string | null,
  dosagemUnidade?: string | null
): string | null {
  if (dosagem === undefined || dosagem === null) return null;
  const raw = balanceParentheses(String(dosagem).replace(/\s+/g, " ").trim());
  if (!raw) return null;

  const withoutQsp = raw.replace(/^q\.?\s*s\.?\s*p\.?\s*/i, "").trim();
  if (!withoutQsp) return null;

  const pureNumber = withoutQsp.match(/^([0-9]+(?:[.,][0-9]+)?)$/);
  if (pureNumber) {
    const num = parseFloat(pureNumber[1].replace(",", "."));
    if (!Number.isFinite(num) || num <= 0) return null;
    const unit = (dosagemUnidade || "g").trim().toLowerCase();
    return `${pureNumber[1]} ${unit}`;
  }

  const numWithUnit = withoutQsp.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(g|ml|mg|mcg|ui)$/i);
  if (numWithUnit) {
    const num = parseFloat(numWithUnit[1].replace(",", "."));
    if (!Number.isFinite(num) || num <= 0) return null;
    return `${numWithUnit[1]} ${numWithUnit[2].toLowerCase()}`;
  }

  return null;
}

/**
 * Formata a coluna direita do frame da fórmula:
 * - Oral ("DOSE / APRESENTAÇÃO"): ex. "1 dose(s)" ou "Cápsula vegetal"
 * - Tópico ("DOSAGEM (Q.S.P.)"): ex. "q.s.p. 30 g" ou "q.s.p."
 */
export function formatPrescriptionDosage(params: {
  via?: string | null;
  dosagem?: number | string | null;
  dosagemUnidade?: string | null;
}): string {
  const isOral = (params.via || "").toLowerCase() === "oral";
  const raw = balanceParentheses(
    params.dosagem !== undefined && params.dosagem !== null ? String(params.dosagem).trim() : ""
  );

  if (isOral) {
    if (!raw) return "Cápsula vegetal";
    if (/dose/i.test(raw)) return raw;
    return `${raw} dose(s)`;
  }

  if (!raw || /^q\.?\s*s\.?\s*p\.?$/i.test(raw)) {
    return "q.s.p.";
  }

  const numericQsp = extractTopicalQuantityWithUnit(raw, params.dosagemUnidade);
  if (numericQsp) {
    return `q.s.p. ${numericQsp}`;
  }

  const withoutQsp = raw.replace(/^q\.?\s*s\.?\s*p\.?\s*/i, "").trim();
  if (!withoutQsp || /^0+(?:[.,]0+)?\s*(?:g|ml)?$/i.test(withoutQsp)) {
    return "q.s.p.";
  }

  return `q.s.p. ${balanceParentheses(withoutQsp)}`;
}

/**
 * Formata a linha QUANTIDADE TOTAL de forma objetiva e sem repetir a descrição do veículo:
 * - Tópico: ex. "30 g (1 unidade)" ou "1 unidade"
 * - Oral: ex. "30 dose(s)"
 */
export function formatPrescriptionTotal(params: {
  via?: string | null;
  duracao?: number | string | null;
  tipoVeiculo?: string | null;
  dosagem?: number | string | null;
  dosagemUnidade?: string | null;
}): string {
  const isOral = (params.via || "").toLowerCase() === "oral";

  const cleanRawDur = (val?: number | string | null): string => {
    if (val === undefined || val === null) return "";
    const s = String(val)
      .replace(/^Total:\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!s || s === "null" || s === "undefined") return "";
    return balanceParentheses(s);
  };

  const cleanTipo = (val?: string | null): string => {
    if (!val) return "";
    const s = String(val).replace(/\s+/g, " ").trim();
    if (!s || s === "null" || s === "undefined") return "";
    return balanceParentheses(s);
  };

  const durStr = cleanRawDur(params.duracao);
  const tipoStr = cleanTipo(params.tipoVeiculo);

  if (isOral) {
    if (!durStr) return "";
    if (/(?:dose|sachê|sache|comprimido|cápsula|capsula|un|unidade)/i.test(durStr)) {
      return durStr;
    }
    return `${durStr} ${tipoStr || "dose(s)"}`.trim();
  }

  const numericQsp = extractTopicalQuantityWithUnit(params.dosagem, params.dosagemUnidade);

  if (!durStr || /^uso recomendado$/i.test(durStr)) {
    return numericQsp || durStr || "";
  }

  const unitCountMatch = durStr.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(?:un(?:idades?)?)?$/i);
  if (unitCountMatch) {
    const qtyStr = unitCountMatch[1];
    const qtyNum = parseFloat(qtyStr.replace(",", "."));
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      return numericQsp || "";
    }
    const unitLabel = qtyNum === 1 ? "1 unidade" : `${qtyStr} unidades`;
    return numericQsp ? `${numericQsp} (${unitLabel})` : unitLabel;
  }

  // Fallback para textos legados: remove q.s.p. e preserva parênteses balanceados
  const cleanedLegacy = durStr.replace(/\bq\.?\s*s\.?\s*p\.?\s*/gi, "").trim();
  return balanceParentheses(cleanedLegacy);
}

/**
 * Monta a string resumida exibida no card da prescrição no prontuário.
 */
export function formatPrescriptionSummaryString(params: {
  ativos: string;
  via?: string | null;
  veiculo?: string | null;
  dosagem?: number | string | null;
  dosagemUnidade?: string | null;
  duracao?: number | string | null;
  tipoVeiculo?: string | null;
}): string {
  const isOral = (params.via || "").toLowerCase() === "oral";
  const cleanVeiculo = sanitizeVehicleText(params.veiculo) || "Veículo base adequado";
  const dosagemText = params.dosagem != null ? String(params.dosagem).trim() : "";
  const duracaoText = params.duracao != null ? String(params.duracao).trim() : "";
  const tipoText =
    params.tipoVeiculo && params.tipoVeiculo !== "null"
      ? String(params.tipoVeiculo).trim()
      : isOral
      ? "dose(s)"
      : "un";

  if (isOral) {
    return `${params.ativos} em ${cleanVeiculo} (Dose: ${dosagemText} | Total: ${duracaoText} ${tipoText})`;
  }

  const unit = (params.dosagemUnidade || "g").trim();
  return `${params.ativos} em ${cleanVeiculo} q.s.p. ${dosagemText} ${unit} (Total: ${duracaoText} ${tipoText})`;
}

/**
 * Extrai com segurança os detalhes estruturados de uma prescrição (preferindo campos
 * estruturados quando disponíveis e fazendo parse seguro com balanceamento de parênteses).
 */
export function parsePrescriptionDetails(rx: PrescriptionDetailsInput): ParsedPrescriptionDetails {
  const dosagemStr = String(rx.dosagem ?? "").trim();
  const effectiveVia = rx.item?.via || rx.via || "Tópico";

  let componentes: PrescriptionComponentDisplay[] = [];
  let parsedVeiculo = "";
  let parsedDosagem = "";
  let parsedTotal = "";

  const snapshotComps = rx.componentes?.length
    ? rx.componentes
    : rx.item?.componentes_snapshot?.length
    ? rx.item.componentes_snapshot
    : null;

  if (snapshotComps && snapshotComps.length > 0) {
    componentes = snapshotComps
      .filter((c) => c?.nome?.trim())
      .map((c) => ({
        nome: String(c.nome).trim(),
        qtd: `${c.quantidade ?? ""}${c.unidade || ""}`.trim(),
      }));
  }

  const emIndex = dosagemStr.indexOf(" em ");
  if (emIndex !== -1) {
    if (componentes.length === 0) {
      const assetsPart = dosagemStr.slice(0, emIndex);
      componentes = assetsPart
        .split(" + ")
        .map((a) => {
          const colonIdx = a.indexOf(": ");
          if (colonIdx !== -1) {
            return {
              nome: a.slice(0, colonIdx).trim(),
              qtd: a.slice(colonIdx + 2).trim(),
            };
          }
          return { nome: a.trim(), qtd: "" };
        })
        .filter((c) => c.nome);
    }

    const remaining = dosagemStr.slice(emIndex + 4).trim();
    let beforeMeta = remaining;

    // Procura o último grupo de metadados "(Dose: ... | Total: ...)" ou "(Total: ...)"
    // para nunca quebrar quando o nome do veículo já contiver parênteses.
    const metaMatches = [...remaining.matchAll(/\s*\(\s*(?:Dose:|Total:)/gi)];
    if (metaMatches.length > 0) {
      const lastMatch = metaMatches[metaMatches.length - 1];
      const metaStart = lastMatch.index ?? -1;
      if (metaStart >= 0) {
        beforeMeta = remaining.slice(0, metaStart).trim();
        let metaContent = remaining.slice(metaStart).trim();
        if (metaContent.startsWith("(")) {
          metaContent = metaContent.slice(1);
        }
        if (metaContent.endsWith(")")) {
          metaContent = metaContent.slice(0, -1);
        }
        metaContent = metaContent.trim();

        if (metaContent.includes(" | ")) {
          const [dosePart, totalPart] = metaContent.split(" | ");
          parsedDosagem = dosePart.replace(/^Dose:\s*/i, "").trim();
          parsedTotal = (totalPart || "").replace(/^Total:\s*/i, "").trim();
        } else {
          parsedTotal = metaContent.replace(/^Total:\s*/i, "").trim();
        }
      }
    }

    // Extrai q.s.p. <valor> do final do veículo, se presente
    const qspMatch = beforeMeta.match(
      /\s*\bq\.?\s*s\.?\s*p\.?\s*([0-9]+(?:[.,][0-9]+)?\s*(?:g|ml|mg|mcg|ui)?)?\s*$/i
    );
    if (qspMatch) {
      beforeMeta = beforeMeta.slice(0, qspMatch.index).trim();
      if (!parsedDosagem && qspMatch[1]?.trim()) {
        parsedDosagem = qspMatch[1].trim();
      }
    }

    parsedVeiculo = beforeMeta;
  } else if (componentes.length === 0) {
    componentes = [{ nome: rx.medicamento, qtd: dosagemStr }];
  }

  const rawVeiculo = rx.item?.veiculo?.trim() || parsedVeiculo;
  const veiculo = sanitizeVehicleText(rawVeiculo) || "Veículo base adequado";

  const rawDosagem =
    rx.item?.dosagem !== undefined && rx.item?.dosagem !== null && String(rx.item.dosagem).trim() !== ""
      ? rx.item.dosagem
      : parsedDosagem;

  const dosagem = formatPrescriptionDosage({
    via: effectiveVia,
    dosagem: rawDosagem,
    dosagemUnidade: rx.item?.dosagem_unidade,
  });

  const rawTotal =
    rx.item?.duracao !== undefined && rx.item?.duracao !== null && String(rx.item.duracao).trim() !== ""
      ? rx.item.duracao
      : parsedTotal || rx.duracao || "";

  const total = formatPrescriptionTotal({
    via: effectiveVia,
    duracao: rawTotal,
    tipoVeiculo: rx.item?.tipo_veiculo,
    dosagem: rawDosagem,
    dosagemUnidade: rx.item?.dosagem_unidade,
  });

  // Orientações ao paciente e à farmácia
  let orientPaciente = rx.orient_paciente?.trim() || rx.item?.orient_paciente?.trim() || "";
  let orientFarmacia = rx.orient_farmacia?.trim() || rx.item?.orient_farmacia?.trim() || "";

  if (!orientPaciente && !orientFarmacia && rx.instrucoes) {
    if (rx.instrucoes.includes("[Observações à Farmácia Magistral]\n")) {
      const parts = rx.instrucoes.split("[Observações à Farmácia Magistral]\n");
      orientPaciente = parts[0].replace("[Orientações ao Paciente]\n", "").trim();
      if (parts.length > 1) {
        orientFarmacia = parts[1].trim();
      }
    } else {
      orientPaciente = rx.instrucoes.replace("[Orientações ao Paciente]\n", "").trim();
    }
  }

  return {
    componentes:
      componentes.length > 0 ? componentes : [{ nome: rx.medicamento, qtd: dosagemStr }],
    veiculo,
    dosagem,
    total,
    orientPaciente,
    orientFarmacia,
  };
}
