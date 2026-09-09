import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const backendModule = createRequire(import.meta.url)('../../../../amplify/functions/workflowStats/readAuthorization') as typeof import('../../../../amplify/functions/workflowStats/readAuthorization');
const { authorizeWorkflowStatsItem, requireWorkflowStatsUser } = backendModule;

test('ordinary organization members can read statistics without admin roles', () => {
  const user = { sub: 'member', groups: ['organization-a'] };
  for (const item of [
    { organizationId: 'organization-a', runId: 'run' },
    { organizationId: 'organization-a', eventId: 'event' },
    { organizationId: 'organization-a', scopeKey: 'daily' },
  ]) assert.doesNotThrow(() => authorizeWorkflowStatsItem(user, item));
});

test('cross-organization and missing ownership are denied', () => {
  for (const user of [{ sub: 'member', groups: ['organization-a'] }, { sub: 'member', groups: [] }]) {
    assert.throws(() => authorizeWorkflowStatsItem(user, { organizationId: 'organization-b' }), /Unauthorized/);
    assert.throws(() => authorizeWorkflowStatsItem(user, {}), /Unauthorized/);
  }
});

test('sysadmins retain access to all organizations and legacy records', () => {
  const user = { sub: 'admin', groups: ['sysadmin'] };
  assert.doesNotThrow(() => authorizeWorkflowStatsItem(user, { organizationId: 'organization-b' }));
  assert.doesNotThrow(() => authorizeWorkflowStatsItem(user, {}));
});

test('anonymous and non-user identities cannot use reporting queries', () => {
  for (const identity of [null, undefined, {}, { groups: ['sysadmin'] }, { sub: '', groups: ['sysadmin'] }]) {
    assert.throws(() => requireWorkflowStatsUser(identity), /Unauthorized/);
    assert.throws(() => authorizeWorkflowStatsItem(identity, { organizationId: 'organization-a' }), /Unauthorized/);
  }
});
