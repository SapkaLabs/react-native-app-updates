const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getReleaseTypeFromLabel,
  resolveReleaseType,
} = require('../scripts/release-utils.js');

test('getReleaseTypeFromLabel recognizes supported release labels', () => {
  assert.equal(getReleaseTypeFromLabel('release:patch'), 'patch');
  assert.equal(getReleaseTypeFromLabel('release:minor'), 'minor');
  assert.equal(getReleaseTypeFromLabel('release:major'), 'major');
});

test('getReleaseTypeFromLabel ignores unsupported labels and normalizes case', () => {
  assert.equal(getReleaseTypeFromLabel(' Release:Minor '), 'minor');
  assert.equal(getReleaseTypeFromLabel('kind:feature'), null);
});

test('resolveReleaseType defaults to patch when no release label is present', () => {
  assert.equal(resolveReleaseType([]), 'patch');
  assert.equal(resolveReleaseType(['bug', 'documentation']), 'patch');
});

test('resolveReleaseType picks the highest semantic bump from PR labels', () => {
  assert.equal(resolveReleaseType(['release:patch', 'release:minor']), 'minor');
  assert.equal(resolveReleaseType(['release:minor', 'release:major']), 'major');
});
