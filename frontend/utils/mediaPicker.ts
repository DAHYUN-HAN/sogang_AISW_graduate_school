import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

import { mediaApi } from "../services/api";
import type { MediaAsset } from "../types";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_CONTENT_TYPES,
  assertAllowedDocumentContentTypes,
  assertUploadSize,
  inferDocumentContentType,
} from "./documentFiles";
import { nativeMultiImagePickerOptions, uploadAttachmentBatch } from "./postAttachments";
import { selectAndUploadProfileImage } from "./profileImagePicker";

type UploadProgress = (progress: number) => void;

export type ImageUploadBatchIssue = {
  uploadedCount: number;
  failedCount: number;
  skippedCount: number;
};

type PickAndUploadImagesOptions = {
  maxSelection?: number;
  retainSuccessfulUploads?: boolean;
  onBatchIssue?: (issue: ImageUploadBatchIssue) => void;
};

function fileNameFromUri(uri: string, fallback: string) {
  const name = uri.split("/").pop()?.split("?")[0];
  return name || fallback;
}

async function uploadPickedFile(
  file: File | { uri: string; name: string; type: string; size?: number | null },
  onProgress?: UploadProgress,
  isPrivate = false
) {
  // 사진이든 문서든 여기를 지나가므로 한 곳에서만 본다.
  assertUploadSize(file);
  const response = await mediaApi.upload(file, onProgress, isPrivate);
  return response.data;
}

function pickLocalFiles({ accept, multiple }: { accept?: string; multiple?: boolean }) {
  return new Promise<File[]>((resolve) => {
    const input = document.createElement("input");
    let settled = false;

    const cleanup = () => {
      window.removeEventListener("focus", handleWindowFocus);
      input.removeEventListener("change", handleChange);
      input.removeEventListener("cancel", handleCancel);
      input.remove();
    };

    const settle = (files: File[]) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(files);
    };

    const handleChange = () => {
      settle(Array.from(input.files ?? []));
    };

    const handleCancel = () => {
      settle([]);
    };

    const handleWindowFocus = () => {
      window.setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) {
          settle([]);
        }
      }, 600);
    };

    input.type = "file";
    input.accept = accept ?? "";
    input.multiple = Boolean(multiple);
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "0";
    input.style.width = "1px";
    input.style.height = "1px";
    input.style.opacity = "0";

    input.addEventListener("change", handleChange);
    input.addEventListener("cancel", handleCancel);
    window.addEventListener("focus", handleWindowFocus);
    document.body.appendChild(input);
    input.click();
  });
}

type DocumentUploadOptions = {
  multiple?: boolean;
  accept?: string;
  types?: string | string[];
};

export async function pickAndUploadDocuments(onProgress?: UploadProgress, isPrivate = false, options?: DocumentUploadOptions): Promise<MediaAsset[]> {
  // 증빙 이미지처럼 더 좁게 받는 자리가 아니면 안내한 4가지만 받는다. 선택
  // 대화상자에서 한 번 거르고, 고른 뒤에도 실제 형식을 다시 확인한다.
  const allowedTypes = options?.types ?? ATTACHMENT_CONTENT_TYPES;
  const accept = options?.accept ?? ATTACHMENT_ACCEPT;

  if (Platform.OS === "web") {
    const files = await pickLocalFiles({ accept, multiple: options?.multiple ?? true });
    const normalizedFiles = files.map((file) => {
      const type = inferDocumentContentType(file.name, file.type);
      return file.type === type
        ? file
        : new File([file], file.name, { type, lastModified: file.lastModified });
    });
    assertAllowedDocumentContentTypes(normalizedFiles, allowedTypes);
    normalizedFiles.forEach(assertUploadSize);
    return Promise.all(
      normalizedFiles.map((file) => uploadPickedFile(file, onProgress, isPrivate))
    );
  }

  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: options?.multiple ?? true,
    type: [...allowedTypes],
  });
  if (result.canceled) {
    return [];
  }

  const pickedFiles = result.assets.map((asset) => ({
    uri: asset.uri,
    name: asset.name || fileNameFromUri(asset.uri, "upload"),
    type: inferDocumentContentType(
      asset.name || fileNameFromUri(asset.uri, "upload"),
      asset.mimeType,
    ),
    size: asset.size,
  }));
  assertAllowedDocumentContentTypes(pickedFiles, allowedTypes);
  // 여러 개를 고르면 하나라도 크면 한 개도 올리지 않는다. 앞부분만 올라간 채로
  // 실패하면 사용자가 무엇이 올라갔는지 알 수 없다.
  pickedFiles.forEach(assertUploadSize);

  const uploaded: MediaAsset[] = [];
  for (const file of pickedFiles) {
    uploaded.push(
      await uploadPickedFile(file, onProgress, isPrivate)
    );
  }
  return uploaded;
}

async function uploadSelectedImages<T>(
  items: readonly T[],
  upload: (item: T) => Promise<MediaAsset>,
  options?: PickAndUploadImagesOptions,
) {
  const maxSelection = options?.maxSelection;
  const selectedItems = maxSelection === undefined
    ? items
    : items.slice(0, Math.max(0, Math.trunc(maxSelection)));

  if (!options?.retainSuccessfulUploads) {
    const skippedCount = Math.max(0, items.length - selectedItems.length);
    if (skippedCount > 0) {
      options?.onBatchIssue?.({ uploadedCount: selectedItems.length, failedCount: 0, skippedCount });
    }
    return Promise.all(selectedItems.map((item) => upload(item)));
  }

  const result = await uploadAttachmentBatch(items, upload, maxSelection);
  if (result.failedCount > 0 || result.skippedCount > 0) {
    options.onBatchIssue?.({
      uploadedCount: result.uploaded.length,
      failedCount: result.failedCount,
      skippedCount: result.skippedCount,
    });
  }
  if (result.failedCount > 0 && result.uploaded.length === 0) {
    throw result.firstError instanceof Error ? result.firstError : new Error("IMAGE_UPLOAD_FAILED");
  }
  return result.uploaded;
}

export async function pickAndUploadImages(
  onProgress?: UploadProgress,
  options?: PickAndUploadImagesOptions,
): Promise<MediaAsset[]> {
  if (Platform.OS === "web") {
    const files = await pickLocalFiles({ accept: "image/*", multiple: true });
    return uploadSelectedImages(files, (file) => uploadPickedFile(file, onProgress), options);
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("MEDIA_PERMISSION_DENIED");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    allowsMultipleSelection: true,
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.9,
    ...nativeMultiImagePickerOptions(options?.maxSelection),
  });
  if (result.canceled) {
    return [];
  }

  return uploadSelectedImages(
    result.assets,
    (asset) => uploadPickedFile(
      {
        uri: asset.uri,
        name: asset.fileName || fileNameFromUri(asset.uri, "album-image.jpg"),
        type: asset.mimeType || "image/jpeg",
        size: asset.fileSize,
      },
      onProgress,
    ),
    options,
  );
}

export async function pickAndUploadImage(onProgress?: UploadProgress): Promise<MediaAsset | null> {
  return selectAndUploadProfileImage({
    platform: Platform.OS,
    pickWebFile: async () => {
      const [file] = await pickLocalFiles({ accept: "image/*" });
      return file ?? null;
    },
    requestNativePermission: async () => {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return permission.granted;
    },
    pickNativeImage: async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      return result.canceled ? null : result.assets[0] ?? null;
    },
    upload: (file) => uploadPickedFile(file, onProgress),
  });
}

export async function pickAndUploadBannerImage(onProgress?: UploadProgress): Promise<MediaAsset | null> {
  if (Platform.OS === "web") {
    const [file] = await pickLocalFiles({ accept: "image/*" });
    return file ? uploadPickedFile(file, onProgress) : null;
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("MEDIA_PERMISSION_DENIED");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.9,
  });
  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  if (!asset) {
    return null;
  }
  return uploadPickedFile(
    {
      uri: asset.uri,
      name: asset.fileName || fileNameFromUri(asset.uri, "banner-image.jpg"),
      type: asset.mimeType || "image/jpeg",
      size: asset.fileSize,
    },
    onProgress
  );
}

export async function pickAndUploadContentImage(onProgress?: UploadProgress): Promise<MediaAsset | null> {
  return pickAndUploadBannerImage(onProgress);
}
