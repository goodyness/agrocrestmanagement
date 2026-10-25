import { useEffect,useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Download, Copy, QrCode } from 'lucide-react';
import { toast } from 'sonner';
export default function BatchTraceTab({batch}:{batch:any}){
 const [image,setImage]=useState('');const url=`https://agrocrestmanagement.lovable.app/batch-trace/${batch.id}`;
 useEffect(()=>{QRCode.toDataURL(url,{width:600,margin:3,errorCorrectionLevel:'M'}).then(setImage).catch(()=>toast.error('Could not generate QR code'));},[url]);
 const download=()=>{const a=document.createElement('a');a.href=image;a.download=`agrocrest-batch-${batch.id.slice(0,8)}.png`;a.click();};
 return <section className="space-y-5"><h3 className="font-semibold text-lg flex items-center gap-2"><QrCode className="h-5 w-5"/>Batch traceability</h3><div className="flex flex-col sm:flex-row gap-6 items-start">{image&&<img src={image} width={240} height={240} className="max-w-full" alt="QR code for this batch's traceability record"/>}<div className="space-y-3"><p className="font-semibold capitalize">{batch.species_type||batch.species} · {batch.id.slice(0,8).toUpperCase()}</p><p className="text-sm text-muted-foreground">Source: {batch.source||'Not recorded'}</p><p className="text-sm text-muted-foreground">Arrival: {batch.date_acquired}</p><p className="text-sm">Access: administrator and assigned partner only</p><div className="flex gap-2"><Button variant="outline" onClick={download} disabled={!image}><Download className="h-4 w-4 mr-2"/>Download QR</Button><Button variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(url);toast.success('Traceability link copied');}catch{toast.error('Could not copy link');}}}><Copy className="h-4 w-4 mr-2"/>Copy link</Button></div></div></div></section>;
}