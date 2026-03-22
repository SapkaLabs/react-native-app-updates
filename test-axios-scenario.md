# Analysis Scenario: Why axios ^1.13.2 -> ^1.13.6 rewrite occurs

## Key Facts:
1. axios is NOT directly in package.json of root or example
2. yarn.lock is NOT currently in version control (or if it is, doesn't have axios)
3. Using yarn@4.13.0 with nodeLinker: node-modules
4. Using yarn install --immutable in CI
5. GitHub Actions setup action caches node_modules based on yarn.lock hash

## The Problem Cycle:
When using GitHub Actions PR mode with caching:

1. A PR adds/updates a dependency that pulls in axios@^1.13.2
2. The lock file is generated with axios@1.13.2 
3. But between PR creation and CI run, axios 1.13.6 is released
4. GitHub Actions cache key hash changes because yarn.lock changed
5. Fresh install attempts to resolve axios
6. With resolution, yarn sees ^1.13.2 constraint but 1.13.6 is now available
7. In "hardened" or strict resolution, it picks the latest (1.13.6)
8. yarn install --immutable fails because it tries to modify yarn.lock

## Root Causes:
1. yarn.lock not committed to git (missing from version control)
2. OR inconsistent resolution strategy between CI and local
3. OR presence of transitive dependency with broad semver range
4. OR npm registry returning different package lists in different contexts
