-- RLS для справочника подтипов пунктов приказа (только чтение для authenticated)
ALTER TABLE public.order_item_subtypes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_item_subtypes_select_authenticated"
  ON public.order_item_subtypes FOR SELECT TO authenticated USING (true);
