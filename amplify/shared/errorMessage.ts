/** Read messages from native errors and plain GraphQL/API error objects. */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    if (typeof error.message === 'string') return error.message;
  }
  return String(error ?? 'Unknown error');
}

export interface ErrorDetails {
  message?: string;
  name?: string;
  code?: string;
  errorType?: string;
  stack?: string;
  errors: ErrorDetails[];
  $metadata?: { httpStatusCode?: number };
}

/** Narrow unknown SDK and GraphQL failures before reading their properties. */
export function getErrorDetails(error: unknown): ErrorDetails {
  if (!error || typeof error !== 'object') return { errors: [] };
  const value = error as Record<string, unknown>;
  const stringField = (key: string) =>
    typeof value[key] === 'string' ? value[key] : undefined;
  const metadata = value.$metadata;
  const status = metadata && typeof metadata === 'object' && 'httpStatusCode' in metadata
    ? metadata.httpStatusCode : undefined;
  return {
    message: stringField('message'),
    name: stringField('name'),
    code: stringField('code') ?? stringField('Code'),
    errorType: stringField('errorType'),
    stack: stringField('stack'),
    errors: Array.isArray(value.errors) ? value.errors.map(getErrorDetails) : [],
    $metadata: typeof status === 'number' ? { httpStatusCode: status } : undefined,
  };
}

export function getErrorMessages(error: unknown): string[] {
  const details = getErrorDetails(error);
  return [details.message, ...details.errors.map(item => item.message)]
    .filter((message): message is string => typeof message === 'string');
}
