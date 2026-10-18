-- Direct browser access and the server database role have separate boundaries.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='vasoli_app') THEN
  CREATE ROLE vasoli_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='vasoli_app' AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb)) THEN
  RAISE EXCEPTION 'vasoli_app must be a restricted application role';
 END IF;
END $$;
GRANT USAGE ON SCHEMA public TO vasoli_app, authenticated;

DO $$
DECLARE r record; predicate text;
BEGIN
 FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',r.tablename);
  -- All finance writes go through the authenticated Go API with owner-scoped SQL.
  EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',r.tablename);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO vasoli_app',r.tablename);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',r.tablename);
  EXECUTE format('CREATE POLICY vasoli_server ON public.%I FOR ALL TO vasoli_app USING (true) WITH CHECK (true)',r.tablename);
  predicate := NULL;
  IF r.tablename='categories' THEN predicate := '(user_id=auth.uid() OR (user_id IS NULL AND is_default=true))';
  ELSIF r.tablename='users' THEN predicate := 'id=auth.uid()';
  ELSIF r.tablename='goal_contributions' THEN predicate := 'EXISTS(SELECT 1 FROM public.goals g WHERE g.id=goal_id AND g.user_id=auth.uid())';
  ELSIF r.tablename='achievements' THEN predicate := 'true';
  ELSIF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=r.tablename AND column_name='user_id') THEN predicate := 'user_id=auth.uid()';
  END IF;
  IF predicate IS NOT NULL THEN
   EXECUTE format('GRANT SELECT ON public.%I TO authenticated',r.tablename);
   EXECUTE format('CREATE POLICY vasoli_own_read ON public.%I FOR SELECT TO authenticated USING (%s)',r.tablename,predicate);
  END IF;
 END LOOP;
END $$;
CREATE POLICY marco_threads_owner ON public.marco_threads FOR ALL TO authenticated
 USING ("userId"=auth.uid()) WITH CHECK ("userId"=auth.uid());
CREATE POLICY marco_messages_owner ON public.marco_messages FOR ALL TO authenticated
 USING (EXISTS(SELECT 1 FROM public.marco_threads t WHERE t.id="threadId" AND t."userId"=auth.uid()))
 WITH CHECK (EXISTS(SELECT 1 FROM public.marco_threads t WHERE t.id="threadId" AND t."userId"=auth.uid()));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.marco_threads, public.marco_messages TO authenticated;

-- Preserve legacy auth linkage; reject orphan users rather than deleting their records.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.users u LEFT JOIN auth.users a ON a.id=u.id WHERE a.id IS NULL) THEN
  RAISE EXCEPTION 'Existing profile IDs are missing in auth.users. Restore identities before adding the auth link.';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.users'::regclass AND confrelid='auth.users'::regclass) THEN
  ALTER TABLE public.users ADD CONSTRAINT users_auth_identity_fk FOREIGN KEY(id) REFERENCES auth.users(id) ON DELETE CASCADE;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.users(id,email,name,avatar_url)
 VALUES(NEW.id,COALESCE(NEW.email,''),COALESCE(NEW.raw_user_meta_data->>'name',''),COALESCE(NEW.raw_user_meta_data->>'avatar_url',''))
 ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- DB-level ownership safeguards supplement API validation, including legacy write paths.
CREATE OR REPLACE FUNCTION public.vasoli_relationship_owner() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE value jsonb:=to_jsonb(NEW); owner_id uuid; target_id uuid; target_owner uuid; relation record;
BEGIN
 owner_id:=NULLIF(value->>'user_id','')::uuid;
 IF owner_id IS NULL THEN RETURN NEW; END IF;
 FOR relation IN SELECT * FROM (VALUES
  ('account_id','financial_accounts'),('from_account_id','financial_accounts'),('to_account_id','financial_accounts'),
  ('category_id','categories'),('selected_goal_id','goals'),('recurring_id','recurring_rules'),('recurring_rule_id','recurring_rules'),
  ('receipt_id','receipts'),('import_batch_id','import_batches'),('refund_of_transaction_id','transactions'),('transaction_id','transactions')
 ) AS links(field_name,table_name) LOOP
  target_id:=NULLIF(value->>relation.field_name,'')::uuid;
  IF target_id IS NULL THEN CONTINUE; END IF;
  EXECUTE format('SELECT user_id FROM public.%I WHERE id=$1',relation.table_name) INTO target_owner USING target_id;
  IF target_owner IS DISTINCT FROM owner_id THEN
   IF relation.table_name='categories' AND target_owner IS NULL AND EXISTS(SELECT 1 FROM public.categories WHERE id=target_id AND is_default=true) THEN CONTINUE; END IF;
   RAISE EXCEPTION 'Referenced record unavailable' USING ERRCODE='23503';
  END IF;
 END LOOP;
 IF value ? 'paying_account_ids' THEN
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(value->'paying_account_ids') a LEFT JOIN public.financial_accounts f ON f.id=a::uuid AND f.user_id=owner_id WHERE f.id IS NULL) THEN
   RAISE EXCEPTION 'Paying account unavailable' USING ERRCODE='23503';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.vasoli_relationship_owner() FROM PUBLIC;
DO $$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['transactions','liabilities','recurring_rules','category_rules','payday_plans','recurring_payments','transfer_groups','import_commit_idempotency'] LOOP
  EXECUTE format('CREATE TRIGGER vasoli_relationship_owner BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.vasoli_relationship_owner()',tbl);
 END LOOP;
END $$;
