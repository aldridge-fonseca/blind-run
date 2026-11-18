# Mobile target — status and findings

Attempted: run Kane CLI end-to-end on a **real mobile target** in CI
(`.github/workflows/mobile.yml`, `workflow_dispatch`, `runs-on: macos-15` arm64),
driving the Encore demo app packaged as a native WebView shell.

**Result: not proven.** CI gets as far as building the app, authenticating Kane,
installing Kane's managed mobile toolchain, and discovering a real device — but
no Kane objective has executed to `run_end` on a mobile device yet. Everything
below is real output; nothing is fabricated. Raw evidence is committed under
[`runs/mobile-2026-11-18/`](../runs/mobile-2026-11-18/).

## What works (verified in CI, run 44323245515)

- `npm i -g @testmuai/kane-cli` → kane-cli 0.10.6 on macos-15 arm64.
- `kane-cli login --username "$LT_USERNAME" --access-key "$LT_ACCESS_KEY"` → OK.
- `kane-cli doctor --target simulator --install` → installs Kane's managed
  mobile deps (Appium + drivers, ~104 MB).
- Encore builds as a static site (`pnpm --filter encore build --base=./`) and
  packages into:
  - an Android APK via Capacitor (`apps/mobile`, `@capacitor/* 8.6.2`, needs JDK 21), and
  - an unsigned iOS simulator `.app` via a minimal WKWebView shell
    (`apps/mobile/project.yml` + `Sources/EncoreApp.swift`, xcodegen +
    `xcodebuild -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO`), zipped to
    `encore-ios.zip`.
- `kane-cli devices list` discovers the provisioned devices on both targets:
  - Android: `{"name":"Pixel_8_Pro","os_version":"15","kind":"emulator"}`
  - iOS: `{"name":"iPhone 16 Pro","os_version":"18.5","kind":"simulator"}`
- Kane accepts the resolved `--device-name "iPhone 16 Pro" --os-version "18.5"`
  and reaches the device-boot stage (`stream_start` + `recording_state` events
  are emitted to NDJSON before it fails — see below).

## What blocks it — two independent walls

### 1. Android emulator: no hardware virtualization on `macos-15`

GitHub-hosted arm64 macOS runners do not expose Hypervisor.framework to the
VM, so QEMU cannot start. Real output
(`runs/mobile-2026-11-18/android-emulator-boot.log`):

```
HVF error: HV_UNSUPPORTED
qemu-system-aarch64-headless: failed to initialize HVF: Invalid argument
WARNING      | QEMU main loop exits abnormally with code 1
```

This is a platform limitation of the hosted runner, not a configuration issue:
Kane's toolchain, the AVD (`Pixel_8_Pro`, API 35, arm64 google_apis image), and
the APK all work — there is simply no hypervisor to run the guest. Android in
CI would need a self-hosted runner with virtualization, or a cloud-device
provider.

### 2. iOS simulator: boot-state race + toolchain re-check flake

iOS Simulator is a native arm64 process (no hypervisor needed), so it is the
viable hosted-runner path — and it got furthest. Two failures remain:

**Sighted lane** (`runs/mobile-2026-11-18/kane-sighted.stderr.log`):

```
booting iPhone 16 Pro…
Could not boot iPhone 16 Pro: Device boot failed
An error was encountered processing the command (domain=com.apple.CoreSimulator.SimError, code=405):
Unable to boot device in current state: Booted
```

SimError 405 = the device was already booted. The workflow pre-boots the
simulator during provisioning (`apps/mobile/scripts/ensure-sim.mjs`); Kane then
issues its own `simctl boot`, which errors on an already-booted device, and
Kane treats it as fatal instead of proceeding.

**Blind lane** (`runs/mobile-2026-11-18/kane-blind.stderr.log`), minutes later
in the same job:

```
Ios toolchain
 ✓ Xcode — Xcode 16.4
 ✗ xcrun — xcrun cannot run simctl: Command failed: xcrun simctl help
Mobile toolchain not ready (xcrun).
```

`xcrun` worked for the sighted lane's checks in the same job (it reached
device boot), so this looks like CoreSimulator left in a bad state after the
405, rather than a persistent toolchain problem.

**Next fix (untested — run budget exhausted):** shut the simulator down after
provisioning (`xcrun simctl shutdown all`) so Kane performs its own boot, and
verify `xcrun simctl` once more immediately before each Kane invocation.

## How to reproduce

```
gh workflow run mobile.yml -f target=simulator -f lanes=both
# or: -f target=emulator  (fails at boot: HV_UNSUPPORTED, above)
gh run watch; gh run download <id> -n mobile-evidence-<id>
```

Inputs: `target` (simulator|emulator), `lanes` (both|sighted|blind),
`device_name`/`os_version` (default `auto`), `setup_only`.

## Cost

8 workflow runs; ~25 Kane credits consumed (all failures occurred before or at
device dispatch — no objective ever reached step execution).
