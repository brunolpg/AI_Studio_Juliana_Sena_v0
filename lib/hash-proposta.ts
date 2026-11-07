import crypto from "node:crypto";

/**
 * Ordena recursivamente as chaves de um objeto/array para gerar
 * uma estrutura JSON determinística e canônica.
 */
export function canonicalizeValue(val: unknown): unknown {
  if (val === null || typeof val !== "object") {
    return val;
  }

  if (Array.isArray(val)) {
    return val.map(canonicalizeValue);
  }

  const obj = val as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const canonicalObj: Record<string, unknown> = {};

  for (const key of sortedKeys) {
    const value = obj[key];
    if (value !== undefined) {
      canonicalObj[key] = canonicalizeValue(value);
    }
  }

  return canonicalObj;
}

export interface PropostaHashResult {
  payloadCanonico: Record<string, unknown>;
  hash: string;
  assinatura: string;
  algoritmo: "SHA-256";
}

/**
 * Gera hash SHA-256 e assinatura de integridade para a proposta clínica
 * com base na serialização canônica ordenada das propriedades.
 */
export function generatePropostaHash(
  payload: Record<string, unknown>
): PropostaHashResult {
  const payloadCanonico = canonicalizeValue(payload) as Record<string, unknown>;
  const canonicalStr = JSON.stringify(payloadCanonico);

  const hash = crypto
    .createHash("sha256")
    .update(canonicalStr, "utf8")
    .digest("hex");

  return {
    payloadCanonico,
    hash,
    assinatura: hash,
    algoritmo: "SHA-256",
  };
}
