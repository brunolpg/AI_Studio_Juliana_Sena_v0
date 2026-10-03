export interface Procedimento {
  id: string;
  procedimento: string;
  categoria: string;
  duracao: number; // em horas
  valor: number;   // em BRL
  descricao?: string;
}

export const PROCEDIMENTOS_CADASTRAIS: Procedimento[] = [
  // Consulta
  {
    id: "p1",
    procedimento: "Consulta Estética",
    categoria: "Consulta",
    duracao: 1,
    valor: 200,
    descricao: "Consulta de avaliação estética personalizada."
  },

  // Estética Facial
  {
    id: "p2",
    procedimento: "Botox (Face inteira)",
    categoria: "Estética Facial",
    duracao: 2,
    valor: 1800,
    descricao: "Aplicação de toxina botulínica em toda a face."
  },
  {
    id: "p3",
    procedimento: "Toxina Botulínica (Terço Superior)",
    categoria: "Estética Facial",
    duracao: 1,
    valor: 1200,
    descricao: "Tratamento de rugas na testa, glabela e pés de galinha."
  },
  {
    id: "p4",
    procedimento: "Toxina Botulínica (Face inteira + pescoço)",
    categoria: "Estética Facial",
    duracao: 2,
    valor: 2499,
    descricao: "Aplicação completa de toxina botulínica incluindo a região do pescoço."
  },
  {
    id: "p5",
    procedimento: "Revitalização Facial",
    categoria: "Estética Facial",
    duracao: 1,
    valor: 200,
    descricao: "Tratamento para hidratação e luminosidade imediata da pele."
  },
  {
    id: "p6",
    procedimento: "Limpeza de Pele Profunda",
    categoria: "Estética Facial",
    duracao: 2,
    valor: 300,
    descricao: "Remoção profunda de impurezas, cravos e células mortas."
  },
  {
    id: "p7",
    procedimento: "Microagulhamento Biológico Drug Delivery",
    categoria: "Estética Facial",
    duracao: 1,
    valor: 500,
    descricao: "Estímulo de colágeno associado à permeação de ativos biológicos."
  },
  {
    id: "p8",
    procedimento: "Peeling Químico Facial",
    categoria: "Estética Facial",
    duracao: 1,
    valor: 400,
    descricao: "Renovação celular e tratamento de manchas por ácidos."
  },
  {
    id: "p9",
    procedimento: "Acne Inflamatória com PDT",
    categoria: "Estética Facial",
    duracao: 1,
    valor: 250,
    descricao: "Terapia fotodinâmica para controle de acne ativa."
  },
  {
    id: "p10",
    procedimento: "Hydra Deep Lips",
    categoria: "Estética Facial",
    duracao: 1,
    valor: 600,
    descricao: "Protocolo de super hidratação e revitalização labial."
  },
  {
    id: "p11",
    procedimento: "Profhilo Facial - 1 Sessão",
    categoria: "Estética Facial",
    duracao: 1,
    valor: 2500,
    descricao: "Biorremodelador celular de alta performance para firmeza e hidratação."
  },

  // Estética Corporal
  {
    id: "p12",
    procedimento: "Tratamento de Estrias com Drug Delivery",
    categoria: "Estética Corporal",
    duracao: 1,
    valor: 550,
    descricao: "Protocolo focado na regeneração e melhora de estrias corporais."
  },
  {
    id: "p13",
    procedimento: "Profhilo Corporal - 1 Sessão",
    categoria: "Estética Corporal",
    duracao: 1,
    valor: 2500,
    descricao: "Biorremodelador para flacidez e melhoria da qualidade da pele corporal."
  },
  {
    id: "p14",
    procedimento: "Prevenção de Estrias e Melhor na Qualidade da Pele - Sessão",
    categoria: "Estética Corporal",
    duracao: 1,
    valor: 200,
    descricao: "Sessão preventiva para firmeza, elasticidade e textura da pele."
  },
  {
    id: "p15",
    procedimento: "Peeling Químico Corporal e Íntimo",
    categoria: "Estética Corporal",
    duracao: 1,
    valor: 450,
    descricao: "Renovação e clareamento de áreas corporais e íntimas."
  },
  {
    id: "p16",
    procedimento: "Limpeza de Pele Corporal",
    categoria: "Estética Corporal",
    duracao: 2,
    valor: 400,
    descricao: "Limpeza profunda para desobstrução e renovação da pele corporal."
  },

  // Controle de Hiperidrose
  {
    id: "p17",
    procedimento: "Toxina Botulínica – Axilar",
    categoria: "Controle de Hiperidrose",
    duracao: 1,
    valor: 1500,
    descricao: "Tratamento eficaz para suor excessivo nas axilas."
  },
  {
    id: "p18",
    procedimento: "Toxina Botulínica – Palmar",
    categoria: "Controle de Hiperidrose",
    duracao: 1,
    valor: 1500,
    descricao: "Tratamento de hiperidrose nas palmas das mãos."
  },
  {
    id: "p19",
    procedimento: "Toxina Botulínica – Plantar",
    categoria: "Controle de Hiperidrose",
    duracao: 1,
    valor: 2000,
    descricao: "Tratamento de hiperidrose na sola dos pés."
  },

  // Terapia Capilar
  {
    id: "p20",
    procedimento: "Drug Delivery de Ativos Capilar +Laserterapia",
    categoria: "Terapia Capilar",
    duracao: 1,
    valor: 550,
    descricao: "Protocolo capilar completo para fortalecimento e crescimento."
  },
  {
    id: "p21",
    procedimento: "Drug Delivery de Ativos Sobrancelha +Laserterapia",
    categoria: "Terapia Capilar",
    duracao: 1,
    valor: 300,
    descricao: "Protocolo focado em falhas e fortalecimento de sobrancelhas."
  },

  // Laserterapia
  {
    id: "p22",
    procedimento: "Terapia de Laser Clínico Avançado",
    categoria: "Laserterapia",
    duracao: 1,
    valor: 250,
    descricao: "Laserterapia clínica avançada de aplicação sistêmica ou tópica."
  },
  {
    id: "p23",
    procedimento: "Laser no Pós-operatório",
    categoria: "Laserterapia",
    duracao: 1,
    valor: 350,
    descricao: "Tratamento para cicatrização, dor e edema pós-cirúrgicos."
  },
  {
    id: "p24",
    procedimento: "Fotobiomodulação Terapêutica",
    categoria: "Laserterapia",
    duracao: 1,
    valor: 250,
    descricao: "Laser terapêutico de baixa intensidade para regeneração."
  },
  {
    id: "p25",
    procedimento: "Ilibiterapia (Laserterapia ILIB)",
    categoria: "Laserterapia",
    duracao: 1,
    valor: 200,
    descricao: "Laserterapia sistêmica anti-inflamatória e antioxidante."
  },
  {
    id: "p26",
    procedimento: "Laserterapia Pediátrica",
    categoria: "Laserterapia",
    duracao: 1,
    valor: 250,
    descricao: "Laserterapia adaptada e segura para aplicação infantil."
  }
];

export const PROCEDIMENTO_CATEGORIES = [
  "Consulta",
  "Estética Facial",
  "Estética Corporal",
  "Controle de Hiperidrose",
  "Terapia Capilar",
  "Laserterapia"
];
