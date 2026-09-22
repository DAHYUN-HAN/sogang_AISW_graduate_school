import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [
  "android/app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml",
  "android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml",
].map((value) => path.join(projectRoot, value));
const manifestPath = candidates.find((candidate) => fs.existsSync(candidate));

if (!manifestPath) {
  console.error("Merged Android release manifest was not generated.");
  process.exit(1);
}

const manifest = fs.readFileSync(manifestPath, "utf8");
const errors = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};

const targetSdk = Number(manifest.match(/android:targetSdkVersion="(\d+)"/)?.[1]);
check(targetSdk >= 36, `Android targetSdkVersion must be at least 36; found ${targetSdk || "none"}.`);
check(/android:usesCleartextTraffic="false"/.test(manifest), "Cleartext traffic must be disabled.");
check(/android:allowBackup="false"/.test(manifest), "Android platform backup must be disabled.");
// Expo SDK 54 defaults to legacy back dispatch. RN 0.81's predictive callback
// can remain disabled after Home backgrounds the Activity, bypassing JS on resume.
const applicationTag = manifest.match(/<application\b[^>]*>/)?.[0] ?? "";
check(
  /android:enableOnBackInvokedCallback="false"/.test(applicationTag),
  "Android back compatibility requires enableOnBackInvokedCallback=false on the application.",
);
const activityTags = manifest.match(/<activity\b[^>]*>/g) ?? [];
for (const activity of activityTags) {
  if (/android:name="(?:\.MainActivity|kr\.ac\.sogang\.aisw\.campus\.MainActivity)"/.test(activity)) {
    const override = activity.match(/android:enableOnBackInvokedCallback="([^"]*)"/)?.[1];
    check(
      override === undefined || override === "false",
      "MainActivity must not override the application's Android back compatibility setting.",
    );
  }
}
for (const permission of [
  "android.permission.CAMERA",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.SYSTEM_ALERT_WINDOW",
]) {
  check(
    !new RegExp(`<uses-permission[^>]+android:name="${permission.replaceAll(".", "\\.")}"`).test(
      manifest,
    ),
    `Merged release manifest contains forbidden permission ${permission}.`,
  );
}
check(
  /com\.google\.firebase\.messaging\.default_notification_channel_id/.test(manifest),
  "Merged release manifest is missing the default notification channel.",
);

if (errors.length > 0) {
  console.error(errors.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Merged Android release manifest checks passed (target API ${targetSdk}).`);
