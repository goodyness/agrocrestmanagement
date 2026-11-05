import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ManagerNotes({ userId }: { userId: string }) {
  const qc = useQueryClient(); const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false); const [id, setId] = useState<string | null>(null); const [title, setTitle] = useState(''); const [content, setContent] = useState('');
  const notes = useQuery({ queryKey: ['manager-notes', userId, page], queryFn: async () => {
    const { data, error, count } = await supabase.from('manager_notes').select('*', { count: 'exact' }).eq('owner_id', userId).order('created_at', { ascending: false }).range(page * 15, page * 15 + 14);
    if (error) throw error; return { rows: data, count: count || 0 };
  } });
  const save = useMutation({ mutationFn: async () => {
    if (!title.trim() || !content.trim()) throw new Error('Enter a title and note');
    const result = id ? await supabase.from('manager_notes').update({ title: title.trim(), content: content.trim() }).eq('id', id) : await supabase.from('manager_notes').insert({ owner_id: userId, title: title.trim(), content: content.trim() });
    if (result.error) throw result.error;
  }, onSuccess: () => { setOpen(false); qc.invalidateQueries({ queryKey: ['manager-notes', userId] }); toast.success('Note saved'); }, onError: e => toast.error(e.message) });
  const remove = async (noteId: string) => {
    if (!window.confirm('Delete this note?')) return;
    const { error } = await supabase.from('manager_notes').delete().eq('id', noteId); if (error) return toast.error(error.message); qc.invalidateQueries({ queryKey: ['manager-notes', userId] });
  };
  return <div className="space-y-4"><div className="flex justify-between items-center"><h2 className="text-xl font-semibold">My Notes</h2><Button size="sm" onClick={() => { setId(null); setTitle(''); setContent(''); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />New note</Button></div>
    {notes.isLoading ? <p>Loading notes…</p> : notes.isError ? <div role="alert">Unable to load notes.<Button variant="outline" onClick={() => notes.refetch()}>Retry</Button></div> : !notes.data?.rows.length ? <div className="py-16 text-center text-muted-foreground"><StickyNote className="mx-auto mb-3 h-8 w-8" /><p>No notes yet</p></div> : <div className="grid gap-4 sm:grid-cols-2">{notes.data.rows.map(n => <Card key={n.id}><CardContent className="p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-semibold break-words min-w-0">{n.title}</h3><div className="flex shrink-0"><Button size="icon" variant="ghost" aria-label="Edit note" title="Edit note" onClick={() => { setId(n.id); setTitle(n.title); setContent(n.content); setOpen(true); }}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Delete note" title="Delete note" onClick={() => remove(n.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div><p className="text-xs text-muted-foreground mb-3">{format(new Date(n.created_at), 'dd MMM yyyy, HH:mm')}</p><p className="text-sm whitespace-pre-wrap break-words">{n.content}</p></CardContent></Card>)}</div>}
    {(notes.data?.count || 0) > 15 && <div className="flex justify-end items-center gap-3"><Button variant="outline" size="sm" disabled={!page} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-xs">{page + 1} / {Math.ceil((notes.data?.count || 0) / 15)}</span><Button variant="outline" size="sm" disabled={(page + 1) * 15 >= (notes.data?.count || 0)} onClick={() => setPage(page + 1)}>Next</Button></div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{id ? 'Edit note' : 'New note'}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}><div className="space-y-2"><Label htmlFor="note-title">Title</Label><Input id="note-title" required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="note-content">Note</Label><Textarea id="note-content" required maxLength={10000} rows={6} value={content} onChange={e => setContent(e.target.value)} /></div><Button disabled={save.isPending}>Save note</Button></form></DialogContent></Dialog>
  </div>;
}