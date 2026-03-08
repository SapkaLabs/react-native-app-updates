const test = require('node:test');
const assert = require('node:assert/strict');

const {
  compareComparableVersions,
} = require('../.test-dist/src/internal/versioning.js');
const {
  createInternalLogger,
} = require('../.test-dist/src/internal/logger.js');

test('compareComparableVersions strips semver suffixes', () => {
  const result = compareComparableVersions(
    { version: '1.2.3-beta+7' },
    { version: '1.2.4+3' }
  );

  assert.equal(result.ok, true);
  assert.equal(result.comparison < 0, true);
});

test('compareComparableVersions uses build numbers as a tiebreaker', () => {
  const result = compareComparableVersions(
    { buildNumber: '10', version: '1.2.3' },
    { buildNumber: '11', version: '1.2.3' }
  );

  assert.equal(result.ok, true);
  assert.equal(result.comparison < 0, true);
});

test('compareComparableVersions rejects invalid numeric segments', () => {
  const result = compareComparableVersions(
    { version: '1.2.x' },
    { version: '1.2.3' }
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.source, 'installed');
  assert.equal(result.error.field, 'version');
});

test('createInternalLogger gates debug messages behind verbose', () => {
  const calls = [];
  const logger = createInternalLogger({
    logger: {
      debug(message, context) {
        calls.push(['debug', message, context]);
      },
      error(message, context) {
        calls.push(['error', message, context]);
      },
      info(message, context) {
        calls.push(['info', message, context]);
      },
      warn(message, context) {
        calls.push(['warn', message, context]);
      },
    },
    verbose: false,
  });

  logger.debug('debug', { scope: 'test' });
  logger.info('info');
  logger.warn('warn');
  logger.error('error');

  assert.deepEqual(
    calls.map(([level]) => level),
    ['info', 'warn', 'error']
  );
});
