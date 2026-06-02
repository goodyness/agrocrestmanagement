
-- ============ MEDICINES ============
CREATE TABLE public.medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'medicine', -- medicine | vaccine | supplement
  unit TEXT NOT NULL DEFAULT 'pcs',
  current_stock NUMERIC NOT NULL DEFAULT 0,
  reorder_point NUMERIC NOT NULL DEFAULT 0,
  expiry_date DATE,
  notes TEXT,
  branch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicines TO authenticated;
GRANT ALL ON public.medicines TO service_role;
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view medicines" ON public.medicines FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage medicines" ON public.medicines FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE public.medicine_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL, -- purchase | usage | adjustment
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  reference_id UUID, -- e.g. clinic_treatments.id
  notes TEXT,
  branch_id UUID,
  recorded_by UUID NOT NULL,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicine_movements TO authenticated;
GRANT ALL ON public.medicine_movements TO service_role;
ALTER TABLE public.medicine_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view med moves" ON public.medicine_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert med moves" ON public.medicine_movements FOR INSERT TO authenticated WITH CHECK (auth.uid() = recorded_by);
CREATE POLICY "admins manage med moves" ON public.medicine_movements FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Auto-update stock on movement
CREATE OR REPLACE FUNCTION public.apply_medicine_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.movement_type = 'purchase' OR NEW.movement_type = 'adjustment' THEN
    UPDATE public.medicines SET current_stock = current_stock + NEW.quantity, updated_at = now() WHERE id = NEW.medicine_id;
  ELSIF NEW.movement_type = 'usage' THEN
    UPDATE public.medicines SET current_stock = GREATEST(current_stock - NEW.quantity, 0), updated_at = now() WHERE id = NEW.medicine_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_apply_medicine_movement AFTER INSERT ON public.medicine_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_medicine_movement();

-- ============ SUPPLIES ============
CREATE TABLE public.supplies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general', -- cleaning | packaging | tools | general
  unit TEXT NOT NULL DEFAULT 'pcs',
  current_stock NUMERIC NOT NULL DEFAULT 0,
  reorder_point NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  branch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplies TO authenticated;
GRANT ALL ON public.supplies TO service_role;
ALTER TABLE public.supplies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view supplies" ON public.supplies FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage supplies" ON public.supplies FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE public.supply_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_id UUID NOT NULL REFERENCES public.supplies(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL, -- purchase | usage | adjustment
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  notes TEXT,
  branch_id UUID,
  recorded_by UUID NOT NULL,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supply_movements TO authenticated;
GRANT ALL ON public.supply_movements TO service_role;
ALTER TABLE public.supply_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view sup moves" ON public.supply_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert sup moves" ON public.supply_movements FOR INSERT TO authenticated WITH CHECK (auth.uid() = recorded_by);
CREATE POLICY "admins manage sup moves" ON public.supply_movements FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE OR REPLACE FUNCTION public.apply_supply_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.movement_type = 'purchase' OR NEW.movement_type = 'adjustment' THEN
    UPDATE public.supplies SET current_stock = current_stock + NEW.quantity, updated_at = now() WHERE id = NEW.supply_id;
  ELSIF NEW.movement_type = 'usage' THEN
    UPDATE public.supplies SET current_stock = GREATEST(current_stock - NEW.quantity, 0), updated_at = now() WHERE id = NEW.supply_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_apply_supply_movement AFTER INSERT ON public.supply_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_supply_movement();

-- ============ PURCHASE ORDERS ============
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL DEFAULT ('PO-' || to_char(now(), 'YYYYMMDDHH24MISS')),
  supplier_name TEXT NOT NULL,
  supplier_phone TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | sent | partial | received | cancelled
  total_amount NUMERIC NOT NULL DEFAULT 0,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  received_date DATE,
  notes TEXT,
  branch_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view POs" ON public.purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage POs" ON public.purchase_orders FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL, -- feed | medicine | supply
  item_ref_id UUID, -- feed_type_id | medicine_id | supply_id
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  received_quantity NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view PO items" ON public.purchase_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage PO items" ON public.purchase_order_items FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- updated_at triggers
CREATE TRIGGER trg_medicines_updated BEFORE UPDATE ON public.medicines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_supplies_updated BEFORE UPDATE ON public.supplies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_po_updated BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_med_moves_med_date ON public.medicine_movements(medicine_id, movement_date DESC);
CREATE INDEX idx_sup_moves_sup_date ON public.supply_movements(supply_id, movement_date DESC);
CREATE INDEX idx_po_items_po ON public.purchase_order_items(po_id);
CREATE INDEX idx_medicines_branch ON public.medicines(branch_id);
CREATE INDEX idx_supplies_branch ON public.supplies(branch_id);
CREATE INDEX idx_po_branch_date ON public.purchase_orders(branch_id, order_date DESC);
