"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { btn, cx, inputClass } from "@/components/ui";

import type { ActionState } from "@/lib/action-state";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

const FormErrors = createContext<Record<string, string[] | undefined>>({});
const FormPending = createContext<boolean | null>(null);

/**
 * Formulario conectado a una acción de servidor: muestra errores generales y por campo,
 * mensajes de éxito, y opcionalmente se limpia tras guardar.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  onSuccess,
  showMessages = true,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
  showMessages?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccessRef.current?.();
    }
  }, [state, resetOnSuccess]);

  return (
    <FormErrors.Provider value={state?.fieldErrors ?? {}}>
      <FormPending.Provider value={pending}>
      {/* Envío vía onSubmit: evita que React reinicie el formulario y se pierdan los datos si hay errores */}
      <form
        ref={ref}
        className={className}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
          const fd = new FormData(e.currentTarget, submitter);
          startTransition(() => formAction(fd));
        }}
      >
        {showMessages && state?.error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {state.error}
          </div>
        )}
        {showMessages && state?.ok && state.message && (
          <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {state.message}
          </div>
        )}
        {children}
      </form>
      </FormPending.Provider>
    </FormErrors.Provider>
  );
}

export function useFieldError(name: string) {
  return useContext(FormErrors)[name]?.[0];
}

export function SubmitButton({
  children,
  variant = "primary",
  className,
  pendingText = "Guardando…",
  confirm,
  name,
  value,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "dangerGhost";
  className?: string;
  pendingText?: string;
  confirm?: string;
  name?: string;
  value?: string;
}) {
  const status = useFormStatus();
  const ctxPending = useContext(FormPending);
  const pending = ctxPending ?? status.pending;
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={cx(btn[variant], className)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? pendingText : children}
    </button>
  );
}

function Label({ name, label, required }: { name: string; label: string; required?: boolean }) {
  return (
    <label htmlFor={name} className="mb-1 block text-xs font-medium text-slate-700">
      {label}
      {required && <span className="text-red-500"> *</span>}
    </label>
  );
}

function ErrorText({ name, hint }: { name: string; hint?: string }) {
  const error = useFieldError(name);
  if (error) return <p className="mt-1 text-xs text-red-600">{error}</p>;
  if (hint) return <p className="mt-1 text-xs text-slate-500">{hint}</p>;
  return null;
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "name"> & {
  name: string;
  label: string;
  hint?: string;
  wrapperClassName?: string;
};

export function TextField({ name, label, hint, wrapperClassName, required, id, ...rest }: InputProps) {
  const error = useFieldError(name);
  return (
    <div className={wrapperClassName}>
      <Label name={id ?? name} label={label} required={required} />
      <input id={id ?? name} name={name} aria-invalid={Boolean(error)} className={inputClass} {...rest} />
      <ErrorText name={name} hint={hint} />
    </div>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  wrapperClassName,
  required,
  rows = 3,
  ...rest
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name"> & {
  name: string;
  label: string;
  hint?: string;
  wrapperClassName?: string;
}) {
  const error = useFieldError(name);
  return (
    <div className={wrapperClassName}>
      <Label name={name} label={label} required={required} />
      <textarea id={name} name={name} rows={rows} aria-invalid={Boolean(error)} className={inputClass} {...rest} />
      <ErrorText name={name} hint={hint} />
    </div>
  );
}

export function SelectField({
  name,
  label,
  hint,
  options,
  placeholder,
  wrapperClassName,
  required,
  id,
  ...rest
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name"> & {
  name: string;
  label: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  wrapperClassName?: string;
}) {
  const error = useFieldError(name);
  return (
    <div className={wrapperClassName}>
      <Label name={id ?? name} label={label} required={required} />
      <select id={id ?? name} name={name} aria-invalid={Boolean(error)} className={inputClass} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ErrorText name={name} hint={hint} />
    </div>
  );
}

export function CheckboxField({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
      />
      {label}
    </label>
  );
}

/** Formulario de una sola acción (eliminar, cambiar estado…) con confirmación opcional. */
export function ActionButton({
  action,
  fields,
  children,
  confirm,
  variant = "secondary",
  className,
  pendingText = "Procesando…",
}: {
  action: Action;
  fields?: Record<string, string>;
  children: ReactNode;
  confirm?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "dangerGhost";
  className?: string;
  pendingText?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="inline-flex flex-col items-start">
      {Object.entries(fields ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton variant={variant} confirm={confirm} className={className} pendingText={pendingText}>
        {children}
      </SubmitButton>
      {state?.error && <span className="mt-1 max-w-xs text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
