import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const backendModule = createRequire(import.meta.url)('../../../amplify/shared/errorMessage') as typeof import('../../../amplify/shared/errorMessage');
const { getErrorDetails, getErrorMessage, getErrorMessages } = backendModule;

test('error messages support native, plain, and primitive failures', () => {
  assert.equal(getErrorMessage(new Error('native')), 'native');
  assert.equal(getErrorMessage({ message: 'plain' }), 'plain');
  assert.equal(getErrorMessage('text'), 'text');
  assert.equal(getErrorMessage(null), 'Unknown error');
  assert.equal(getErrorMessage(42), '42');
});

test('SDK and GraphQL errors preserve diagnostic fields without trusting their types', () => {
  const details = getErrorDetails({
    message: 'Request failed', Code: 'NotFound', name: 'ServiceError',
    $metadata: { httpStatusCode: 404 },
    errors: [{ message: 'Missing record', errorType: 'NotFound' }, null],
  });
  assert.equal(details.code, 'NotFound');
  assert.equal(details.name, 'ServiceError');
  assert.equal(details.$metadata?.httpStatusCode, 404);
  assert.equal(details.errors[0].errorType, 'NotFound');
  assert.deepEqual(details.errors[1], { errors: [] });
  assert.deepEqual(getErrorMessages({ message: 'Request failed', errors: [{ message: 'Missing record' }] }),
    ['Request failed', 'Missing record']);
  const malformed = getErrorDetails({ message: 12, code: {}, errors: false, $metadata: { httpStatusCode: '404' } });
  assert.equal(malformed.message, undefined);
  assert.equal(malformed.code, undefined);
  assert.equal(malformed.$metadata, undefined);
  assert.deepEqual(malformed.errors, []);
  assert.deepEqual(getErrorDetails(undefined), { errors: [] });
});
