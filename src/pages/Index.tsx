import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sprout, BarChart3, Package, Shield } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/10">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto space-y-8">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sprout className="h-12 w-12 text-primary" />
            </div>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-4">
            Agrocrest Farm Management
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Complete farm management system for livestock tracking, production monitoring, sales records, and financial analytics
          </p>

          <div className="flex justify-center gap-4 pt-6">
            <Button size="lg" onClick={() => navigate("/auth")}>
              Get Started
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-6 pt-12">
            <div className="p-6 bg-card rounded-xl border border-border">
              <BarChart3 className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-lg mb-2">Analytics Dashboard</h3>
              <p className="text-sm text-muted-foreground">Real-time insights and profit tracking</p>
            </div>
            <div className="p-6 bg-card rounded-xl border border-border">
              <Package className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-lg mb-2">Inventory Management</h3>
              <p className="text-sm text-muted-foreground">Track livestock, feed, and resources</p>
            </div>
            <div className="p-6 bg-card rounded-xl border border-border">
              <Shield className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-lg mb-2">Role-Based Access</h3>
              <p className="text-sm text-muted-foreground">Admin and worker permissions</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
