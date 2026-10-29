import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sprout, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { loadMarket } from "@/lib/market";
import ProductGrid from "@/components/market/ProductGrid";
import farmPhoto from "@/assets/farm-market.jpg";

const Index = () => {
  const navigate = useNavigate();
  const products = useQuery({ queryKey: ['public-market'], queryFn: () => loadMarket() });

  return (
    <div className="min-h-screen bg-background">
      <header className="container py-5 flex justify-between items-center gap-4"><Link to="/" className="flex items-center gap-2 font-semibold text-lg"><Sprout className="text-success"/>Agrocrest Farm</Link><Button variant="ghost" onClick={()=>navigate('/shop')}>Farm shop <ArrowRight className="ml-2 h-4 w-4"/></Button></header>
      <section className="market-hero relative min-h-[480px] flex items-center overflow-hidden"><img src={farmPhoto} alt="Chickens and fresh eggs on a farm" width={1536} height={1024} className="absolute inset-0 w-full h-full object-cover"/><div className="market-hero-shade absolute inset-0"/><div className="container relative py-16"><div className="max-w-xl space-y-6"><p className="text-sm uppercase">From our farm, to your table</p><h1 className="text-5xl sm:text-6xl font-bold">Agrocrest Farm</h1><p className="text-lg max-w-md">Farm-raised poultry, eggs and livestock. Choose your variety and shop directly from our latest collection.</p><div className="flex gap-3 flex-wrap"><Button size="lg" onClick={()=>navigate('/shop')}>Buy / Explore products <ArrowRight className="ml-2 h-4 w-4"/></Button><Button size="lg" variant="secondary" onClick={()=>navigate('/auth')}>Get Started</Button></div></div></div></section>
      <section className="container py-12 space-y-7"><div className="flex items-center justify-between gap-4"><div><p className="text-sm uppercase text-muted-foreground">Fresh from Agrocrest</p><h2 className="text-3xl font-semibold mt-2">Recently added</h2></div><Button variant="outline" onClick={()=>navigate('/shop')}>View all <ArrowRight className="ml-2 h-4 w-4"/></Button></div>{products.isLoading?<p>Loading products…</p>:products.isError?<p className="text-destructive">Our products could not load. <Button variant="outline" onClick={()=>products.refetch()}>Try again</Button></p>:products.data?.length?<ProductGrid products={products.data.slice(0,3)} onSelect={()=>navigate('/shop')}/>:<p className="py-10 border-y text-muted-foreground">Our next collection is on its way. Visit the farm shop for availability.</p>}</section>
      <footer className="border-t"><div className="container py-6 flex justify-between flex-wrap gap-4 text-sm text-muted-foreground"><span>Agrocrest Farm</span><Link to="/auth">Farm account</Link></div></footer>
    </div>
  );
};

export default Index;
