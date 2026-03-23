const {
  getReleaseTypeFromLabel,
  resolvePublishTag,
  resolveReleaseType,
} = require('../scripts/release-utils.js');

describe('release-utils', () => {
  test('getReleaseTypeFromLabel recognizes supported release labels', () => {
    expect(getReleaseTypeFromLabel('release:patch')).toBe('patch');
    expect(getReleaseTypeFromLabel('release:minor')).toBe('minor');
    expect(getReleaseTypeFromLabel('release:major')).toBe('major');
  });

  test('getReleaseTypeFromLabel ignores unsupported labels and normalizes case', () => {
    expect(getReleaseTypeFromLabel(' Release:Minor ')).toBe('minor');
    expect(getReleaseTypeFromLabel('kind:feature')).toBeNull();
  });

  test('resolveReleaseType defaults to patch when no release label is present', () => {
    expect(resolveReleaseType([])).toBe('patch');
    expect(resolveReleaseType(['bug', 'documentation'])).toBe('patch');
  });

  test('resolveReleaseType picks the highest semantic bump from PR labels', () => {
    expect(resolveReleaseType(['release:patch', 'release:minor'])).toBe(
      'minor'
    );
    expect(resolveReleaseType(['release:minor', 'release:major'])).toBe(
      'major'
    );
  });

  test('resolvePublishTag prefers the manual workflow tag over release metadata', () => {
    expect(
      resolvePublishTag({
        workflowDispatchTag: ' v1.2.3 ',
        releaseTag: 'v1.2.2',
        latestReleaseTag: 'v1.2.1',
      })
    ).toBe('v1.2.3');
  });

  test('resolvePublishTag falls back to release and latest release tags', () => {
    expect(
      resolvePublishTag({
        releaseTag: ' v1.2.2 ',
        latestReleaseTag: 'v1.2.1',
      })
    ).toBe('v1.2.2');
    expect(resolvePublishTag({ latestReleaseTag: 'v1.2.1' })).toBe('v1.2.1');
  });

  test('resolvePublishTag returns null when no publishable tag is available', () => {
    expect(
      resolvePublishTag({
        workflowDispatchTag: '   ',
        releaseTag: '',
        latestReleaseTag: null,
      })
    ).toBeNull();
  });
});

export {};
