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

function normalizeNonEmptyString(value) {
  const normalizedValue = String(value ?? '').trim();

  return normalizedValue ? normalizedValue : null;
}

function resolvePublishTag({
  workflowDispatchTag,
  releaseTag,
  latestReleaseTag,
} = {}) {
  return (
    normalizeNonEmptyString(workflowDispatchTag) ??
    normalizeNonEmptyString(releaseTag) ??
    normalizeNonEmptyString(latestReleaseTag)
  );
}

module.exports = {
  getReleaseTypeFromLabel,
  resolvePublishTag,
  resolveReleaseType,
};
