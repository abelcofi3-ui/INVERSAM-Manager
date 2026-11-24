/** Resultado estándar de las acciones de servidor consumido por los formularios. */
export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
} | null;
