import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { hashKey } from '@tanstack/react-query';
import { acquireSubscriptions } from './sharedSubscriptions';

test('equivalent filters share listeners until the last consumer leaves', () => {
  const owner = {};
  let starts = 0;
  let stops = 0;
  const start = () => {
    starts += 1;
    return Array.from({ length: 3 }, () => ({ unsubscribe: () => { stops += 1; } }));
  };
  const first = acquireSubscriptions(owner, hashKey([{ projectId: 'a', userId: 'b' }]), start);
  const second = acquireSubscriptions(owner, hashKey([{ userId: 'b', projectId: 'a' }]), start);
  assert.equal(starts, 1);
  first();
  first(); // Cleanup is safe to call twice.
  assert.equal(stops, 0);
  second();
  assert.equal(stops, 3);
  const remount = acquireSubscriptions(owner, hashKey([{ userId: 'b', projectId: 'a' }]), start);
  assert.equal(starts, 2);
  remount();
  assert.equal(stops, 6);
});

test('separate query clients and filters own independent subscriptions', () => {
  let starts = 0;
  let stops = 0;
  const start = () => {
    starts += 1;
    return [{ unsubscribe: () => { stops += 1; } }];
  };
  const owner = {};
  const releases = [
    acquireSubscriptions(owner, 'first', start),
    acquireSubscriptions(owner, 'second', start),
    acquireSubscriptions({}, 'first', start),
  ];
  assert.equal(starts, 3);
  releases.forEach((release) => release());
  assert.equal(stops, 3);
});
