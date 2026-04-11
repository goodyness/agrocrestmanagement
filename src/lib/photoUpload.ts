import { supabase } from "@/integrations/supabase/client";

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
