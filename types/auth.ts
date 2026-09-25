export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "medico" | "recepcionista" | "usuario";
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
  role?: "medico" | "recepcionista" | "admin";
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
