export interface StateOption {
  uf: string;
  name: string;
}

export const BRAZILIAN_STATES: StateOption[] = [
  { uf: 'AC', name: 'Acre' },
  { uf: 'AL', name: 'Alagoas' },
  { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' },
  { uf: 'BA', name: 'Bahia' },
  { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' },
  { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' },
  { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' },
  { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' },
  { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' },
];

export const CITIES_BY_STATE: Record<string, string[]> = {
  AC: ['Rio Branco', 'Cruzeiro do Sul', 'Sena Madureira', 'Tarauacá', 'Feijó', 'Brasiléia'],
  AL: ['Maceió', 'Arapiraca', 'Rio Largo', 'Palmeira dos Índios', 'Penedo', 'União dos Palmares'],
  AP: ['Macapá', 'Santana', 'Laranjal do Jari', 'Oiapoque', 'Porto Grande', 'Mazagão'],
  AM: ['Manaus', 'Parintins', 'Itacoatiara', 'Manacapuru', 'Coari', 'Tefé'],
  BA: ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Juazeiro', 'Itabuna', 'Lauro de Freitas', 'Ilhéus', 'Porto Seguro'],
  CE: ['Fortaleza', 'Caucaia', 'Juazeiro do Norte', 'Maracanaú', 'Sobral', 'Crato', 'Itapipoca', 'Maranguape'],
  DF: ['Brasília', 'Ceilândia', 'Taguatinga', 'Samambaia', 'Plano Piloto', 'Águas Claras', 'Guará', 'Gama', 'Sobradinho'],
  ES: ['Vitória', 'Vila Velha', 'Serra', 'Cariacica', 'Cachoeiro de Itapemirim', 'Linhares', 'São Mateus', 'Guarapari'],
  GO: ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde', 'Luziânia', 'Águas Lindas de Goiás', 'Valparaíso de Goiás', 'Itumbiara'],
  MA: ['São Luís', 'Imperatriz', 'São José de Ribamar', 'Timon', 'Caxias', 'Codó', 'Paço do Lumiar', 'Açailândia'],
  MT: ['Cuiabá', 'Várzea Grande', 'Rondonópolis', 'Sinop', 'Tangará da Serra', 'Sorriso', 'Lucas do Rio Verde', 'Primavera do Leste'],
  MS: ['Campo Grande', 'Dourados', 'Três Lagoas', 'Corumbá', 'Ponta Porã', 'Naviraí', 'Nova Andradina', 'Sidrolândia'],
  MG: ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim', 'Montes Claros', 'Ribeirão das Neves', 'Uberaba', 'Governador Valadares', 'Ipatinga', 'Sete Lagoas', 'Poços de Caldas'],
  PA: ['Belém', 'Ananindeua', 'Santarém', 'Marabá', 'Parauapebas', 'Castanhal', 'Abaetetuba', 'Cametá', 'Barcarena'],
  PB: ['João Pessoa', 'Campina Grande', 'Santa Rita', 'Patos', 'Bayeux', 'Sousa', 'Cajazeiras', 'Cabedelo'],
  PR: ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossra', 'Cascavel', 'São José dos Pinhais', 'Foz do Iguaçu', 'Colombo', 'Guarapuava', 'Paranaguá'],
  PE: ['Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Caruaru', 'Petrolina', 'Paulista', 'Cabo de Santo Agostinho', 'Camaragibe', 'Garanhuns'],
  PI: ['Teresina', 'Parnaíba', 'Picos', 'Piripiri', 'Floriano', 'Barras', 'Campo Maior', 'Esperantina'],
  RJ: ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói', 'Belford Roxo', 'Campos dos Goytacazes', 'São João de Meriti', 'Petrópolis', 'Volta Redonda', 'Macaé', 'Cabo Frio'],
  RN: ['Natal', 'Mossoró', 'Parnamirim', 'São Gonçalo do Amarante', 'Ceará-Mirim', 'Macaíba', 'Caicó', 'Açu'],
  RS: ['Porto Alegre', 'Caxias do Sul', 'Canoas', 'Pelotas', 'Santa Maria', 'Gravataí', 'Viamão', 'Novo Hamburgo', 'São Leopoldo', 'Rio Grande', 'Passo Fundo'],
  RO: ['Porto Velho', 'Ji-Paraná', 'Ariquemes', 'Vilhena', 'Cacoal', 'Rolim de Moura', 'Jaru', 'Guajará-Mirim'],
  RR: ['Boa Vista', 'Rorainópolis', 'Caracaraí', 'Pacaraima', 'Cantá', 'Mucajaí'],
  SC: ['Florianópolis', 'Joinville', 'Blumenau', 'São José', 'Criciúma', 'Chapecó', 'Itajaí', 'Jaraguá do Sul', 'Palhoça', 'Balneário Camboriú', 'Brusque'],
  SP: ['São Paulo', 'Guarulhos', 'Campinas', 'São Bernardo do Campo', 'Santo André', 'São José dos Campos', 'Osasco', 'Ribeirão Preto', 'Sorocaba', 'Santos', 'Mauá', 'São José do Rio Preto', 'Mogi das Cruzes', 'Jundiaí', 'Piracicaba', 'Bauru'],
  SE: ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto', 'Itabaiana', 'São Cristóvão', 'Estância', 'Tobias Barreto'],
  TO: ['Palmas', 'Araguaína', 'Gurupi', 'Porto Nacional', 'Paraíso do Tocantins', 'Colinas do Tocantins']
};

/**
 * Validação rigorosa de CPF pelo cálculo oficial dos dois dígitos verificadores
 */
export function isValidCPF(cpf: string): boolean {
  if (!cpf) return false;
  
  // Remove caracteres não numéricos
  const cleanCPF = cpf.replace(/\D/g, '');

  // Deve conter exatamente 11 dígitos numéricos
  if (cleanCPF.length !== 11) return false;

  // Rejeita sequências conhecidas de dígitos idênticos (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  // Validação do 1º dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i), 10) * (10 - i);
  }
  let rest = 11 - (sum % 11);
  const digit1 = rest >= 10 ? 0 : rest;
  if (digit1 !== parseInt(cleanCPF.charAt(9), 10)) return false;

  // Validação do 2º dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i), 10) * (11 - i);
  }
  rest = 11 - (sum % 11);
  const digit2 = rest >= 10 ? 0 : rest;
  return digit2 === parseInt(cleanCPF.charAt(10), 10);
}

/**
 * Formata CEP no padrão 00000-000
 */
export function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, '$1-$2');
}

/**
 * Validação básica de CEP (8 dígitos numéricos)
 */
export function isValidCEP(value: string): boolean {
  if (!value) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length === 8;
}

export interface AddressLookupResult {
  cep: string;
  logradouro: string;
  complemento?: string;
  bairro?: string;
  localidade: string;
  uf: string;
}

// Dicionário de contingência rápida para CEPs conhecidos
const KNOWN_CEPS: Record<string, AddressLookupResult> = {
  "01310100": {
    cep: "01310-100",
    logradouro: "Avenida Paulista",
    bairro: "Bela Vista",
    localidade: "São Paulo",
    uf: "SP",
  },
  "01310200": {
    cep: "01310-200",
    logradouro: "Avenida Paulista",
    bairro: "Bela Vista",
    localidade: "São Paulo",
    uf: "SP",
  },
  "01001000": {
    cep: "01001-000",
    logradouro: "Praça da Sé",
    bairro: "Sé",
    localidade: "São Paulo",
    uf: "SP",
  },
  "22041001": {
    cep: "22041-001",
    logradouro: "Avenida Atlântica",
    bairro: "Copacabana",
    localidade: "Rio de Janeiro",
    uf: "RJ",
  },
  "22410002": {
    cep: "22410-002",
    logradouro: "Rua Visconde de Pirajá",
    bairro: "Ipanema",
    localidade: "Rio de Janeiro",
    uf: "RJ",
  },
  "30130100": {
    cep: "30130-100",
    logradouro: "Avenida Afonso Pena",
    bairro: "Centro",
    localidade: "Belo Horizonte",
    uf: "MG",
  },
  "70040010": {
    cep: "70040-010",
    logradouro: "Esplanada dos Ministérios",
    bairro: "Zona Cívico-Administrativa",
    localidade: "Brasília",
    uf: "DF",
  },
  "80020310": {
    cep: "80020-310",
    logradouro: "Rua XV de Novembro",
    bairro: "Centro",
    localidade: "Curitiba",
    uf: "PR",
  },
  "40020000": {
    cep: "40020-000",
    logradouro: "Avenida Sete de Setembro",
    bairro: "Centro",
    localidade: "Salvador",
    uf: "BA",
  },
  "90010190": {
    cep: "90010-190",
    logradouro: "Rua dos Andradas",
    bairro: "Centro Histórico",
    localidade: "Porto Alegre",
    uf: "RS",
  },
  "60060440": {
    cep: "60060-440",
    logradouro: "Avenida Beira Mar",
    bairro: "Meireles",
    localidade: "Fortaleza",
    uf: "CE",
  },
};

/**
 * Consulta de endereço a partir do CEP via ViaCEP com contingência
 */
export async function fetchAddressByCEP(cep: string): Promise<AddressLookupResult | null> {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return null;

  // 1. Tentar consultar a API pública ViaCEP (gratuita e com CORS liberado)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (!data.erro && data.logradouro !== undefined) {
        return {
          cep: data.cep || formatCEP(clean),
          logradouro: data.logradouro || "",
          complemento: data.complemento || "",
          bairro: data.bairro || "",
          localidade: data.localidade || "",
          uf: data.uf || "",
        };
      }
    }
  } catch {
    // Fallback silencioso para contingência local em caso de timeout ou restrição de rede
  }

  // 2. Se a API falhou ou está offline, verifica o dicionário de contingência
  if (KNOWN_CEPS[clean]) {
    return KNOWN_CEPS[clean];
  }

  return null;
}

export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

/**
 * Formata Telefone no padrão (00) 00000-0000 ou (00) 0000-0000
 */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

/**
 * Calcula a idade a partir da data de nascimento de forma precisa
 */
export function calculateAge(birthDateString: string): number | null {
  if (!birthDateString) return null;
  const birthDate = new Date(birthDateString);
  if (isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= 0 ? age : null;
}
