export interface Procedimento {
  id: string;
  procedimento: string;
  categoria: string;
  duracao: number; // em horas
  valor: number;   // em BRL
}

export const PROCEDIMENTOS_CADASTRAIS: Procedimento[] = [
  // Consulta
  { id: "p1", procedimento: "Consulta Estética", categoria: "Consulta", duracao: 1, valor: 200 },
  
  // Estética Facial
  { id: "p2", procedimento: "Botox (Face inteira)", categoria: "Estética Facial", duracao: 2, valor: 1800 },
  { id: "p3", procedimento: "Toxina Botulínica (Terço Superior)", categoria: "Estética Facial", duracao: 2, valor: 1200 },
  { id: "p4", procedimento: "Limpeza de Pele Profunda", categoria: "Estética Facial", duracao: 2, valor: 250 },
  { id: "p5", procedimento: "Microagulhamento Facial", categoria: "Estética Facial", duracao: 1, valor: 500 },
  { id: "p6", procedimento: "Peeling Químico Facial", categoria: "Estética Facial", duracao: 1, valor: 400 },
  { id: "p7", procedimento: "Acne Inflamatória com PDT", categoria: "Estética Facial", duracao: 1, valor: 250 },
  { id: "p8", procedimento: "Peeling ATA (Ácido Tricloroacético)", categoria: "Estética Facial", duracao: 1, valor: 700 },
  { id: "p9", procedimento: "Intradermoterapia Facial", categoria: "Estética Facial", duracao: 1, valor: 500 },
  { id: "p10", procedimento: "Hydra Deep Lips", categoria: "Estética Facial", duracao: 1, valor: 600 },
  
  // Estética Corporal
  { id: "p11", procedimento: "Intradermoterapia Corporal", categoria: "Estética Corporal", duracao: 1, valor: 500 },
  { id: "p12", procedimento: "Microagulhamento Corporal para Estrias", categoria: "Estética Corporal", duracao: 1, valor: 550 },
  { id: "p13", procedimento: "Suplementação Intramuscular (IM)", categoria: "Estética Corporal", duracao: 1, valor: 250 },
  { id: "p14", procedimento: "Peeling Químico Corporal e Íntimo", categoria: "Estética Corporal", duracao: 1, valor: 450 },
  { id: "p15", procedimento: "Limpeza de Pele Corporal", categoria: "Estética Corporal", duracao: 1, valor: 300 },
  
  // Controle de Hiperidrose
  { id: "p16", procedimento: "Toxina Botulínica – Axilar", categoria: "Controle de Hiperidrose", duracao: 1, valor: 1500 },
  { id: "p17", procedimento: "Toxina Botulínica – Palmar", categoria: "Controle de Hiperidrose", duracao: 1, valor: 1500 },
  { id: "p18", procedimento: "Toxina Botulínica – Plantar", categoria: "Controle de Hiperidrose", duracao: 1, valor: 2000 },
  
  // Terapia Capilar
  { id: "p19", procedimento: "Microagulhamento Capilar + Laserterapia", categoria: "Terapia Capilar", duracao: 1, valor: 550 },
  { id: "p20", procedimento: "Intradermoterapia Capilar + Laserterapia", categoria: "Terapia Capilar", duracao: 1, valor: 500 },
  
  // Laserterapia
  { id: "p21", procedimento: "Terapia de Laser Clínico Avançado", categoria: "Laserterapia", duracao: 1, valor: 250 },
  { id: "p22", procedimento: "Fotobiomodulação Terapêutica", categoria: "Laserterapia", duracao: 1, valor: 250 },
  { id: "p23", procedimento: "Ilibiterapia (Laserterapia ILIB)", categoria: "Laserterapia", duracao: 1, valor: 200 },
  { id: "p24", procedimento: "Laserterapia Pediátrica", categoria: "Laserterapia", duracao: 1, valor: 250 }
];

export const PROCEDIMENTO_CATEGORIES = [
  "Consulta",
  "Estética Facial",
  "Estética Corporal",
  "Controle de Hiperidrose",
  "Terapia Capilar",
  "Laserterapia"
];
