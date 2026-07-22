import { localStorageUtil } from './localStorageUtil';
//tk
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const DUPLICATE_WRITE_COOLDOWN_MS = 1500;

/*
 * Keep the original Response unconsumed in this map. Every caller receives a
 * clone, allowing simultaneous duplicate callers to read the response body
 * independently while only one request reaches the API.
 */
const pendingWrites = new Map<string, Promise<Response>>();

const getBodySignature = (body: BodyInit | null | undefined): string | null => {
  if (body == null) {
    return '';
  }

  if (typeof body === 'string') {
    return body;
  }

  if (body instanceof URLSearchParams) {
    return body.toString();
  }

  /*
   * FormData, Blob, ArrayBuffer and streams cannot be compared safely and
   * synchronously. Bypass deduplication instead of risking blocking a
   * different upload that happens to use the same endpoint.
   */
  return null;
};

const getWriteSignature = (
  url: string,
  method: string,
  body: BodyInit | null | undefined
): string | null => {
  if (!MUTATING_METHODS.has(method)) {
    return null;
  }

  const bodySignature = getBodySignature(body);
  if (bodySignature === null) {
    return null;
  }

  return `${method}:${url}:${bodySignature}`;
};

const performAuthenticatedFetch = (
  url: string,
  options: RequestInit,
  token: string | null | undefined
): Promise<Response> =>
  fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

export const fetchWithAuth = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = localStorageUtil.get();
  const method = (options.method || 'GET').toUpperCase();
  const writeSignature = getWriteSignature(url, method, options.body);

  // GET/HEAD requests and non-comparable request bodies keep normal behavior.
  if (writeSignature === null) {
    return performAuthenticatedFetch(url, options, token);
  }

  const existingRequest = pendingWrites.get(writeSignature);
  if (existingRequest) {
    return (await existingRequest).clone();
  }

  const request = performAuthenticatedFetch(url, options, token);
  pendingWrites.set(writeSignature, request);

  try {
    const response = await request;

    // Also absorb an immediate repeat after a fast response has completed.
    setTimeout(() => {
      if (pendingWrites.get(writeSignature) === request) {
        pendingWrites.delete(writeSignature);
      }
    }, DUPLICATE_WRITE_COOLDOWN_MS);

    return response.clone();
  } catch (error: unknown) {
    // A failed network request must be retryable immediately.
    if (pendingWrites.get(writeSignature) === request) {
      pendingWrites.delete(writeSignature);
    }

    throw error;
  }
};
