# PROJECT BRIEF: Dra. Juliana Sena - Gestão Clínica & Prontuário Inteligente

## Stack Architecture
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Motion, Lucide React.
- **Backend & DB**: Supabase PostgreSQL with strict RLS (`@supabase/ssr`, `@supabase/supabase-js`).
- **Integrations**: Google Calendar API (`google_tokens` OAuth), `pdf-lib` (Prescriptions ICP-Brasil/VIDaaS), Resend API.
- **Deploy**: Vercel via GitHub (AI Studio applet).

## File Map
- `/app`: Next.js App Router (pages, `/api` routes, Server Actions)
- `/components`: UI layout, patient clinical tabs, modals, tables
- `/lib`: Supabase clients, Zod schemas, PDF generators
- `/types`: Strict TS definitions (`client`, `appointment`, `clinical-record`, `auth`)
- `/sql`: DDL migrations & Supabase RLS security policies

## Data Schema & Entities
- `profiles`: `id`, `nome`, `email`, `avatar_url`, `role` (`'paciente'` | `'profissional'` | `'administrador'`)
- `pacientes`: Clinical patient data, unique `cpf`, status (`'Ativo'` | `'Inativo'`), soft delete via `deleted_at`
- `agendamentos`: Patient & procedure appointments, Google Calendar sync (`event_id`)
- `procedimentos`: Aesthetic procedures catalog, prices, duration
- `clinical_records`: Medical history, clinical evolutions (SOAP), vital signs, prescriptions
- `google_tokens`: Encrypted OAuth tokens per `user_id` with strict RLS

## Gold Rules for AI
1. **Output Efficiency**: Output strictly targeted code diffs or localized modified snippets; never dump unmodified whole files.
2. **Component Strategy**: Default to Server Components (`async`); use `'use client'` strictly for interactivity/hooks.
3. **Data Integrity**: Always apply `deleted_at IS NULL` for active patients (soft-delete compliance).
4. **Localization**: Enforce `America/Bahia` / `America/Sao_Paulo` timezone across dates, PDFs, and calendar sync.
