CREATE OR REPLACE FUNCTION public.get_batch_financials(_batch_id uuid)
 RETURNS TABLE(budget numeric, admin_contribution numeric, partner_contribution numeric, total_expenses numeric, total_sales numeric, gross_profit numeric, remaining_budget numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_budget NUMERIC := 0; v_admin NUMERIC := 0; v_partner NUMERIC := 0; v_exp NUMERIC := 0; v_sales NUMERIC := 0;
BEGIN
  SELECT COALESCE(lb.budget,0), COALESCE(lb.admin_contribution,0) INTO v_budget, v_admin
    FROM public.livestock_batches lb WHERE lb.id = _batch_id;
  SELECT COALESCE(SUM(pb.partner_contribution),0) INTO v_partner
    FROM public.partner_batches pb WHERE pb.batch_id = _batch_id;
  SELECT COALESCE(SUM(me.amount),0) INTO v_exp
    FROM public.miscellaneous_expenses me WHERE me.batch_id = _batch_id;
  SELECT COALESCE(SUM(bs.total_amount),0) INTO v_sales
    FROM public.batch_sales bs WHERE bs.batch_id = _batch_id;
  RETURN QUERY SELECT v_budget, v_admin, v_partner, v_exp, v_sales,
    (v_sales - v_exp)::NUMERIC, (v_budget - v_exp)::NUMERIC;
END;
$function$;