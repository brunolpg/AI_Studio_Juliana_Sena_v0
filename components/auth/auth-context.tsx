"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { User, AuthResponse } from "@/types/auth";
import type { LoginInput, RegisterInput } from "@/lib/validations/auth-schema";
import {
  loginAction,
  registerAction,
  logoutAction,
  getCurrentUserAction,
} from "@/actions/auth-actions";
import { useToast } from "@/components/ui/toast";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authModalMode: "login" | "register";
  openAuthModal: (mode?: "login" | "register") => void;
  closeAuthModal: () => void;
  login: (credentials: LoginInput) => Promise<AuthResponse>;
  register: (data: RegisterInput) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  requireAuth: (callback: () => void, modalMode?: "login" | "register") => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register">("login");
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;

    async function loadInitialSession() {
      try {
        const currentUser = await getCurrentUserAction();
        if (isMounted) {
          setUser(currentUser);
        }
      } catch (error) {
        if (isMounted) {
          console.warn("Aviso: Falha ao recuperar sessão do usuário (esperado caso o banco de dados não esteja totalmente inicializado ou offline):", error);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialSession();

    // Ouvinte em tempo real para sincronização de estado com o Supabase Auth (e.g. Google Login)
    const { getSupabaseClient } = require("@/lib/supabase/client");
    const supabase = getSupabaseClient();
    let authListener: any = null;

    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange(async (event: string) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          const currentUser = await getCurrentUserAction();
          if (isMounted) {
            setUser(currentUser);
          }
        } else if (event === "SIGNED_OUT") {
          if (isMounted) {
            setUser(null);
          }
        }
      });
      authListener = data?.subscription;
    }

    return () => {
      isMounted = false;
      if (authListener) {
        authListener.unsubscribe();
      }
    };
  }, []);

  const openAuthModal = useCallback((mode: "login" | "register" = "login") => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  /**
   * Helper para checar se o usuário está logado antes de uma ação;
   * Se não estiver, abre o modal de login automaticamente e retorna false.
   */
  const requireAuth = useCallback(
    (callback: () => void, modalMode: "login" | "register" = "login"): boolean => {
      if (user) {
        callback();
        return true;
      }
      toast({
        type: "info",
        title: "Autenticação Necessária",
        description: "Faça login com seu perfil para realizar esta operação no sistema.",
      });
      openAuthModal(modalMode);
      return false;
    },
    [user, openAuthModal, toast]
  );

  const login = async (credentials: LoginInput): Promise<AuthResponse> => {
    try {
      const response = await loginAction(credentials);
      if (response.success && response.user) {
        setUser(response.user);
        setIsAuthModalOpen(false);
        toast({
          type: "success",
          title: "Sessão Iniciada",
          description: response.message,
        });
      } else {
        toast({
          type: "error",
          title: "Erro ao Entrar",
          description: response.message,
        });
      }
      return response;
    } catch (error) {
      const msg = (error as Error).message || "Falha na comunicação com o servidor.";
      toast({
        type: "error",
        title: "Erro no Login",
        description: msg,
      });
      return { success: false, message: msg };
    }
  };

  const register = async (data: RegisterInput): Promise<AuthResponse> => {
    try {
      const response = await registerAction(data);
      if (response.success && response.user) {
        setUser(response.user);
        setIsAuthModalOpen(false);
        toast({
          type: "success",
          title: "Cadastro Concluído",
          description: response.message,
        });
      } else {
        toast({
          type: "error",
          title: "Erro ao Registrar",
          description: response.message,
        });
      }
      return response;
    } catch (error) {
      const msg = (error as Error).message || "Falha ao registrar novo usuário.";
      toast({
        type: "error",
        title: "Erro no Cadastro",
        description: msg,
      });
      return { success: false, message: msg };
    }
  };

  const logout = async () => {
    try {
      await logoutAction();
      setUser(null);
      toast({
        type: "success",
        title: "Desconectado",
        description: "Você saiu do sistema de gestão com segurança.",
      });
    } catch (error) {
      toast({
        type: "error",
        title: "Erro ao Sair",
        description: "Falha ao limpar sessão do servidor.",
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        login,
        register,
        logout,
        requireAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser utilizado dentro de um <AuthProvider />");
  }
  return context;
}
