# PROJECT BRIEF: Dra. Juliana Sena - Gestão Clínica & Prontuário

## Stack & Infra
- **Core**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4 (`@tailwindcss/postcss`), Lucide React, Motion.
- **Backend & DB**: Supabase PostgreSQL (`@supabase/ssr`, `@supabase/supabase-js`, RLS ativo).
- **APIs**: Google Calendar API (OAuth `google_tokens`), `pdf-lib` (Prescrições ICP-Brasil), Resend.
- **Deploy & Locale**: Vercel (AI Studio). Timezone: `America/Sao_Paulo` (ou `America/Bahia`). Atendimentos: Seg, Qui e Sáb.

## Diretórios
- `/app`: Rotas, layouts e Server Actions em `/app/actions/` (Next.js App Router).
- `/components`: UI, modais, formulários clínicos e tabelas.
- `/lib`: Supabase (`server.ts`, `client.ts`, `admin.ts`), validações Zod e Google Calendar.
- `/types`: Tipagens (`client`, `appointment`, `clinical-record`, `auth`).
- `/sql`: Schemas DDL e políticas de segurança RLS.

## Entidades & Tabelas
- `profiles`: `id` (UUID), `nome`, `email`, `avatar_url`, `role` (`'paciente'` | `'profissional'` | `'administrador'`).
- `pacientes`: Dados clínicos, CPF único, status (`'Ativo'` | `'Inativo'`), soft delete via `deleted_at`.
- `appointments` (`agendamentos`): Vínculo paciente/procedimento, sync Google Calendar (`google_event_id`).
- `procedimentos`: Catálogo estética, laserterapia e consultas (nome, categoria, valor, duração).
- `clinical_records`: Histórico médico, evoluções clínicas (SOAP), sinais vitais e prescrições.
- `google_tokens`: Tokens OAuth criptografados por `user_id` com RLS estrito.

## Regras de Ouro
1. **Output Econômico**: Retorne estritamente diffs ou snippets modificados; nunca reescreva arquivos inteiros.
2. **Next.js 15 & React 19**: Server Components (`async`) padrão; `'use client'` estrito para hooks/estado. `await params`.
3. **Database & RLS**: Server Actions em `/app/actions/` via `@/lib/supabase/server`. Respeite RLS e autenticação.
4. **Soft Delete**: Filtrar sempre pacientes ativos com `deleted_at IS NULL`.
5. **Timezone & Regras Clínicas**: Seg, Qui e Sáb; horário local `America/Sao_Paulo` em agendamentos, datas e PDFs.

## Regras de Consistência e Design System (MD4 / Tailwind v4):
- **Tokens Semânticos Obrigatórios:** Use estritamente as variáveis do `app/globals.css`. Proibido classes literais (ex.: `bg-white`, `bg-gray-*`, `text-slate-*`, `bg-teal-*`, `bg-red-*`).
  - Superfícies: `bg-surface`, `bg-surface-container-lowest`, `bg-surface-container`, `bg-surface-container-high`.
  - Textos: `text-on-surface` (principal), `text-on-surface-variant` (secundário/muted/placeholder).
  - Ações & Destaques: `bg-primary`, `text-on-primary`, `bg-primary-container`, `text-on-primary-container`.
  - Bordas & Status: `border-outline`, `border-outline-variant`, `error`/`on-error-container`, `success`/`on-success-container`, `warning`/`on-warning-container`.
- **Tema e Dark Mode:** Proibido `dark:bg-*` ou `dark:text-*` manuais onde há token semântico (o chaveamento é automático via CSS).
- **Responsividade, Dispositivos e Orientações (Mobile, Tablet Retrato/Paisagem, Desktop):**
  - **Grids e Flex:** Mobile/Smartphone retrato (`grid-cols-1`); Tablet retrato (`md:grid-cols-2`); Tablet paisagem / Desktop (`lg:grid-cols-3` ou `xl:grid-cols-4`).
  - **Altura e Viewport Segura:** Nunca use `h-screen` puro em modais ou painéis; use `min-h-dvh` ou `max-h-[85dvh]` com `overflow-y-auto` para não quebrar a rolagem em modo paisagem com teclado virtual ou barras de navegador abertas.
  - **Tabelas e Listas Clínicas:** Em mobile e tablet retrato, prefira cartões empilhados ou envoltórios com `overflow-x-auto` e rolagem horizontal suave (`scrollbar-none`).
  - **Toque e Espaçamento:** Áreas de clique mínimas de 44x44px (`min-h-[44px] min-w-[44px]`), padding dinâmico (`p-4 sm:p-5 md:p-6 lg:p-8`) e raios do MD4 (`rounded-md-md`, `rounded-md-lg`, `rounded-md-2xl`).
- **Modo de Saída:** Salve os arquivos diretamente sem builds/terminal e retorne apenas diffs/snippets modificados.

