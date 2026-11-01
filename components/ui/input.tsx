"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value"> {
  /**
   * Valor externo sincronizado de forma não-controlada no DOM nativo.
   * Não é injetado diretamente como prop `value` no <input> nativo para
   * impedir reatribuições síncronas do React 19 durante digitação de dead keys no IME Android / Samsung.
   */
  value?: string | number | readonly string[];
}

/**
 * Componente Input desvinculado de binding síncrono no elemento nativo.
 * Mantém o <input> nativo 100% não-controlado (via defaultValue) e sincroniza
 * alterações externas exclusivamente quando o campo NÃO estiver com foco ativo.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    // Guarda o valor padrão inicial fixado na montagem
    const initialDefault = React.useRef(
      defaultValue !== undefined ? defaultValue : value !== undefined ? value : ""
    ).current;

    // Sincroniza alterações externas (ex: autocompletar, resets) apenas quando o campo NÃO estiver focado
    React.useEffect(() => {
      if (!inputRef.current) return;
      const isFocused =
        typeof document !== "undefined" && document.activeElement === inputRef.current;

      if (!isFocused && value !== undefined) {
        const nextStr = String(value ?? "");
        if (inputRef.current.value !== nextStr) {
          inputRef.current.value = nextStr;
        }
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Dispara o onChange externo normalmente a cada caractere digitado
      // Sem reatribuir input.value enquanto o cursor estiver ativo no campo
      onChange?.(e);
    };

    return (
      <input
        ref={inputRef}
        type={type}
        defaultValue={initialDefault}
        onChange={handleChange}
        className={cn(
          "w-full transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
export default Input;
