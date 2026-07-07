import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, X, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { uploadMortalityPhoto, UploadedMortalityPhoto } from "@/lib/photoUpload";

interface Props {
  value: UploadedMortalityPhoto[];
  onChange: (photos: UploadedMortalityPhoto[]) => void;
  minRequired?: number;
  idSuffix?: string;
}

const MortalityPhotoPicker = ({ value, onChange, minRequired = 1, idSuffix = "" }: Props) => {
  const [uploading, setUploading] = useState(false);
  const inputId = `mortality-photo-input-${idSuffix}`;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const hashes = new Set(value.map((p) => p.hash));
    const next = [...value];
    for (const f of Array.from(files)) {
      const result = await uploadMortalityPhoto(f, hashes);
      if (result === "duplicate") {
        toast.error(`"${f.name}" was already uploaded — please use a unique picture of the actual dead animal.`);
        continue;
      }
      if (!result) {
        toast.error(`Failed to upload "${f.name}"`);
        continue;
      }
      hashes.add(result.hash);
      next.push(result);
    }
    onChange(next);
    setUploading(false);
    // reset input so same file can be re-picked if needed
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (input) input.value = "";
  };

  const remove = (hash: string) => {
    onChange(value.filter((p) => p.hash !== hash));
  };

  return (
    <div className="space-y-2">
      <Label>
        Photo Evidence <span className="text-destructive">*</span>
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          (at least {minRequired} — auto-compressed to ~2MB)
        </span>
      </Label>
      <div className="rounded-md border border-warning/40 bg-warning/5 p-2 text-xs text-warning-foreground flex gap-2">
        <AlertCircle className="h-4 w-4 flex-shrink-0 text-warning" />
        <span>
          Upload a clear photo of <strong>the actual dead animal</strong>. Duplicate images are rejected.
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {value.map((p) => (
          <div key={p.hash} className="relative w-20 h-20 rounded-md overflow-hidden border group">
            <img src={p.url} alt="evidence" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => remove(p.hash)}
              className="absolute top-0 right-0 bg-destructive text-destructive-foreground p-0.5 rounded-bl-md opacity-90 hover:opacity-100"
              aria-label="Remove photo"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <label
          htmlFor={inputId}
          className="w-20 h-20 rounded-md border-2 border-dashed border-input flex items-center justify-center cursor-pointer hover:bg-muted"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5 text-muted-foreground" />}
        </label>
      </div>

      <input
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {value.length < minRequired && (
        <p className="text-xs text-destructive">At least {minRequired} photo is required.</p>
      )}
    </div>
  );
};

export default MortalityPhotoPicker;
