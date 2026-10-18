-- Tables for Marco AI Money Coach

CREATE TABLE IF NOT EXISTS public.marco_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT,
  lastMessageAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.marco_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  threadId UUID NOT NULL REFERENCES public.marco_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  partsJson TEXT, -- Stores complex Gemini parts as JSON
  
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_marco_messages_thread_id ON public.marco_messages(threadId);
CREATE INDEX IF NOT EXISTS idx_marco_threads_user_id ON public.marco_threads(userId);
