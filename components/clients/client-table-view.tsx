"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import {
  Search,
  Plus,
  Filter,
  Eye,
  Edit2,
  Trash2,
  RotateCcw,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  UserX,
  AlertCircle,
  Archive,
  RefreshCw,
  Lock,
  ShieldCheck,
  LogIn,
} from "lucide-react";
import { getClientsAction, restoreClientAction } from "@/actions/client-actions";
import { ClientFormModal } from "./client-form-modal";
import { ClientDetailsModal } from "./client-details-modal";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth/auth-context";
import type { Client, ClientFilter, PaginatedResult } from "@/types/client";

export function ClientTableView() {
  const { toast } = useToast();
  const { user, requireAuth, openAuthModal } = useAuth();

  // Estados de dados e filtros
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "Ativo" | "Inativo" | "excluidos">("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [paginatedData, setPaginatedData] = useState<PaginatedResult<Client>>({
    data: [],
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
    hasMore: false,
  });

  // Modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [clientDetails, setClientDetails] = useState<Client | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isPermanentDelete, setIsPermanentDelete] = useState(false);

  // Debounce da busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Carregar dados via Server Action e useTransition
  const loadClients = useCallback(() => {
    startTransition(async () => {
      try {
        const filters: Partial<ClientFilter> = {
          search: debouncedSearch,
          status: statusFilter,
          page: currentPage,
          pageSize,
          sortBy: "created_at",
          sortOrder: "desc",
        };

        const res = await getClientsAction(filters);
        if (res.success && res.data) {
          setPaginatedData(res.data);
        } else {
          toast({
            type: "error",
            title: "Erro ao buscar pacientes",
            description: res.message,
          });
        }
      } catch (error) {
        console.error(error);
        toast({
          type: "error",
          title: "Erro de conexão",
          description: "Falha ao sincronizar lista de pacientes.",
        });
      }
    });
  }, [debouncedSearch, statusFilter, currentPage, pageSize, toast]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // Ações de linha protegidas por autenticação
  const handleOpenCreate = () => {
    requireAuth(() => {
      setClientToEdit(null);
      setIsFormModalOpen(true);
    });
  };

  const handleOpenEdit = (client: Client) => {
    requireAuth(() => {
      setClientToEdit(client);
      setIsFormModalOpen(true);
    });
  };

  const handleOpenDetails = (client: Client) => {
    setClientDetails(client);
    setIsDetailsModalOpen(true);
  };

  const handleOpenSoftDelete = (client: Client) => {
    requireAuth(() => {
      setClientToDelete(client);
      setIsPermanentDelete(false);
      setIsDeleteModalOpen(true);
    });
  };

  const handleOpenPermanentDelete = (client: Client) => {
    requireAuth(() => {
      setClientToDelete(client);
      setIsPermanentDelete(true);
      setIsDeleteModalOpen(true);
    });
  };

  const handleRestore = async (client: Client) => {
    requireAuth(async () => {
      try {
        const res = await restoreClientAction(client.id);
        if (res.success) {
          toast({
            type: "success",
            title: "Paciente restaurado",
            description: `O cadastro de ${client.nome} voltou para a lista ativa.`,
          });
          loadClients();
        } else {
          toast({
            type: "error",
            title: "Erro ao restaurar",
            description: res.message,
          });
        }
      } catch (error) {
        toast({
          type: "error",
          title: "Erro interno",
          description: "Não foi possível restaurar o paciente.",
        });
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Banner de Status de Autenticação & Autorização */}
      {!user ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 px-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-100 dark:bg-amber-900/60 rounded-lg text-amber-700 dark:text-amber-300">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold block sm:inline">Modo Somente Leitura: </span>
              <span className="text-amber-800/90 dark:text-amber-300/90">
                Faça login para cadastrar pacientes, editar prontuários ou efetuar exclusões lógicas.
              </span>
            </div>
          </div>
          <button
            onClick={() => openAuthModal("login")}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs self-start sm:self-auto transition-all"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Fazer Login</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 px-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl text-xs text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-emerald-100 dark:bg-emerald-900/60 rounded-lg text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <span>
              <strong>Usuário Autenticado:</strong> {user.name} ({user.roleLabel}) • Permissões de escrita e exclusão ativas via JWT
            </span>
          </div>
        </div>
      )}

      {/* Barra Superior com Busca e Filtros */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Campo de Busca em Tempo Real */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="client-search-input"
            type="text"
            placeholder="Buscar por nome, CPF, e-mail ou cidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Filtro por Status e Botão de Ação */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Pills */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
            <button
              id="filter-all-btn"
              onClick={() => {
                setStatusFilter("todos");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === "todos"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Todos
            </button>
            <button
              id="filter-active-btn"
              onClick={() => {
                setStatusFilter("Ativo");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === "Ativo"
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Ativos
            </button>
            <button
              id="filter-inactive-btn"
              onClick={() => {
                setStatusFilter("Inativo");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === "Inativo"
                  ? "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Inativos
            </button>
            <button
              id="filter-trash-btn"
              onClick={() => {
                setStatusFilter("excluidos");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-all ${
                statusFilter === "excluidos"
                  ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              Lixeira
            </button>
          </div>

          <button
            id="refresh-client-list-btn"
            onClick={() => loadClients()}
            disabled={isPending}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin text-teal-600" : ""}`} />
          </button>

          {/* Botão Novo Cadastro */}
          <button
            id="open-new-client-btn"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs hover:shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Paciente</span>
          </button>
        </div>
      </div>

      {/* Tabela de pacientes */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3.5 px-4">Paciente</th>
                <th className="py-3.5 px-4">Data Nasc. / Idade</th>
                <th className="py-3.5 px-4">CPF / Sexo</th>
                <th className="py-3.5 px-4">Contato</th>
                <th className="py-3.5 px-4">Localização</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
              {isPending && paginatedData.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Consultando banco de dados...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                      <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full mb-3 text-slate-400">
                        <UserX className="w-6 h-6" />
                      </div>
                      <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                        Nenhum paciente encontrado
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {statusFilter === "excluidos"
                          ? "A lixeira está vazia. Não há registros com exclusão lógica."
                          : searchTerm
                          ? `Nenhum resultado para "${searchTerm}". Tente outro termo de busca.`
                          : "Cadastre o primeiro paciente clicando no botão acima."}
                      </p>
                      {statusFilter === "todos" && !searchTerm && (
                        <button
                          onClick={handleOpenCreate}
                          className="mt-4 px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
                        >
                          Cadastrar Paciente Agora
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.data.map((client) => {
                  const birthFormatted = new Date(client.data_nascimento + "T00:00:00").toLocaleDateString(
                    "pt-BR",
                    { day: "2-digit", month: "2-digit", year: "numeric" }
                  );

                  return (
                    <tr
                      key={client.id}
                      id={`client-row-${client.id}`}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Nome e Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {client.nome.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 block truncate max-w-[200px]">
                              {client.nome}
                            </span>
                            {client.profissao && (
                              <span className="text-[11px] text-slate-400 block truncate max-w-[200px]">
                                {client.profissao}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Data de Nascimento & Idade Calculada */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-xs text-slate-700 dark:text-slate-300 block">
                          {birthFormatted}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.2 rounded border border-teal-200/60 dark:border-teal-800/60 mt-0.5">
                          {client.idade} anos
                        </span>
                      </td>

                      {/* CPF / Sexo */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-xs font-mono text-slate-800 dark:text-slate-200 block">
                          {client.cpf}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {client.sexo}
                        </span>
                      </td>

                      {/* Contato */}
                      <td className="py-3 px-4">
                        <span className="text-xs text-slate-700 dark:text-slate-300 block">
                          {client.telefone}
                        </span>
                        <span className="text-[11px] text-slate-400 block truncate max-w-[180px]">
                          {client.email}
                        </span>
                      </td>

                      {/* Localização */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-xs text-slate-700 dark:text-slate-300">
                          {client.cidade} / {client.estado}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {client.deleted_at ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                            Excluído (Soft)
                          </span>
                        ) : client.status === "Ativo" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            Inativo
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            id={`view-details-${client.id}`}
                            onClick={() => handleOpenDetails(client)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Visualizar detalhes do prontuário"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {!client.deleted_at ? (
                            <>
                              <button
                                id={`edit-client-${client.id}`}
                                onClick={() => handleOpenEdit(client)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Editar dados"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                id={`delete-client-${client.id}`}
                                onClick={() => handleOpenSoftDelete(client)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                                title="Excluir logicamente (Soft Delete)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                id={`restore-client-${client.id}`}
                                onClick={() => handleRestore(client)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                                title="Restaurar paciente para a lista ativa"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                              <button
                                id={`permanent-delete-${client.id}`}
                                onClick={() => handleOpenPermanentDelete(client)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                title="Excluir permanentemente do banco"
                              >
                                <Trash2 className="w-4 h-4 text-rose-500" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé da Tabela & Paginação */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              Mostrando {paginatedData.data.length} de {paginatedData.total} pacientes
            </span>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <span>Por página:</span>
              <select
                id="page-size-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs">
              Página {paginatedData.page} de {Math.max(1, paginatedData.totalPages)}
            </span>
            <div className="flex items-center gap-1">
              <button
                id="prev-page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || isPending}
                className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                title="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                id="next-page-btn"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={!paginatedData.hasMore || isPending}
                className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                title="Próxima página"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modais de Ação */}
      <ClientFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={loadClients}
        clientToEdit={clientToEdit}
      />

      <ClientDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        client={clientDetails}
        onEdit={(client) => {
          setIsDetailsModalOpen(false);
          handleOpenEdit(client);
        }}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        client={clientToDelete}
        onSuccess={loadClients}
        isPermanent={isPermanentDelete}
      />
    </div>
  );
}
