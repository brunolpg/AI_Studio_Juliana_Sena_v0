export type UserRole = "paciente" | "profissional" | "administrador";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  avatar?: string;
  created_at: string;
}

export interface UserCredentials {
  email: string;
  password: string;
}

export interface UserRegistration {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: number;
}

export interface AuthResponse<T = User> {
  success: boolean;
  message: string;
  user?: T;
  token?: string;
  errors?: Record<string, string[]>;
}
