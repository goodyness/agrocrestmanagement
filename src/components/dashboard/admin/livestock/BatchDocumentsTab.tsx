import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
type Document = { id: string; title: string; category: string; file_path: string; file_name: string; file_size: number; created_at: string };
export default function BatchDocumentsTab({ batchId, isAdmin }: { batchId: string; isAdmin: boolean }) {
  const [rows, setRows] = useState<Document[]>([]); const [title, setTitle] = useState(''); const [category, setCategory] = useState('Invoice'); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [page, setPage] = useState(1);
  const load = async () => { const { data, error } = await supabase.from('batch_documents').select('*').eq('batch_id', batchId).order('created_at', { ascending: false }); if (error) toast.error(error.message); else setRows(data || []); };
  useEffect(() => { load(); }, [batchId]);
  const upload = async (e: React.FormEvent) => {
    e.preventDefault(); if (!file || !title.trim()) return;
    if (file.size > 10 * 1024 * 1024) return toast.error('File must be 10MB or smaller');
    if (!/\.(pdf|png|jpe?g|docx|xlsx)$/i.test(file.name)) return toast.error('Choose PDF, JPG, PNG, DOCX or XLSX');
    setBusy(true); const { data: { user } } = await supabase.auth.getUser(); if (!user) { setBusy(false); return; }
    const path = `${batchId}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await supabase.storage.from('batch-documents').upload(path, file);
    if (error) { toast.error(error.message); setBusy(false); return; }
    const { error: insertError } = await supabase.from('batch_documents').insert({ batch_id: batchId, title: title.trim(), category, file_path: path, file_name: file.name, file_size: file.size, uploaded_by: user.id });
    if (insertError) { await supabase.storage.from('batch-documents').remove([path]); toast.error(insertError.message); } else { toast.success('Document saved privately'); setTitle(''); setFile(null); await load(); }
    setBusy(false);
  };
  const download = async (row: Document) => { const { data, error } = await supabase.storage.from('batch-documents').createSignedUrl(row.file_path, 60, { download: row.file_name }); if (error) toast.error(error.message); else if (data) window.open(data.signedUrl, '_blank', 'noopener,noreferrer'); };
  const remove = async (row: Document) => { if (!confirm(`Delete ${row.title}?`)) return; const { error } = await supabase.storage.from('batch-documents').remove([row.file_path]); if (error) return toast.error(error.message); const { error: metadataError } = await supabase.from('batch_documents').delete().eq('id', row.id); if (metadataError) return toast.error(metadataError.message); load(); };
  return <section className="space-y-5"><h3 className="font-semibold text-lg flex items-center gap-2"><FileText className="h-5 w-5"/>Batch documents</h3><form onSubmit={upload} className="grid sm:grid-cols-2 gap-4 border-b pb-5"><div><Label htmlFor="document-title">Document title</Label><Input id="document-title" value={title} onChange={e => setTitle(e.target.value)} required maxLength={200}/></div><div><Label>Category</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['Invoice', 'Veterinary', 'Certificate', 'Agreement', 'Other'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="batch-document-file">File · up to 10MB</Label><Input id="batch-document-file" key={file ? 'selected' : 'empty'} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" onChange={e => setFile(e.target.files?.[0] || null)} required/></div><Button type="submit" className="self-end" disabled={busy || !file}><Upload className="h-4 w-4 mr-2"/>{busy ? 'Uploading…' : 'Save document'}</Button></form><div className="divide-y">{rows.slice((page-1)*15,page*15).map(row => <div key={row.id} className="py-3 flex items-center gap-3"><FileText className="h-5 w-5 shrink-0 text-muted-foreground"/><div className="flex-1 min-w-0"><p className="font-medium break-words">{row.title}</p><p className="text-xs text-muted-foreground">{row.category} · {(row.file_size/1024).toFixed(0)}KB · {new Date(row.created_at).toLocaleDateString()}</p></div><Button size="icon" variant="outline" title="Download document" onClick={() => download(row)}><Download className="h-4 w-4"/></Button>{isAdmin && <Button size="icon" variant="ghost" title="Delete document" onClick={() => remove(row)}><Trash2 className="h-4 w-4"/></Button>}</div>)}{!rows.length && <p className="py-8 text-muted-foreground">No documents attached to this batch.</p>}</div>{rows.length>15 && <div className="flex items-center justify-end gap-3"><Button variant="outline" disabled={page===1} onClick={() => setPage(page-1)}>Previous</Button><span>{page} / {Math.ceil(rows.length/15)}</span><Button variant="outline" disabled={page*15>=rows.length} onClick={() => setPage(page+1)}>Next</Button></div>}</section>;
}