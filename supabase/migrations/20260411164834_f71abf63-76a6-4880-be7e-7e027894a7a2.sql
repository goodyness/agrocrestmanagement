
-- AI Chat Conversations
CREATE TABLE public.ai_chat_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Chat',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations" ON public.ai_chat_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own conversations" ON public.ai_chat_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON public.ai_chat_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON public.ai_chat_conversations FOR DELETE USING (auth.uid() = user_id);

-- AI Chat Messages
CREATE TABLE public.ai_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.ai_chat_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON public.ai_chat_messages FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.ai_chat_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "Users can create own messages" ON public.ai_chat_messages FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_chat_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "Users can delete own messages" ON public.ai_chat_messages FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.ai_chat_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));

-- Egg Grading Records
CREATE TABLE public.egg_grading_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL DEFAULT CURRENT_DATE,
  branch_id uuid REFERENCES public.branches(id),
  batch_id uuid REFERENCES public.livestock_batches(id),
  total_eggs integer NOT NULL DEFAULT 0,
  small_count integer NOT NULL DEFAULT 0,
  medium_count integer NOT NULL DEFAULT 0,
  large_count integer NOT NULL DEFAULT 0,
  extra_large_count integer NOT NULL DEFAULT 0,
  cracked_count integer NOT NULL DEFAULT 0,
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.egg_grading_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view egg grading" ON public.egg_grading_records FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create egg grading" ON public.egg_grading_records FOR INSERT WITH CHECK (auth.uid() = recorded_by);
CREATE POLICY "Only admins can manage egg grading" ON public.egg_grading_records FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Photo evidence columns
ALTER TABLE public.mortality_records ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.cleaning_records ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.vet_visit_logs ADD COLUMN IF NOT EXISTS photo_url text;

-- Storage bucket for evidence photos
INSERT INTO storage.buckets (id, name, public) VALUES ('evidence-photos', 'evidence-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view evidence photos" ON storage.objects FOR SELECT USING (bucket_id = 'evidence-photos');
CREATE POLICY "Authenticated users can upload evidence photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'evidence-photos' AND auth.uid() IS NOT NULL);
