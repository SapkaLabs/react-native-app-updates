import { createInternalLogger } from '../src/internal/logger';
import { compareComparableVersions } from '../src/internal/versioning';

describe('versioning and logger utilities', () => {
  test('compareComparableVersions strips semver suffixes', () => {
    const result = compareComparableVersions(
      { version: '1.2.3-beta+7' },
      { version: '1.2.4+3' }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected a comparable version result.');
    }
    expect(result.comparison).toBeLessThan(0);
  });

  test('compareComparableVersions uses build numbers as a tiebreaker', () => {
    const result = compareComparableVersions(
      { buildNumber: '10', version: '1.2.3' },
      { buildNumber: '11', version: '1.2.3' }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected a comparable version result.');
    }
    expect(result.comparison).toBeLessThan(0);
  });

  test('compareComparableVersions rejects invalid numeric segments', () => {
    const result = compareComparableVersions(
      { version: '1.2.x' },
      { version: '1.2.3' }
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected a failed version comparison.');
    }
    expect(result.error.source).toBe('installed');
    expect(result.error.field).toBe('version');
  });

  test('createInternalLogger gates debug messages behind verbose', () => {
    const calls: Array<[string, string]> = [];
    const logger = createInternalLogger({
      logger: {
        debug(message) {
          calls.push(['debug', message]);
        },
        error(message) {
          calls.push(['error', message]);
        },
        info(message) {
          calls.push(['info', message]);
        },
        warn(message) {
          calls.push(['warn', message]);
        },
      },
      verbose: false,
    });

    logger.debug('debug', { scope: 'test' });
    logger.info('info');
    logger.warn('warn');
    logger.error('error');

    expect(calls.map(([level]) => level)).toEqual(['info', 'warn', 'error']);
  });
});
