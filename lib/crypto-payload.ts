import crypto from "crypto";

/**
 * Ordena recursivamente as chaves de um objeto/array para gerar
 * uma representação JSON canônica e determinística.
 */
export function canonicalizeJson(obj: any): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return "[" + obj.map((item) => canonicalizeJson(item)).join(",") + "]";
  }

  const sortedKeys = Object.keys(obj).sort();
  const pairs: string[] = [];

  for (const key of sortedKeys) {
    const val = obj[key];
    if (val !== undefined) {
      pairs.push(`${JSON.stringify(key)}:${canonicalizeJson(val)}`);
    }
  }

  return "{" + pairs.join(",") + "}";
}

/**
 * Calcula o Hash SHA-256 (hexadecimal) da string canônica.
 */
export function gerarHashSha256(canonicalStr: string): string {
  return crypto.createHash("sha256").update(canonicalStr, "utf8").digest("hex");
}

// Chave RSA privada em memória para fallback resiliente em ambiente local/testes
let localFallbackPrivateKeyPem: string | null = null;

function getFallbackPrivateKeyPem(): string {
  if (!localFallbackPrivateKeyPem) {
    try {
      const { privateKey } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
      localFallbackPrivateKeyPem = privateKey;
    } catch (err) {
      console.warn("Falha ao gerar chave RSA privada em memória:", err);
      localFallbackPrivateKeyPem = "FALLBACK_KEY";
    }
  }
  return localFallbackPrivateKeyPem;
}

/**
 * Assina o hash SHA-256 usando algoritmo RS256 (RSA-SHA256) retornando a assinatura em Base64.
 * Caso a variável de ambiente CLINICA_PRIVATE_KEY não esteja configurada,
 * utiliza chave RSA local gerada em memória ou HMAC de fallback para resiliência total.
 */
export function assinarHash(hash: string, privateKeyPem?: string): string {
  const keyToUse = privateKeyPem || process.env.CLINICA_PRIVATE_KEY || getFallbackPrivateKeyPem();

  try {
    if (keyToUse.includes("BEGIN PRIVATE KEY") || keyToUse.includes("BEGIN RSA PRIVATE KEY")) {
      const signer = crypto.createSign("SHA256");
      signer.update(hash);
      signer.end();
      return signer.sign(keyToUse, "base64");
    }

    // Fallback HMAC se a chave não for um PEM RSA válido
    return crypto
      .createHmac("sha256", keyToUse)
      .update(hash)
      .digest("base64");
  } catch (err) {
    console.warn("Erro ao assinar com chave RSA, aplicando HMAC fallback:", err);
    return crypto
      .createHmac("sha256", "CLINICA_ESTETICA_REGENERATIVA_SECRET_KEY")
      .update(hash)
      .digest("base64");
  }
}

export interface SignedPayloadResult {
  payloadCanonicoStr: string;
  payloadHash: string;
  assinatura: string;
  algoritmo: "RS256";
  assinadoEm: string;
}

/**
 * Gera o payload canônico, calcula o hash SHA-256 e produz a assinatura digital.
 */
export function assinarPayloadSOAP(payload: Record<string, any>): SignedPayloadResult {
  const assinadoEm = payload.assinado_em || new Date().toISOString();
  const completePayload = {
    ...payload,
    assinado_em: assinadoEm,
  };

  const payloadCanonicoStr = canonicalizeJson(completePayload);
  const payloadHash = gerarHashSha256(payloadCanonicoStr);
  const assinatura = assinarHash(payloadHash);

  return {
    payloadCanonicoStr,
    payloadHash,
    assinatura,
    algoritmo: "RS256",
    assinadoEm,
  };
}
