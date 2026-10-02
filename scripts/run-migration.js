const { Client } = require("pg");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL environment variable is not defined.");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL database.");

    // Create Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.procedimentos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          procedimento TEXT NOT NULL,
          categoria TEXT NOT NULL,
          duracao NUMERIC NOT NULL DEFAULT 1,
          valor NUMERIC NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log("Table 'public.procedimentos' created or already exists.");

    // Enable RLS
    await client.query(`
      ALTER TABLE public.procedimentos ENABLE ROW LEVEL SECURITY;
    `);
    console.log("RLS enabled on public.procedimentos.");

    // Create Policy (Check first to avoid duplicate policy error)
    const policyCheck = await client.query(`
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'procedimentos' AND policyname = 'Permitir leitura para todos';
    `);

    if (policyCheck.rows.length === 0) {
      await client.query(`
        CREATE POLICY "Permitir leitura para todos" ON public.procedimentos FOR SELECT USING (true);
      `);
      console.log("Policy 'Permitir leitura para todos' created.");
    } else {
      console.log("Policy 'Permitir leitura para todos' already exists.");
    }

    // Check if seeded
    const countRes = await client.query("SELECT COUNT(*) FROM public.procedimentos;");
    const count = parseInt(countRes.rows[0].count, 10);
    
    if (count === 0) {
      console.log("Seeding public.procedimentos with clinical procedures...");
      await client.query(`
        INSERT INTO public.procedimentos (procedimento, categoria, duracao, valor) VALUES
        -- Consulta
        ('Consulta Estética', 'Consulta', 1, 200),
        -- Estética Facial
        ('Botox (Face inteira)', 'Estética Facial', 2, 1800),
        ('Toxina Botulínica (Terço Superior)', 'Estética Facial', 2, 1200),
        ('Limpeza de Pele Profunda', 'Estética Facial', 2, 250),
        ('Microagulhamento Facial', 'Estética Facial', 1, 500),
        ('Peeling Químico Facial', 'Estética Facial', 1, 400),
        ('Acne Inflamatória com PDT', 'Estética Facial', 1, 250),
        ('Peeling ATA (Ácido Tricloroacético)', 'Estética Facial', 1, 700),
        ('Intradermoterapia Facial', 'Estética Facial', 1, 500),
        ('Hydra Deep Lips', 'Estética Facial', 1, 600),
        -- Estética Corporal
        ('Intradermoterapia Corporal', 'Estética Corporal', 1, 500),
        ('Microagulhamento Corporal para Estrias', 'Estética Corporal', 1, 550),
        ('Suplementação Intramuscular (IM)', 'Estética Corporal', 1, 250),
        ('Peeling Químico Corporal e Íntimo', 'Estética Corporal', 1, 450),
        ('Limpeza de Pele Corporal', 'Estética Corporal', 1, 300),
        -- Controle de Hiperidrose
        ('Toxina Botulínica – Axilar', 'Controle de Hiperidrose', 1, 1500),
        ('Toxina Botulínica – Palmar', 'Controle de Hiperidrose', 1, 1500),
        ('Toxina Botulínica – Plantar', 'Controle de Hiperidrose', 1, 2000),
        -- Terapia Capilar
        ('Microagulhamento Capilar + Laserterapia', 'Terapia Capilar', 1, 550),
        ('Intradermoterapia Capilar + Laserterapia', 'Terapia Capilar', 1, 500),
        -- Laserterapia
        ('Terapia de Laser Clínico Avançado', 'Laserterapia', 1, 250),
        ('Fotobiomodulação Terapêutica', 'Laserterapia', 1, 250),
        ('Ilibiterapia (Laserterapia ILIB)', 'Laserterapia', 1, 200),
        ('Laserterapia Pediátrica', 'Laserterapia', 1, 250);
      `);
      console.log("Seeding complete!");
    } else {
      console.log("Table already has " + count + " records. Seeding skipped.");
    }

  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
