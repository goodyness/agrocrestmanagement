import { NavLink } from 'react-router-dom';
import { Activity, Egg, Home, LogOut, Menu, Receipt, ShoppingBasket, Sprout, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export const managerPages = [
  { key: 'overview', label: 'Home', icon: Home },
  { key: 'production', label: 'Production', icon: Egg },
  { key: 'expenses', label: 'Expenses', icon: Receipt },
  { key: 'sales', label: 'Sales', icon: ShoppingBasket },
  { key: 'mortality', label: 'Mortality', icon: Activity },
  { key: 'notes', label: 'Notes', icon: StickyNote },
];

export default function ManagerNavigation({ open, setOpen, signOut }: { open: boolean; setOpen: (open: boolean) => void; signOut: () => void }) {
  return <>
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-16 border-r bg-card flex-col items-center gap-3 py-5 z-30" aria-label="Quick navigation">
      <Button variant="ghost" size="icon" title="Open navigation" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></Button>
      {managerPages.map(item => <Button key={item.key} asChild variant="ghost" size="icon" title={item.label}><NavLink to={`/dashboard/manager/${item.key}`} className={({ isActive }) => isActive ? 'bg-accent text-accent-foreground' : ''} aria-label={item.label}><item.icon className="h-5 w-5" /></NavLink></Button>)}
    </aside>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-72 max-w-[85vw] flex flex-col">
        <SheetHeader className="text-left"><Sprout className="h-8 w-8 text-primary mb-3" /><SheetTitle>Agrocrest Farm</SheetTitle><p className="text-sm text-muted-foreground">Farm Manager</p></SheetHeader>
        <nav className="space-y-2 mt-8" aria-label="Manager navigation">{managerPages.map(item => <Button key={item.key} asChild variant="ghost" className="w-full justify-start gap-3"><NavLink to={`/dashboard/manager/${item.key}`} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'bg-accent text-accent-foreground' : ''}><item.icon className="h-5 w-5" />{item.label}</NavLink></Button>)}</nav>
        <Button variant="ghost" className="mt-auto justify-start gap-3" onClick={signOut}><LogOut className="h-5 w-5" />Sign out</Button>
      </SheetContent>
    </Sheet>
  </>;
}