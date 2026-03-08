export interface ComparableVersionInput {
  readonly buildNumber?: string;
  readonly version: string;
}

export interface ComparableVersionError {
  readonly field: 'buildNumber' | 'version';
  readonly message: string;
  readonly source: 'available' | 'installed';
}

interface NormalizedVersion {
  readonly parts: readonly number[];
}

export type VersionComparisonResult =
  | {
      readonly comparison: number;
      readonly ok: true;
    }
  | {
      readonly error: ComparableVersionError;
      readonly ok: false;
    };

export function compareComparableVersions(
  installed: ComparableVersionInput,
  available: ComparableVersionInput
): VersionComparisonResult {
  const installedVersion = normalizeVersion(
    installed.version,
    'installed',
    'version'
  );
  if (!installedVersion.ok) {
    return installedVersion;
  }

  const availableVersion = normalizeVersion(
    available.version,
    'available',
    'version'
  );
  if (!availableVersion.ok) {
    return availableVersion;
  }

  const versionComparison = compareNormalizedVersionParts(
    installedVersion.value.parts,
    availableVersion.value.parts
  );
  if (versionComparison !== 0) {
    return {
      comparison: versionComparison,
      ok: true,
    };
  }

  if (!installed.buildNumber || !available.buildNumber) {
    return {
      comparison: 0,
      ok: true,
    };
  }

  const installedBuild = normalizeVersion(
    installed.buildNumber,
    'installed',
    'buildNumber'
  );
  if (!installedBuild.ok) {
    return installedBuild;
  }

  const availableBuild = normalizeVersion(
    available.buildNumber,
    'available',
    'buildNumber'
  );
  if (!availableBuild.ok) {
    return availableBuild;
  }

  return {
    comparison: compareNormalizedVersionParts(
      installedBuild.value.parts,
      availableBuild.value.parts
    ),
    ok: true,
  };
}

function normalizeVersion(
  input: string,
  source: ComparableVersionError['source'],
  field: ComparableVersionError['field']
):
  | {
      readonly ok: false;
      readonly error: ComparableVersionError;
    }
  | {
      readonly ok: true;
      readonly value: NormalizedVersion;
    } {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      error: {
        field,
        message: `${field} must not be empty.`,
        source,
      },
      ok: false,
    };
  }

  const semanticCore = stripSemanticSuffixes(trimmed);
  const parts = semanticCore.split('.');
  if (parts.length === 0 || parts.some((part) => part.length === 0)) {
    return {
      error: {
        field,
        message: `${field} must use dot-separated numeric segments.`,
        source,
      },
      ok: false,
    };
  }

  const numericParts: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      return {
        error: {
          field,
          message: `${field} contains a non-numeric segment: "${part}".`,
          source,
        },
        ok: false,
      };
    }

    numericParts.push(Number.parseInt(part, 10));
  }

  return {
    ok: true,
    value: {
      parts: numericParts,
    },
  };
}

function stripSemanticSuffixes(version: string): string {
  const buildIndex = version.indexOf('+');
  const withoutBuild =
    buildIndex === -1 ? version : version.slice(0, buildIndex);
  const prereleaseIndex = withoutBuild.indexOf('-');

  return prereleaseIndex === -1
    ? withoutBuild
    : withoutBuild.slice(0, prereleaseIndex);
}

function compareNormalizedVersionParts(
  left: readonly number[],
  right: readonly number[]
): number {
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = left[index] ?? 0;
    const rightPart = right[index] ?? 0;

    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }

  return 0;
}
