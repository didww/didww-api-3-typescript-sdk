import { afterEach } from 'vitest';
import nock from 'nock';
import { cleanupNock } from './helpers/vcr.js';
import { resetAuthStateForTests } from '../src/auth/state.js';

// Requests to anything but the local stub servers fail fast instead of
// reaching the network (an unexpected token request included).
nock.disableNetConnect();
nock.enableNetConnect(/^(127\.0\.0\.1|localhost)(:\d+)?$/);

afterEach(() => {
  cleanupNock();
  resetAuthStateForTests();
});
