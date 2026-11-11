# Vendored TypeDoc

`typedoc-0.28.20-pr3151-529c394.tgz` is a development dependency for generating the SDK reference. It was built from TypeDoc PR 3151 at `529c39478acca1a1e7a9901bdf70c48a04696279`. The PR adapts recursive glob matching to the public minimatch 11 API. The package includes the upstream Apache-2.0 license. [Upstream change](https://github.com/TypeStrong/typedoc/pull/3151)

Rebuild with Node 22.15.0 and pnpm 10.33.0 using the lockfile at that commit. Run `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm run build:prod` and `npm pack --ignore-scripts`. npm validates the package integrity recorded in the SDK lockfile.

The archive SHA-256 is `b4ce718cf6c415697e3c7b3565be8f8abe15e7d4ca8301c5b7dcd16253ab13b2`. Replace the archive with a published TypeDoc dependency once its release includes the migration.
