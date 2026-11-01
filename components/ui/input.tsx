"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * IME-safe Input component.
 * Prevents Samsung Keyboard / Android IME composition drop issues (e.g., dead keys ~ + a => ã)
 * caused by synchronous React 19 re-renders resetting input DOM state during active composition.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      value,
      defaultValue,
      onChange,
      onCompositionStart,
      onCompositionEnd,
      onBlur,
      ...props
    },
    ref
  ) => {
    const isControlled = value !== undefined;
    const [localValue, setLocalValue] = React.useState<string | number | readonly string[]>(
      value ?? defaultValue ?? ""
    );
    const isComposingRef = React.useRef(false);
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    // Keep local buffer in sync when external controlled value changes outside composition
    React.useEffect(() => {
      if (!isComposingRef.current && isControlled) {
        setLocalValue(value ?? "");
      }
    }, [value, isControlled]);

    const handleCompositionStart = (e: React.CompositionEvent<HTMLInputElement>) => {
      isComposingRef.current = true;
      onCompositionStart?.(e);
    };

    const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
      isComposingRef.current = false;
      onCompositionEnd?.(e);

      // On Android / Samsung keyboard, compositionend provides the finished composed text
      const nextValue = e.currentTarget.value;
      setLocalValue(nextValue);

      if (onChange) {
        const syntheticEvent = Object.create(e, {
          target: { value: e.currentTarget, enumerable: true },
          currentTarget: { value: e.currentTarget, enumerable: true },
          type: { value: "change", enumerable: true },
        });
        onChange(syntheticEvent as React.ChangeEvent<HTMLInputElement>);
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = e.target.value;
      setLocalValue(nextValue);

      // Detect if browser nativeEvent indicates ongoing IME composition
      const isComposing =
        Boolean((e.nativeEvent as any)?.isComposing) || isComposingRef.current;

      // Only dispatch external onChange if NOT actively in an IME composition cycle
      if (!isComposing) {
        onChange?.(e);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // If blur happens while composition was in-flight, flush the final value to parent
      if (isComposingRef.current) {
        isComposingRef.current = false;
        if (onChange) {
          const syntheticEvent = Object.create(e, {
            target: { value: e.currentTarget, enumerable: true },
            currentTarget: { value: e.currentTarget, enumerable: true },
            type: { value: "change", enumerable: true },
          });
          onChange(syntheticEvent as React.ChangeEvent<HTMLInputElement>);
        }
      }
      onBlur?.(e);
    };

    return (
      <input
        ref={inputRef}
        type={type}
        value={isControlled ? localValue : undefined}
        defaultValue={!isControlled ? defaultValue : undefined}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onBlur={handleBlur}
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
