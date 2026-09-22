import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function verifyReleaseBack(
  t: test.TestContext,
  applicationBack: string | undefined,
  activityBack?: string,
) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aisw-back-manifest-"));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(temporaryRoot)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temporaryRoot).startsWith("aisw-back-manifest-"));
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });
  const script = path.join(temporaryRoot, "scripts", "verify-android-release-manifest.mjs");
  const manifest = path.join(temporaryRoot,
    "android/app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml");
  fs.mkdirSync(path.dirname(script), { recursive: true });
  fs.mkdirSync(path.dirname(manifest), { recursive: true });
  fs.copyFileSync(path.join(frontendRoot, "scripts/verify-android-release-manifest.mjs"), script);
  const backAttribute = (value: string | undefined) => value === undefined
    ? "" : `android:enableOnBackInvokedCallback="${value}"`;
  fs.writeFileSync(manifest, `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-sdk android:targetSdkVersion="36" />
    <application android:allowBackup="false" android:usesCleartextTraffic="false" ${backAttribute(applicationBack)}>
      <activity android:name="kr.ac.sogang.aisw.campus.MainActivity" ${backAttribute(activityBack)} />
      <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="default" />
    </application>
  </manifest>`);
  const result = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(result.error, undefined);
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

test("release gate rejects Android 16 builds without the JS BackHandler compatibility setting", (t) => {
  for (const value of [undefined, "true"]) {
    const result = verifyReleaseBack(t, value);
    assert.notEqual(result.status, 0, `accepted an unsafe native back setting: ${value}`);
    assert.match(result.output, /back|Back/);
  }
});

test("release gate accepts the SDK 54 back compatibility setting", (t) => {
  const result = verifyReleaseBack(t, "false");
  assert.equal(result.status, 0, result.output);
});

test("MainActivity cannot override the application's back compatibility setting", (t) => {
  const result = verifyReleaseBack(t, "false", "true");
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /back|Back/);
});
