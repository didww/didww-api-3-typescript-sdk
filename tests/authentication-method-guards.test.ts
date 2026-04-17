import { describe, it, expect } from 'vitest';
import {
  isIpOnly,
  isCredentialsAndIp,
  isTwilio,
  isGenericAuth,
  ipOnlyAuthenticationMethod,
  credentialsAndIpAuthenticationMethod,
  twilioAuthenticationMethod,
} from '../src/nested/authentication-method.js';
import type { AuthenticationMethod, GenericAuthenticationMethod } from '../src/nested/authentication-method.js';

describe('AuthenticationMethod type guards', () => {
  const ipOnly = ipOnlyAuthenticationMethod({ allowedSipIps: ['10.0.0.1/32'], techPrefix: '' });
  const credAndIp = credentialsAndIpAuthenticationMethod({
    allowedSipIps: ['10.0.0.1/32'],
    techPrefix: '',
    username: 'user',
    password: 'pass',
  });
  const twilio = twilioAuthenticationMethod({ twilioAccountSid: 'AC123' });
  const generic: GenericAuthenticationMethod = { type: 'future_type', someField: 'value' };

  it('isIpOnly narrows to IpOnlyAuthenticationMethod', () => {
    expect(isIpOnly(ipOnly)).toBe(true);
    expect(isIpOnly(credAndIp)).toBe(false);
    expect(isIpOnly(twilio)).toBe(false);
    expect(isIpOnly(generic)).toBe(false);
  });

  it('isCredentialsAndIp narrows to CredentialsAndIpAuthenticationMethod', () => {
    expect(isCredentialsAndIp(credAndIp)).toBe(true);
    expect(isCredentialsAndIp(ipOnly)).toBe(false);
    expect(isCredentialsAndIp(twilio)).toBe(false);
    expect(isCredentialsAndIp(generic)).toBe(false);
  });

  it('isTwilio narrows to TwilioAuthenticationMethod', () => {
    expect(isTwilio(twilio)).toBe(true);
    expect(isTwilio(ipOnly)).toBe(false);
    expect(isTwilio(credAndIp)).toBe(false);
    expect(isTwilio(generic)).toBe(false);
  });

  it('isGenericAuth narrows to GenericAuthenticationMethod for unknown types', () => {
    expect(isGenericAuth(generic)).toBe(true);
    expect(isGenericAuth(ipOnly)).toBe(false);
    expect(isGenericAuth(credAndIp)).toBe(false);
    expect(isGenericAuth(twilio)).toBe(false);
  });

  it('type guards provide proper narrowing for TypeScript', () => {
    const method: AuthenticationMethod = ipOnly;
    if (isIpOnly(method)) {
      // TypeScript narrows to IpOnlyAuthenticationMethod
      expect(method.allowedSipIps).toEqual(['10.0.0.1/32']);
      expect(method.techPrefix).toBe('');
    }

    const method2: AuthenticationMethod = credAndIp;
    if (isCredentialsAndIp(method2)) {
      // TypeScript narrows to CredentialsAndIpAuthenticationMethod
      expect(method2.username).toBe('user');
      expect(method2.password).toBe('pass');
    }

    const method3: AuthenticationMethod = twilio;
    if (isTwilio(method3)) {
      // TypeScript narrows to TwilioAuthenticationMethod
      expect(method3.twilioAccountSid).toBe('AC123');
    }
  });
});
