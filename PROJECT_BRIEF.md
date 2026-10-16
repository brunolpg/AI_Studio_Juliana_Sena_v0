# PROJECT BRIEF: Dra. Juliana Sena - Gestão Clínica & Prontuário Inteligente

## Stack Architecture
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Motion, Lucide React.
- **Backend & DB**: Supabase PostgreSQL with strict RLS (`@supabase/ssr`, `@supabase/supabase-js`).
- **Integrations**: Google Calendar API (`google_tokens` OAuth), `pdf-lib` (Prescrições ICP-Brasil), Resend API.
- **Deploy**: Vercel via GitHub (AI Studio applet).

## File Map
- `/app`: Next.js App Router (pages, `/api` routes, Server Actions em `/app/actions/`)
- `/components`: UI layout, patient clinical tabs, modais, formulários, tabelas
- `/lib`: `supabase/` (`server.ts`, `client.ts`, `admin.ts`), `validations/` (Zod schemas), `google-calendar/`
- `/types`: Definições TS (`client.ts`, `appointment.ts`, `clinical-record.ts`, `auth.ts`)
- `/sql`: Schemas DDL e políticas RLS (`profiles`, `pacientes`, `appointments`, `procedimentos`, `google_tokens`)

## Data Schema & Key Entities
- `profiles`: `id` (UUID), `nome`, `email`, `avatar_url`, `role` (`'paciente'` | `'profissional'` | `'administrador'`)
- `pacientes`: Dados clínicos, `cpf` único, status (`'Ativo'` | `'Inativo'`), soft delete via `deleted_at`
- `appointments`: `client_id`, data/hora, `procedimento_id`, status, sync Google Calendar (`google_event_id`)
- `procedimentos`: Catálogo de estética, laserterapia e consultas (nome, categoria, duracao, valor)
- `clinical_records`: Histórico médico, evolução clínica (SOAP), sinais vitais, prescrições
- `google_tokens`: Tokens OAuth criptografados por `user_id` com RLS estrito

## Gold Rules for AI
1. **Output Efficiency**: Output strictly targeted code diffs or localized snippets; never dump unmodified whole files.
2. **Next.js 15 & React 19**: Default to Server Components (`async`); use `'use client'` strictly for state/hooks. Always treat route `params` and `searchParams` as Promises (`await params`).
3. **Database & RLS**: Server Actions in `/app/actions/` using `@/lib/supabase/server`. Use table name `appointments` for schedules. Always filter active patients with `deleted_at IS NULL`.
4. **Clinical Rules & Timezone**: Atendimentos restritos a Seg, Qui e Sáb. Enforce timezone `America/Sao_Paulo` (ou `America/Bahia`) en datas, agendamentos e PDFs.
