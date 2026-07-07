import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "./imageCompression";

export const uploadEvidencePhoto = async (file: File, folder: string): Promise<string | null> => {
  const ext = file.name.split(".").pop();
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from("evidence-photos")
    .upload(fileName, file, { cacheControl: "3600", upsert: false });

  if (error) {
    console.error("Upload error:", error);
    return null;
  }

  const { data } = supabase.storage.from("evidence-photos").getPublicUrl(fileName);
  return data.publicUrl;
};

export interface UploadedMortalityPhoto {
  url: string;
  hash: string;
}

/**
 * Compress an image, refuse duplicates (against existing mortality_records.photo_hashes
 * and against `alreadyHashed` from the same submission), upload to storage.
 * Returns null when the photo is a duplicate — caller shows the toast.
 */
export const uploadMortalityPhoto = async (
  file: File,
  alreadyHashed: Set<string>
): Promise<UploadedMortalityPhoto | "duplicate" | null> => {
  const { file: compressed, hash } = await compressImage(file);

  if (alreadyHashed.has(hash)) return "duplicate";

  const { data: existing } = await supabase
    .from("mortality_records")
    .select("id")
    .contains("photo_hashes", [hash])
    .limit(1);
  if (existing && existing.length > 0) return "duplicate";

  const path = `mortality/${hash}.jpg`;
  const { error } = await supabase.storage
    .from("evidence-photos")
    .upload(path, compressed, { cacheControl: "3600", upsert: false, contentType: "image/jpeg" });

  // If upload conflicts (same hash already uploaded), still treat as duplicate.
  if (error && !/already exists|duplicate/i.test(error.message)) {
    console.error("Mortality photo upload error:", error);
    return null;
  }

  const { data } = supabase.storage.from("evidence-photos").getPublicUrl(path);
  return { url: data.publicUrl, hash };
};
