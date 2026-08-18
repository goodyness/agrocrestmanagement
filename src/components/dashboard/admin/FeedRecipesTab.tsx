import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Plus, Trash2, ChefHat, Link2, Download } from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";
import { exportToCSV } from "@/lib/exportUtils";

interface Ingredient { ingredient_name: string; quantity_kg: string; cost_per_kg: string }

const naira = (v: number) => `₦${(Math.round(v * 100) / 100).toLocaleString()}`;

const FeedRecipesTab = () => {
  const { currentBranchId } = useBranch();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [feedByBatch, setFeedByBatch] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [species, setSpecies] = useState("broiler");
  const [stage, setStage] = useState("starter");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Ingredient[]>([{ ingredient_name: "", quantity_kg: "", cost_per_kg: "" }]);

  const [assignRecipe, setAssignRecipe] = useState("");
  const [assignBatch, setAssignBatch] = useState("");
  const [assignStart, setAssignStart] = useState(new Date().toISOString().split("T")[0]);

  const load = async () => {
    let rq = supabase.from("feed_recipes").select("*").order("created_at", { ascending: false });
    let bq = supabase.from("livestock_batches").select("*").eq("is_active", true).order("date_acquired", { ascending: false });
    if (currentBranchId) { rq = rq.eq("branch_id", currentBranchId); bq = bq.eq("branch_id", currentBranchId); }
    const [{ data: r }, { data: i }, { data: a }, { data: b }, { data: fc }] = await Promise.all([
      rq,
      supabase.from("feed_recipe_ingredients").select("*"),
      supabase.from("batch_feed_recipes").select("*").order("start_date", { ascending: false }),
      bq,
      supabase.from("feed_consumption").select("batch_id, quantity_used"),
    ]);
    setRecipes(r || []); setIngredients(i || []); setAssignments(a || []); setBatches(b || []);
    const map: Record<string, number> = {};
    (fc || []).forEach((f: any) => { if (f.batch_id) map[f.batch_id] = (map[f.batch_id] || 0) + Number(f.quantity_used || 0); });
    setFeedByBatch(map);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentBranchId]);

  const recipeStats = useMemo(() => {
    return recipes.map((r) => {
      const ing = ingredients.filter((i) => i.recipe_id === r.id);
      const totalKg = ing.reduce((s, i) => s + Number(i.quantity_kg || 0), 0);
      const totalCost = ing.reduce((s, i) => s + Number(i.quantity_kg || 0) * Number(i.cost_per_kg || 0), 0);
      return { ...r, ing, totalKg, totalCost, costPerKg: totalKg > 0 ? totalCost / totalKg : 0 };
    });
  }, [recipes, ingredients]);

  const batchCosting = useMemo(() => {
    return assignments.map((a) => {
      const recipe = recipeStats.find((r) => r.id === a.recipe_id);
      const batch = batches.find((b) => b.id === a.batch_id);
      if (!recipe || !batch) return null;
      const kg = feedByBatch[a.batch_id] || 0;
      const birds = Number(batch.current_quantity || batch.quantity || 0);
      const feedCost = kg * recipe.costPerKg;
      return {
        id: a.id,
        batchId: a.batch_id,
        batchLabel: `${batch.species}${batch.stage ? ` (${batch.stage})` : ""} • ${batch.date_acquired}`,
        recipeName: recipe.name,
        costPerKg: recipe.costPerKg,
        kg,
        birds,
        feedCost,
        costPerBird: birds > 0 ? feedCost / birds : 0,
        startDate: a.start_date,
      };
    }).filter(Boolean) as any[];
  }, [assignments, recipeStats, batches, feedByBatch]);

  const saveRecipe = async () => {
    if (!name.trim()) return toast.error("Recipe name is required");
    const valid = rows.filter((r) => r.ingredient_name.trim() && Number(r.quantity_kg) > 0);
    if (valid.length === 0) return toast.error("Add at least one ingredient");
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    const { data: recipe, error } = await supabase.from("feed_recipes").insert({
      name: name.trim(), target_species: species, stage, notes: notes || null,
      branch_id: currentBranchId, created_by: user.user?.id,
    }).select().single();
    if (error || !recipe) { setSaving(false); return toast.error("Failed to save recipe"); }
    const { error: ie } = await supabase.from("feed_recipe_ingredients").insert(
      valid.map((r) => ({ recipe_id: recipe.id, ingredient_name: r.ingredient_name.trim(), quantity_kg: Number(r.quantity_kg), cost_per_kg: Number(r.cost_per_kg || 0) }))
    );
    setSaving(false);
    if (ie) return toast.error("Recipe saved but ingredients failed");
    toast.success("Recipe created");
    setOpen(false); setName(""); setNotes(""); setRows([{ ingredient_name: "", quantity_kg: "", cost_per_kg: "" }]);
    load();
  };

  const deleteRecipe = async (id: string) => {
    const { error } = await supabase.from("feed_recipes").delete().eq("id", id);
    if (error) return toast.error("Failed to delete");
    toast.success("Recipe deleted");
    load();
  };

  const saveAssignment = async () => {
    if (!assignRecipe || !assignBatch) return toast.error("Pick a recipe and a batch");
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("batch_feed_recipes").insert({
      recipe_id: assignRecipe, batch_id: assignBatch, start_date: assignStart, assigned_by: user.user?.id,
    });
    if (error) return toast.error("Failed to assign recipe");
    toast.success("Recipe assigned to batch");
    setAssignOpen(false); setAssignRecipe(""); setAssignBatch("");
    load();
  };

  const removeAssignment = async (id: string) => {
    await supabase.from("batch_feed_recipes").delete().eq("id", id);
    load();
  };

  const compareData = recipeStats.map((r) => ({ name: r.name, "Cost per kg": +r.costPerKg.toFixed(2) }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ChefHat className="h-4 w-4 text-primary" /> Feed Formulation & Recipes
            </CardTitle>
            <CardDescription>Define recipes, compute cost per kg, assign to batches and compare feed cost per bird</CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Link2 className="h-4 w-4 mr-1" /> Assign</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign recipe to batch</DialogTitle>
                  <DialogDescription>Link a formulation to a live batch to track feed cost</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Recipe</Label>
                    <Select value={assignRecipe} onValueChange={setAssignRecipe}>
                      <SelectTrigger><SelectValue placeholder="Select recipe" /></SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {recipeStats.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} — {naira(r.costPerKg)}/kg</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Batch</Label>
                    <Select value={assignBatch} onValueChange={setAssignBatch}>
                      <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.species} • {b.quantity} • {b.date_acquired}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Start date</Label>
                    <Input type="date" value={assignStart} onChange={(e) => setAssignStart(e.target.value)} />
                  </div>
                  <Button className="w-full" onClick={saveAssignment}>Assign</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Recipe</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>New Feed Recipe</DialogTitle>
                  <DialogDescription>List each ingredient with its quantity and cost per kg</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1 sm:col-span-3">
                      <Label>Recipe name</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Broiler Starter Mash" />
                    </div>
                    <div className="space-y-1">
                      <Label>Target species</Label>
                      <Select value={species} onValueChange={setSpecies}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          {["broiler", "layer", "noiler", "cockerel", "turkey", "pig", "goat", "cattle", "other"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Stage</Label>
                      <Select value={stage} onValueChange={setStage}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          {["starter", "grower", "finisher", "layer", "maintenance"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Ingredients</Label>
                    {rows.map((r, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2">
                        <Input className="col-span-6" placeholder="Ingredient (e.g. Maize)" value={r.ingredient_name}
                          onChange={(e) => setRows(rows.map((x, i) => i === idx ? { ...x, ingredient_name: e.target.value } : x))} />
                        <Input className="col-span-3" type="number" step="0.01" placeholder="kg" value={r.quantity_kg}
                          onChange={(e) => setRows(rows.map((x, i) => i === idx ? { ...x, quantity_kg: e.target.value } : x))} />
                        <Input className="col-span-2" type="number" step="0.01" placeholder="₦/kg" value={r.cost_per_kg}
                          onChange={(e) => setRows(rows.map((x, i) => i === idx ? { ...x, cost_per_kg: e.target.value } : x))} />
                        <Button className="col-span-1" variant="ghost" size="icon" onClick={() => setRows(rows.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setRows([...rows, { ingredient_name: "", quantity_kg: "", cost_per_kg: "" }])}>
                      <Plus className="h-3 w-3 mr-1" /> Add ingredient
                    </Button>
                  </div>

                  <div className="rounded-lg bg-muted/50 p-3 text-sm flex justify-between">
                    <span className="text-muted-foreground">
                      Batch size: {rows.reduce((s, r) => s + Number(r.quantity_kg || 0), 0).toFixed(1)} kg
                    </span>
                    <span className="font-semibold">
                      {naira(
                        (() => {
                          const kg = rows.reduce((s, r) => s + Number(r.quantity_kg || 0), 0);
                          const cost = rows.reduce((s, r) => s + Number(r.quantity_kg || 0) * Number(r.cost_per_kg || 0), 0);
                          return kg > 0 ? cost / kg : 0;
                        })()
                      )}/kg
                    </span>
                  </div>

                  <div className="space-y-1">
                    <Label>Notes</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Mixing instructions, supplier notes…" />
                  </div>

                  <Button className="w-full" onClick={saveRecipe} disabled={saving}>{saving ? "Saving…" : "Save recipe"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {recipeStats.map((r) => (
          <Card key={r.id}>
            <CardHeader className="pb-2 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-sm">{r.name}</CardTitle>
                <div className="flex gap-1 mt-1">
                  <Badge variant="secondary">{r.target_species}</Badge>
                  <Badge variant="outline">{r.stage}</Badge>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteRecipe(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-[11px] text-muted-foreground">Mix size</p>
                  <p className="font-bold text-sm">{r.totalKg.toFixed(1)} kg</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-[11px] text-muted-foreground">Mix cost</p>
                  <p className="font-bold text-sm">{naira(r.totalCost)}</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-2">
                  <p className="text-[11px] text-muted-foreground">Cost / kg</p>
                  <p className="font-bold text-sm">{naira(r.costPerKg)}</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Ingredient</TableHead><TableHead className="text-right">kg</TableHead><TableHead className="text-right">₦/kg</TableHead><TableHead className="text-right">%</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {r.ing.map((i: any) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.ingredient_name}</TableCell>
                      <TableCell className="text-right">{Number(i.quantity_kg).toFixed(1)}</TableCell>
                      <TableCell className="text-right">{Number(i.cost_per_kg).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{r.totalKg > 0 ? ((Number(i.quantity_kg) / r.totalKg) * 100).toFixed(1) : "0"}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
            </CardContent>
          </Card>
        ))}
        {recipeStats.length === 0 && (
          <Card className="lg:col-span-2"><CardContent className="py-10 text-center text-sm text-muted-foreground">No recipes yet — create your first formulation.</CardContent></Card>
        )}
      </div>

      {recipeStats.length > 1 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recipe cost comparison (₦ per kg)</CardTitle></CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compareData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="Cost per kg" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm">Feed cost per bird by batch</CardTitle>
            <CardDescription>Recorded feed usage priced with the assigned recipe</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => exportToCSV(batchCosting, "feed-cost-per-bird")}>
            <Download className="h-3 w-3 mr-1" /> CSV
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead><TableHead>Recipe</TableHead>
                <TableHead className="text-right">₦/kg</TableHead><TableHead className="text-right">Feed used</TableHead>
                <TableHead className="text-right">Feed cost</TableHead><TableHead className="text-right">Cost / bird</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {batchCosting.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.batchLabel}</TableCell>
                  <TableCell>{b.recipeName}</TableCell>
                  <TableCell className="text-right">{naira(b.costPerKg)}</TableCell>
                  <TableCell className="text-right">{b.kg.toLocaleString()} kg</TableCell>
                  <TableCell className="text-right">{naira(b.feedCost)}</TableCell>
                  <TableCell className="text-right font-semibold">{naira(b.costPerBird)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => removeAssignment(b.id)}><Trash2 className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {batchCosting.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">No recipe assigned to a batch yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default FeedRecipesTab;
