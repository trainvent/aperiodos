import { Firestore } from "@google-cloud/firestore";

let firestoreClient;

export function firestoreConfigured() {
  if (String(process.env.FIRESTORE_DISABLED || "").trim().toLowerCase() === "1") {
    return false;
  }
  return Boolean(
    process.env.FIRESTORE_PROJECT_ID ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      process.env.K_SERVICE,
  );
}

export function firestore() {
  if (!firestoreConfigured()) {
    throw new Error("Firestore is not configured on this server.");
  }
  if (!firestoreClient) {
    const projectId =
      process.env.FIRESTORE_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      undefined;
    const databaseId = process.env.FIRESTORE_DATABASE_ID || "(default)";
    firestoreClient = new Firestore({ projectId, databaseId });
  }
  return firestoreClient;
}
