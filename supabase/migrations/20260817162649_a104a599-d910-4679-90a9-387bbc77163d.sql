CREATE TABLE public.feed_recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  target_species TEXT,
  stage TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.feed_recipe_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.feed_recipes(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  quantity_kg NUMERIC NOT NULL DEFAULT 0,
  cost_per_kg NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.batch_feed_recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.livestock_batches(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.feed_recipes(id) ON DELETE CASCADE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  notes TEXT,
  assigned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipe_ingredients_recipe ON public.feed_recipe_ingredients(recipe_id);
CREATE INDEX idx_batch_feed_recipes_batch ON public.batch_feed_recipes(batch_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_recipes TO authenticated;
GRANT ALL ON public.feed_recipes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_recipe_ingredients TO authenticated;
GRANT ALL ON public.feed_recipe_ingredients TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_feed_recipes TO authenticated;
GRANT ALL ON public.batch_feed_recipes TO service_role;

ALTER TABLE public.feed_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_feed_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view recipes" ON public.feed_recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage recipes" ON public.feed_recipes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Authenticated can view recipe ingredients" ON public.feed_recipe_ingredients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage recipe ingredients" ON public.feed_recipe_ingredients FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Authenticated can view batch recipes" ON public.batch_feed_recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage batch recipes" ON public.batch_feed_recipes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Partners manage their batch recipes" ON public.batch_feed_recipes FOR ALL TO authenticated USING (public.partner_has_batch(batch_id)) WITH CHECK (public.partner_has_batch(batch_id));

CREATE TRIGGER trg_feed_recipes_updated BEFORE UPDATE ON public.feed_recipes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();