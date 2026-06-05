-- ============================================
-- Phase 3: Livestock Depth
-- ============================================

-- 1. Weight-Growth Curves
CREATE TABLE public.batch_weight_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.livestock_batches(id) ON DELETE CASCADE,
  weight_date date NOT NULL DEFAULT CURRENT_DATE,
  sample_size integer NOT NULL DEFAULT 1,
  average_weight_g numeric(10,2) NOT NULL,
  target_weight_g numeric(10,2),
  notes text,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_weight_records TO authenticated;
GRANT ALL ON public.batch_weight_records TO service_role;
ALTER TABLE public.batch_weight_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage weight records in their branch" ON public.batch_weight_records
  FOR ALL USING (
    branch_id IS NULL OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR branch_id = public.batch_weight_records.branch_id)
    )
  );

-- 2. Breeding & Pedigree Records
CREATE TABLE public.breeding_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sire_batch_id uuid REFERENCES public.livestock_batches(id) ON DELETE SET NULL,
  dam_batch_id uuid REFERENCES public.livestock_batches(id) ON DELETE SET NULL,
  hatch_date date,
  eggs_set integer NOT NULL DEFAULT 0,
  eggs_fertile integer DEFAULT 0,
  eggs_hatched integer DEFAULT 0,
  chick_batch_id uuid REFERENCES public.livestock_batches(id) ON DELETE SET NULL,
  lineage_notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.breeding_records TO authenticated;
GRANT ALL ON public.breeding_records TO service_role;
ALTER TABLE public.breeding_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage breeding records in their branch" ON public.breeding_records
  FOR ALL USING (
    branch_id IS NULL OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR branch_id = public.breeding_records.branch_id)
    )
  );

-- 3. Incubation / Hatching Tracker
CREATE TABLE public.incubation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breeding_record_id uuid REFERENCES public.breeding_records(id) ON DELETE SET NULL,
  incubator_id text,
  set_date date NOT NULL DEFAULT CURRENT_DATE,
  eggs_set integer NOT NULL DEFAULT 0,
  candling_date date,
  fertile_count integer DEFAULT 0,
  infertile_count integer DEFAULT 0,
  dead_in_shell integer DEFAULT 0,
  hatched_count integer DEFAULT 0,
  hatch_date date,
  transfer_batch_id uuid REFERENCES public.livestock_batches(id) ON DELETE SET NULL,
  notes text,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.incubation_records TO authenticated;
GRANT ALL ON public.incubation_records TO service_role;
ALTER TABLE public.incubation_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage incubation records in their branch" ON public.incubation_records
  FOR ALL USING (
    branch_id IS NULL OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR branch_id = public.incubation_records.branch_id)
    )
  );

-- Indexes
CREATE INDEX idx_batch_weight_batch_date ON public.batch_weight_records(batch_id, weight_date);
CREATE INDEX idx_breeding_status ON public.breeding_records(status, branch_id);
CREATE INDEX idx_incubation_breeding ON public.incubation_records(breeding_record_id, set_date);
CREATE INDEX idx_incubation_transfer ON public.incubation_records(transfer_batch_id);

-- updated_at trigger
CREATE TRIGGER update_batch_weight_records_updated_at BEFORE UPDATE ON public.batch_weight_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_breeding_records_updated_at BEFORE UPDATE ON public.breeding_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_incubation_records_updated_at BEFORE UPDATE ON public.incubation_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();