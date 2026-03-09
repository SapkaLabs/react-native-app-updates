const RELEASE_TYPE_PRIORITY = {
  patch: 1,
  minor: 2,
  major: 3,
};

function getReleaseTypeFromLabel(label) {
  switch (String(label).trim().toLowerCase()) {
    case 'release:major':
      return 'major';
    case 'release:minor':
      return 'minor';
    case 'release:patch':
      return 'patch';
    default:
      return null;
  }
}

function resolveReleaseType(labels = []) {
  let releaseType = 'patch';

  for (const label of labels) {
    const candidate = getReleaseTypeFromLabel(label);

    if (
      candidate &&
      RELEASE_TYPE_PRIORITY[candidate] > RELEASE_TYPE_PRIORITY[releaseType]
    ) {
      releaseType = candidate;
    }
  }

  return releaseType;
}

module.exports = {
  getReleaseTypeFromLabel,
  resolveReleaseType,
};
