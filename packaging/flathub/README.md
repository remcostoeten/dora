# Flathub submission

`io.github.remcostoeten.dora.yml` is the manifest for a Flathub submission. It wraps the released `.deb`, the same binary as every other Linux channel, and carries `x-checker-data` so the Flathub bot opens an update PR for each new release once the app is accepted.

Until it is on Flathub, the signed remote at `https://remcostoeten.github.io/dora/flatpak/` (published by `.github/workflows/apt.yml`) is the Flatpak channel.

## Submitting

1. Fork `flathub/flathub` and branch from `new-pr`.
2. Copy this manifest, `flathub.json` (it limits the build to x86_64 until an aarch64 source exists), plus `packaging/flatpak/io.github.remcostoeten.dora.desktop` and `packaging/flatpak/io.github.remcostoeten.dora.metainfo.xml` into the fork. Replace `@VERSION@` and `@DATE@` in the metainfo with the release the manifest points at.
3. Open the pull request against `new-pr`, then answer the review. Reviewers usually ask about `--filesystem=home` (Dora opens SQLite, DuckDB, CSV and Parquet files anywhere) and about shipping a prebuilt binary instead of building from source.
4. After the merge Flathub creates `flathub/io.github.remcostoeten.dora` and makes you a maintainer. The `io.github.remcostoeten` ID is verified through the GitHub account.

aarch64 is left out until the arm64 Linux build has shipped in a release. Then add a second `type: file` source with `only-arches: [aarch64]` pointing at `Dora_<version>_arm64.deb`, and remove `flathub.json`.
