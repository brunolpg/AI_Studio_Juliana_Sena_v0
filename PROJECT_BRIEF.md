# PROJECT BRIEF: Gestão Clínica & Prontuário Inteligente

## Stack & Infra
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4 (`@tailwindcss/postcss`), Lucide React, Motion.
- **Backend & DB**: Supabase PostgreSQL (`@supabase/ssr`, `@supabase/supabase-js`, RLS ativo).
- **Integrações**: Google Calendar API (OAuth via `google_tokens`), `pdf-lib` (Prescrições ICP-Brasil).
- **Deploy**: Vercel via GitHub (AI Studio applet). Timezone: `America/Sao_Paulo` (ou `America/Bahia`).

## Estrutura de Diretórios
- `/app`: Rotas, layouts e Server Actions em `/app/actions/` (Next.js App Router).
- `/components`: UI, modais, formulários clínicos e tabelas.
- `/lib`: Clientes Supabase (`server.ts`, `client.ts`, `admin.ts`), validações Zod e Google Calendar.
- `/types`: Tipagens TypeScript (`client`, `appointment`, `clinical-record`, `auth`).
- `/sql`: Schemas DDL e políticas RLS para Supabase.

## Esquema de Dados & Entidades
- `profiles`: `id` (UUID), `nome`, `email`, `avatar_url`, `role` (`'paciente'` | `'profissional'` | `'administrador'`).
- `pacientes`: Cadastro clínico, CPF único, status (`'Ativo'` | `'Inativo'`), soft delete via `deleted_at`.
- `agendamentos` (`appointments`): Vínculo paciente/procedimento, sync Google Calendar (`google_event_id`), controle de horários.
- `procedimentos`: Catálogo de estética, laserterapia e consultas (nome, categoria, duração, valor).
- `clinical_records`: Histórico médico, evoluções clínicas (SOAP), sinais vitais, prescrições.
- `google_tokens`: Tokens OAuth criptografados por `user_id` com RLS estrito.

## Regras de Ouro para o Modelo
1. **Eficiência de Output**: Retorne estritamente diffs ou snippets de código modificados; nunca reescreva arquivos inteiros.
2. **Next.js 15 & React 19**: Server Components (`async`) por padrão; use `'use client'` estritamente para hooks/estado. Trate `params` e `searchParams` como Promises (`await params`).
3. **Database & RLS**: Server Actions em `/app/actions/` com `@/lib/supabase/server`. Sempre filtrar pacientes ativos com `deleted_at IS NULL`.
4. **Timezone & Horários**: Respeitar timezone `America/Sao_Paulo` em agendamentos, datas e PDFs gerados.
