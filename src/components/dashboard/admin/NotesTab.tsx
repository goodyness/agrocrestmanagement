import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/contexts/BranchContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Edit, Trash2, Save, X, StickyNote, Clock, Image, Upload, XCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  image_url: string | null;
  branch_id: string | null;
}

export function NotesTab() {
  const queryClient = useQueryClient();
  const { currentBranchId } = useBranch();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState({ title: "", content: "" });
  const [editNote, setEditNote] = useState({ title: "", content: "" });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [editSelectedImage, setEditSelectedImage] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);

  const { data: notes, isLoading } = useQuery({
    queryKey: ["admin-notes", currentBranchId],
    queryFn: async () => {
      let query = supabase
        .from("admin_notes")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (currentBranchId) {
        query = query.eq("branch_id", currentBranchId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Note[];
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      const preview = URL.createObjectURL(file);
      if (isEdit) {
        setEditSelectedImage(file);
        setEditImagePreview(preview);
      } else {
        setSelectedImage(file);
        setImagePreview(preview);
      }
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    setUploadingImage(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `notes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("note-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("note-images")
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error: any) {
      toast.error("Failed to upload image: " + error.message);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const addMutation = useMutation({
    mutationFn: async (note: { title: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      let imageUrl: string | null = null;
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }
      
      const { error } = await supabase.from("admin_notes").insert({
        title: note.title,
        content: note.content,
        created_by: user.id,
        image_url: imageUrl,
        branch_id: currentBranchId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notes"] });
      setIsAdding(false);
      setNewNote({ title: "", content: "" });
      setSelectedImage(null);
      setImagePreview(null);
      toast.success("Note added successfully");
    },
    onError: (error) => {
      toast.error("Failed to add note: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, title, content }: { id: string; title: string; content: string }) => {
      let imageUrl: string | undefined;
      if (editSelectedImage) {
        imageUrl = await uploadImage(editSelectedImage) || undefined;
      }
      
      const updateData: any = { title, content };
      if (imageUrl) {
        updateData.image_url = imageUrl;
      }
      
      const { error } = await supabase
        .from("admin_notes")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notes"] });
      setEditingId(null);
      setEditNote({ title: "", content: "" });
      setEditSelectedImage(null);
      setEditImagePreview(null);
      toast.success("Note updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update note: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notes"] });
      setDeleteId(null);
      toast.success("Note deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete note: " + error.message);
    },
  });

  const handleAddNote = () => {
    if (!newNote.title.trim() || !newNote.content.trim()) {
      toast.error("Please fill in both title and content");
      return;
    }
    addMutation.mutate(newNote);
  };

  const handleEditNote = (note: Note) => {
    setEditingId(note.id);
    setEditNote({ title: note.title, content: note.content });
    setEditImagePreview(note.image_url);
  };

  const handleSaveEdit = () => {
    if (!editNote.title.trim() || !editNote.content.trim()) {
      toast.error("Please fill in both title and content");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...editNote });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditNote({ title: "", content: "" });
    setEditSelectedImage(null);
    setEditImagePreview(null);
  };

  const clearImage = (isEdit = false) => {
    if (isEdit) {
      setEditSelectedImage(null);
      setEditImagePreview(null);
    } else {
      setSelectedImage(null);
      setImagePreview(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Admin Notes & Observations</h2>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        )}
      </div>

      {/* Add New Note Form */}
      {isAdding && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <StickyNote className="h-5 w-5" />
              New Note
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Note title..."
              value={newNote.title}
              onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
            />
            <Textarea
              placeholder="Write your observation or note here..."
              value={newNote.content}
              onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
              rows={4}
            />
            
            {/* Image Upload */}
            <div className="space-y-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={(e) => handleImageSelect(e)}
                className="hidden"
              />
              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-48 rounded-lg border"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => clearImage()}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Image className="h-4 w-4 mr-2" />
                  Add Photo
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAddNote} disabled={addMutation.isPending || uploadingImage}>
                {uploadingImage ? (
                  <>
                    <Upload className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Note
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAdding(false);
                  setNewNote({ title: "", content: "" });
                  clearImage();
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading notes...</div>
      ) : notes && notes.length > 0 ? (
        <div className="grid gap-4">
          {notes.map((note) => (
            <Card key={note.id} className="relative">
              <CardHeader className="pb-2">
                {editingId === note.id ? (
                  <Input
                    value={editNote.title}
                    onChange={(e) => setEditNote({ ...editNote, title: e.target.value })}
                    className="font-semibold"
                  />
                ) : (
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <StickyNote className="h-4 w-4 text-primary" />
                      {note.title}
                    </span>
                    <div className="flex gap-2">
                      {editingId !== note.id && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditNote(note)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(note.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardTitle>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Created: {format(new Date(note.created_at), "MMM dd, yyyy 'at' h:mm a")}
                  </span>
                  {note.updated_at !== note.created_at && (
                    <span>
                      Updated: {format(new Date(note.updated_at), "MMM dd, yyyy 'at' h:mm a")}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editingId === note.id ? (
                  <div className="space-y-4">
                    <Textarea
                      value={editNote.content}
                      onChange={(e) => setEditNote({ ...editNote, content: e.target.value })}
                      rows={4}
                    />
                    
                    {/* Edit Image Upload */}
                    <div className="space-y-2">
                      <input
                        type="file"
                        ref={editFileInputRef}
                        accept="image/*"
                        onChange={(e) => handleImageSelect(e, true)}
                        className="hidden"
                      />
                      {editImagePreview ? (
                        <div className="relative inline-block">
                          <img
                            src={editImagePreview}
                            alt="Preview"
                            className="max-h-48 rounded-lg border"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-6 w-6"
                            onClick={() => clearImage(true)}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => editFileInputRef.current?.click()}
                        >
                          <Image className="h-4 w-4 mr-2" />
                          Add Photo
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveEdit}
                        disabled={updateMutation.isPending || uploadingImage}
                        size="sm"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                      <Button variant="outline" onClick={handleCancelEdit} size="sm">
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="whitespace-pre-wrap text-sm">{note.content}</p>
                    {note.image_url && (
                      <div className="mt-3">
                        <img
                          src={note.image_url}
                          alt="Note attachment"
                          className="max-h-64 rounded-lg border shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(note.image_url!, "_blank")}
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <StickyNote className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No notes yet. Add your first observation!</p>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
