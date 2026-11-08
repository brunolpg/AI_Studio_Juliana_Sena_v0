"use client";

import React, { useState, useEffect } from "react";

interface PatientAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  sizeClassName?: string;
  textClassName?: string;
  fallbackClassName?: string;
  borderClassName?: string;
  className?: string;
}

/**
 * Componente unificado de avatar do paciente:
 * - Renderiza <img src={avatar_url} ... /> circular (rounded-full, object-cover) quando disponível.
 * - Reverte com segurança para o badge com a inicial se a imagem for nula/vazia ou em caso de erro (onError).
 * - Preserva tokens semânticos do Design System (Tailwind v4 / MD4).
 */
export function PatientAvatar({
  name,
  avatarUrl,
  sizeClassName = "w-8 h-8",
  textClassName = "text-xs",
  fallbackClassName = "bg-primary-container text-on-primary-container",
  borderClassName = "border-outline-variant",
  className = "",
}: PatientAvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Reseta o estado de erro caso o avatar_url seja atualizado
  useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  const cleanName = (name || "").trim();
  const initial = cleanName ? cleanName.charAt(0).toUpperCase() : "P";
  const hasValidAvatar = Boolean(avatarUrl && avatarUrl.trim().length > 0 && !imageError);

  if (hasValidAvatar && avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={cleanName || "Paciente"}
        onError={() => setImageError(true)}
        className={`${sizeClassName} rounded-full object-cover shrink-0 border ${borderClassName} shadow-2xs ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClassName} rounded-full ${fallbackClassName} border ${borderClassName} font-bold ${textClassName} flex items-center justify-center shrink-0 shadow-2xs ${className}`}
      title={cleanName || "Paciente"}
    >
      {initial}
    </div>
  );
}
