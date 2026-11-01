"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * Componente Input protegido contra o bug de composição do IME (Android / Samsung Keyboard).
 * Evita sobrescrever o buffer nativo de teclas mortas (~, ´, ^, ç) mantendo o elemento
 * sincronizado sem reatribuições síncronas que quebram o composition buffer durante a digitação.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      value,
      defaultValue,
      onChange,
      onInput,
      onFocus,
      onBlur,
      onCompositionStart,
      onCompositionEnd,
      ...props
    },
    ref
  ) => {
    const innerRef = React.useRef<HTMLInputElement | null>(null);
    const isComposingRef = React.useRef(false);

    // Combina innerRef com o ref repassado externamente via forwardRef
    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    // Valor padrão inicial para montagem
    const initialDefault = React.useRef(
      defaultValue !== undefined
        ? defaultValue
        : value !== undefined
        ? value
        : ""
    ).current;

    // Sincroniza a prop value externa apenas quando o campo NÃO estiver com foco ativo ou NÃO estiver compondo
    React.useEffect(() => {
      const node = innerRef.current;
      if (!node) return;

      const isFocused =
        typeof document !== "undefined" && document.activeElement === node;

      // Preserva o buffer se estiver com foco e no meio de uma composição de acentos
      if (isFocused && isComposingRef.current) {
        return;
      }

      if (!isFocused && value !== undefined) {
        const nextStr = value === null ? "" : String(value);
        if (node.value !== nextStr) {
          node.value = nextStr;
        }
      }
    }, [value]);

    const handleCompositionStart = (
      e: React.CompositionEvent<HTMLInputElement>
    ) => {
      isComposingRef.current = true;
      onCompositionStart?.(e);
    };

    const handleCompositionEnd = (
      e: React.CompositionEvent<HTMLInputElement>
    ) => {
      isComposingRef.current = false;
      onCompositionEnd?.(e);

      // Sincroniza qualquer alteração ao concluir a composição
      if (onChange && innerRef.current) {
        const syntheticEvent = Object.create(e, {
          target: { value: innerRef.current },
          currentTarget: { value: innerRef.current },
        });
        onChange(syntheticEvent);
      }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Ao sair do foco, assegura sincronização com a prop externa se definida
      if (value !== undefined && innerRef.current) {
        const nextStr = value === null ? "" : String(value);
        if (innerRef.current.value !== nextStr) {
          innerRef.current.value = nextStr;
        }
      }
      onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
    };

    const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
      onInput?.(e);
    };

    return (
      <input
        ref={innerRef}
        type={type}
        defaultValue={initialDefault}
        onChange={handleChange}
        onInput={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        className={cn(
          "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 dark:focus:border-emerald-500 dark:focus:ring-1 dark:focus:ring-emerald-500 outline-none transition-all disabled:opacity-50",
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
