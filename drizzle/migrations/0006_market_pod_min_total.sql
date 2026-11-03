ALTER TABLE public.market_settings ADD COLUMN IF NOT EXISTS pod_min_total numeric(12,2) CHECK (pod_min_total IS NULL OR pod_min_total > 0);
UPDATE public.market_settings SET pod_min_total = pod_max_total WHERE pod_min_total IS NULL AND pod_max_total IS NOT NULL;
UPDATE public.market_settings SET pod_max_total = NULL;
CREATE OR REPLACE FUNCTION public.market_create_order(_customer jsonb,_items jsonb,_mode text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item jsonb; v record; qty integer; lines jsonb:='[]'; sub numeric:=0; s public.market_settings; o public.market_orders;
BEGIN
  IF _mode NOT IN ('online','pod') THEN RAISE EXCEPTION 'Choose a payment option'; END IF;
  IF jsonb_typeof(_items)<>'array' OR jsonb_array_length(_items) NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Select 1 to 30 items'; END IF;
  IF length(trim(coalesce(_customer->>'name',''))) NOT BETWEEN 2 AND 150 OR coalesce(_customer->>'email','') !~ '^[A-Za-z0-9.!#$%&*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$' OR length(coalesce(_customer->>'phone','')) NOT BETWEEN 7 AND 30 OR length(trim(coalesce(_customer->>'address',''))) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'Enter valid contact and delivery details'; END IF;
  IF (SELECT count(*) FROM public.market_orders WHERE email=lower(_customer->>'email') AND created_at>now()-interval '1 hour')>=5 THEN RAISE EXCEPTION 'Too many orders. Please try again later'; END IF;
  IF (SELECT count(DISTINCT x->>'variant_id') FROM jsonb_array_elements(_items) x) <> jsonb_array_length(_items) THEN RAISE EXCEPTION 'Duplicate cart items'; END IF;
  SELECT * INTO s FROM public.market_settings WHERE id=1;
  IF _mode='pod' AND NOT coalesce(s.pod_enabled,true) THEN RAISE EXCEPTION 'Payment on delivery is currently unavailable'; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    qty:=(item->>'quantity')::integer;
    SELECT mv.*,p.name AS product_name,p.allow_pod,p.pod_min_quantity INTO v FROM public.market_variants mv JOIN public.market_products p ON p.id=mv.product_id WHERE mv.id=(item->>'variant_id')::uuid AND mv.active AND p.active;
    IF NOT FOUND OR qty IS NULL OR qty<1 OR qty>v.stock THEN RAISE EXCEPTION 'Item unavailable or quantity exceeds available stock'; END IF;
    IF _mode='pod' AND NOT v.allow_pod THEN RAISE EXCEPTION '% must be paid online', v.product_name; END IF;
    IF _mode='pod' AND qty < v.pod_min_quantity THEN RAISE EXCEPTION 'Payment on delivery for % needs at least % units', v.product_name, v.pod_min_quantity; END IF;
    sub:=sub+round(v.price*qty*(CASE WHEN v.unit='kg' THEN v.weight_kg ELSE 1 END),2);
    lines:=lines||jsonb_build_array(jsonb_build_object('variant_id',v.id,'product',v.product_name,'variant',v.name,'quantity',qty,'unit',v.unit,'price',v.price,'weight_kg',v.weight_kg,'line_total',round(v.price*qty*(CASE WHEN v.unit='kg' THEN v.weight_kg ELSE 1 END),2)));
  END LOOP;
  IF _mode='pod' AND s.pod_min_total IS NOT NULL AND sub+coalesce(s.delivery_fee,1000) < s.pod_min_total THEN RAISE EXCEPTION 'Payment on delivery is only available for orders of % or more. Please pay online', s.pod_min_total; END IF;
  INSERT INTO public.market_orders(customer_name,email,phone,delivery_address,items,subtotal,delivery_fee,total,payment_mode) VALUES(trim(_customer->>'name'),lower(trim(_customer->>'email')),trim(_customer->>'phone'),trim(_customer->>'address'),lines,sub,coalesce(s.delivery_fee,1000),sub+coalesce(s.delivery_fee,1000),_mode) RETURNING * INTO o;
  RETURN jsonb_build_object('id',o.id,'token',o.access_token,'order_number',o.order_number,'subtotal',o.subtotal,'delivery_fee',o.delivery_fee,'total',o.total,'payment_mode',o.payment_mode);
END; $$;
REVOKE ALL ON FUNCTION public.market_create_order(jsonb,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.market_create_order(jsonb,jsonb,text) TO service_role;