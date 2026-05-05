import { redactSensitiveKeys } from '../redact.js';

/**
 * IP-only authentication method for Voice Out Trunks.
 *
 * **Read-only:** This authentication method can only be configured manually
 * by DIDWW staff upon request. It cannot be set via the API on create or
 * update. Trunks that already have ip_only authentication can still be read,
 * and their non-authentication attributes can be updated normally.
 */
export interface IpOnlyAuthenticationMethod {
  type: 'ip_only';
  allowedSipIps: string[];
  techPrefix: string;
}

export interface CredentialsAndIpAuthenticationMethod {
  type: 'credentials_and_ip';
  allowedSipIps: string[];
  techPrefix: string;
  username: string;
  password: string;
}

export interface TwilioAuthenticationMethod {
  type: 'twilio';
  twilioAccountSid: string;
}

export interface GenericAuthenticationMethod {
  type: string;
  [key: string]: unknown;
}

export type AuthenticationMethod =
  | IpOnlyAuthenticationMethod
  | CredentialsAndIpAuthenticationMethod
  | TwilioAuthenticationMethod
  | GenericAuthenticationMethod;

/**
 * Constructs an IpOnlyAuthenticationMethod value.
 *
 * **Note:** ip_only is a read-only authentication method that can only be
 * configured manually by DIDWW staff upon request. It cannot be set via the
 * API on create or update. This helper exists for deserialization and type
 * narrowing only.
 */
export function ipOnlyAuthenticationMethod(
  attrs: Omit<IpOnlyAuthenticationMethod, 'type'>,
): IpOnlyAuthenticationMethod {
  return { type: 'ip_only', ...attrs };
}

/**
 * Credential fields on {@link CredentialsAndIpAuthenticationMethod}. The wire
 * format is unchanged — these are still emitted on the wire when present —
 * but {@link redactCredentialsAndIpAuthenticationMethod} and the Node.js
 * `util.inspect.custom` hook installed by the builder replace these values
 * with `[FILTERED]` so default `console.log` / `util.inspect` output never
 * leaks the credential downstream.
 */
export const CREDENTIALS_AND_IP_SENSITIVE_KEYS = ['username', 'password'] as const;

/**
 * Returns a shallow copy of the authentication method with credential fields
 * replaced by `'[FILTERED]'`. Use this before logging the method to an
 * external system. The original object is unchanged.
 */
export function redactCredentialsAndIpAuthenticationMethod(
  method: CredentialsAndIpAuthenticationMethod,
): CredentialsAndIpAuthenticationMethod {
  return redactSensitiveKeys(method, CREDENTIALS_AND_IP_SENSITIVE_KEYS);
}

const NODE_INSPECT_CUSTOM = Symbol.for('nodejs.util.inspect.custom');

export function credentialsAndIpAuthenticationMethod(
  attrs: Omit<CredentialsAndIpAuthenticationMethod, 'type'>,
): CredentialsAndIpAuthenticationMethod {
  const method: CredentialsAndIpAuthenticationMethod = { type: 'credentials_and_ip', ...attrs };
  // Install a non-enumerable `util.inspect.custom` hook so default
  // `console.log` / `util.inspect` output redacts credentials. The
  // wire serializer (serializeAuthenticationMethod) is unaffected.
  Object.defineProperty(method, NODE_INSPECT_CUSTOM, {
    value: () => redactCredentialsAndIpAuthenticationMethod(method),
    enumerable: false,
    writable: false,
  });
  return method;
}

export function twilioAuthenticationMethod(
  attrs: Omit<TwilioAuthenticationMethod, 'type'>,
): TwilioAuthenticationMethod {
  return { type: 'twilio', ...attrs };
}

// Type guard functions for AuthenticationMethod narrowing
export function isIpOnly(m: AuthenticationMethod): m is IpOnlyAuthenticationMethod {
  return m.type === 'ip_only';
}

export function isCredentialsAndIp(m: AuthenticationMethod): m is CredentialsAndIpAuthenticationMethod {
  return m.type === 'credentials_and_ip';
}

export function isTwilio(m: AuthenticationMethod): m is TwilioAuthenticationMethod {
  return m.type === 'twilio';
}

export function isGenericAuth(m: AuthenticationMethod): m is GenericAuthenticationMethod {
  return m.type !== 'ip_only' && m.type !== 'credentials_and_ip' && m.type !== 'twilio';
}

export interface SerializedAuthenticationMethod {
  type: string;
  attributes: Record<string, unknown>;
}

export function serializeAuthenticationMethod(method: AuthenticationMethod): SerializedAuthenticationMethod {
  const { type, ...attributes } = method;
  return { type, attributes };
}

export function deserializeAuthenticationMethod(data: Record<string, unknown>): AuthenticationMethod {
  if (!data || typeof data !== 'object') return data as unknown as AuthenticationMethod;
  const type = data.type as string;
  const attributes = (data.attributes as Record<string, unknown>) || {};
  return { type, ...attributes } as AuthenticationMethod;
}
