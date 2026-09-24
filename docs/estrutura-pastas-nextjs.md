# Estrutura Recomendada de Pastas — Next.js 15+ (App Router)

Esta arquitetura segue as melhores práticas para aplicações corporativas com Next.js (App Router), TypeScript estrito, Server Actions, Supabase e Shadcn UI.

```
meu-projeto-gestao/
├── .env.example                     # Variáveis de ambiente declaradas e documentadas
├── .env.local                       # Segredos locais (NÃO commitado no Git)
├── package.json                     # Dependências e scripts
├── tsconfig.json                    # Configurações do compilador TypeScript
├── next.config.ts                   # Configurações do Next.js
├── postcss.config.mjs               # Pipeline PostCSS
│
├── actions/                         # ⚡ Server Actions (Mutação e Consultas Server-Side)
│   └── client-actions.ts            # CRUD de clientes com "use server" e revalidação de cache
│
├── app/                             # 🌐 Next.js App Router (Rotas, Layouts e Páginas)
│   ├── layout.tsx                   # Layout Raiz com Providers e Tipografia
│   ├── globals.css                  # Estilos globais Tailwind v4
│   ├── page.tsx                     # Página principal (Dashboard & Gestão de Clientes)
│   ├── api/                         # Endpoints REST (Webhooks, integrações externas)
│   │   └── clientes/
│   │       └── export/route.ts      # Exemplo: Exportação CSV / Relatórios
│   └── clientes/
│       ├── [id]/                    # Rota de detalhes com Server Component
│       │   └── page.tsx
│       └── novo/                    # Rota dedicada de cadastro
│           └── page.tsx
│
├── components/                      # 🧩 Componentes React
│   ├── ui/                          # Componentes base atômicos (Shadcn UI / Radix)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── dialog.tsx
│   │   ├── badge.tsx
│   │   └── table.tsx
│   ├── clients/                     # Componentes de domínio de Clientes / Pacientes
│   │   ├── client-form-modal.tsx    # Modal/Formulário de cadastro e edição
│   │   ├── client-table.tsx         # Tabela responsiva com paginação
│   │   ├── client-filters.tsx       # Barra de busca em tempo real e filtros de status
│   │   ├── client-details-modal.tsx # Visualização completa de prontuário/cadastro
│   │   └── delete-confirm-modal.tsx # Confirmação de exclusão lógica (Soft Delete)
│   └── shared/                      # Componentes reutilizáveis compartilhados
│       ├── header.tsx
│       ├── empty-state.tsx
│       └── code-viewer.tsx          # Visualizador interativo de códigos e scripts
│
├── hooks/                           # 🪝 Custom React Hooks
│   ├── use-clients.ts               # Hook de orquestração de listagem, busca e cache
│   ├── use-debounce.ts              # Debounce para busca em tempo real
│   └── use-toast.ts                 # Notificações e feedback visual de ações
│
├── lib/                             # 🛠️ Utilitários e Bibliotecas do Sistema
│   ├── utils.ts                     # Helper cn() (clsx + tailwind-merge)
│   ├── brazil-data.ts               # Estados (UFs), cidades e validação algorítmica de CPF
│   ├── supabase/                    # Conexão com o Supabase
│   │   ├── client.ts                # Cliente singleton para Client Components
│   │   └── server.ts                # Cliente seguro para Server Components / Actions
│   └── validations/                 # Schemas de validação Zod
│       └── client-schema.ts         # Schema Zod com mensagens em pt-BR e cálculo de idade
│
├── sql/                             # 🗄️ Scripts de Banco de Dados e Migrations
│   └── supabase-schema.sql          # DDL da tabela clientes, RLS, triggers e índices
│
└── types/                           # 🏷️ Definições de Tipos TypeScript
    └── client.ts                    # Tipagens inferidas do Zod e entidades do banco
```

---

## Principais Diretrizes Arquiteturais:

1. **Separação de Responsabilidades**:
   - `actions/`: Contém regras de mutação e integração com banco (`"use server"`). Garante validação no servidor antes de tocar no banco de dados.
   - `lib/validations/`: Ponto único de verdade para validação. O mesmo schema Zod é utilizado no formulário do cliente e na validação do servidor.
   - `types/`: Tipos TypeScript sempre inferidos a partir dos schemas Zod (`z.infer<typeof schema>`), eliminando duplicidade de código (DRY).

2. **Segurança e Integridade**:
   - RLS (Row Level Security) ativado no PostgreSQL.
   - Idade calculada estritamente no backend a partir da data de nascimento para evitar fraudes ou inconsistências.
   - Exclusão lógica com `deleted_at` para preservar auditoria médica/jurídica.
