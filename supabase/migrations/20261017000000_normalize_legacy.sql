-- Forward-only normalization. No rows or original money columns are removed.
DO $$
DECLARE legacy boolean; modern boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions' AND column_name='amount') INTO legacy;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions' AND column_name='amount_paise') INTO modern;
  IF to_regclass('public.transactions') IS NOT NULL AND NOT legacy AND NOT modern THEN
    RAISE EXCEPTION 'Unrecognized transactions schema; run read-only preflight before preparing an upgrade';
  END IF;
  IF legacy AND modern THEN RAISE EXCEPTION 'Ambiguous mixed money schema; manual reconciliation required'; END IF;
  IF to_regclass('public.recurring_transactions') IS NOT NULL THEN
    IF to_regclass('public.recurring_rules') IS NOT NULL THEN
      RAISE EXCEPTION 'Both legacy and current recurring tables exist; reconcile before upgrade';
    END IF;
    ALTER TABLE public.recurring_transactions RENAME TO recurring_rules;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.vasoli_rename(tbl text, old_name text, new_name text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl AND column_name=old_name) THEN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl AND column_name=new_name) THEN
    RAISE EXCEPTION 'Conflicting columns %.% and %', tbl, old_name, new_name;
  END IF;
  EXECUTE format('ALTER TABLE public.%I RENAME COLUMN %I TO %I',tbl,old_name,new_name);
 END IF;
END $$;

DO $$
DECLARE tbl text; pair text[];
BEGIN
 FOREACH tbl IN ARRAY ARRAY['users','categories','transactions','budgets','goals','goal_contributions','recurring_rules','transaction_splits','financial_health_scores'] LOOP
  FOREACH pair SLICE 1 IN ARRAY ARRAY[
   ['userid','user_id'],['categoryid','category_id'],['createdat','created_at'],['updatedat','updated_at'],
   ['avatarurl','avatar_url'],['receipturl','receipt_url'],['paymentmethod','payment_method'],['upiid','upi_id'],['bankrrn','bank_rrn'],
   ['isrecurring','is_recurring'],['recurringid','recurring_id'],['startdate','start_date'],['enddate','end_date'],
   ['goalid','goal_id'],['transactionid','transaction_id'],['deadline','due_date'],['isactive','active'],['nextrun','next_due_date']
  ] LOOP
   PERFORM pg_temp.vasoli_rename(tbl,pair[1],pair[2]);
  END LOOP;
 END LOOP;
 PERFORM pg_temp.vasoli_rename('recurring_rules','description','merchant_norm');
 PERFORM pg_temp.vasoli_rename('recurring_rules','frequency','cadence');
END $$;

CREATE OR REPLACE FUNCTION pg_temp.vasoli_money(tbl text, source_col text, target_col text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE invalid_count bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl AND column_name=source_col) THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl AND column_name=target_col) THEN
  RAISE EXCEPTION 'Both money representations exist on %. Manual reconciliation required.',tbl;
 END IF;
 EXECUTE format('SELECT count(*) FROM public.%I WHERE %I IS NOT NULL AND (%I::text IN (''NaN'',''Infinity'',''-Infinity'') OR abs(%I::numeric*100)>9223372036854775807 OR %I::numeric*100<>trunc(%I::numeric*100))',tbl,source_col,source_col,source_col,source_col,source_col) INTO invalid_count;
 IF invalid_count>0 THEN RAISE EXCEPTION 'Ambiguous money in %.%: % rows; upgrade stopped without rounding',tbl,source_col,invalid_count; END IF;
 EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I bigint',tbl,target_col);
 EXECUTE format('UPDATE public.%I SET %I=(%I::numeric*100)::bigint',tbl,target_col,source_col);
 -- Retain source columns as archival values, but new writers use paise only.
 EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL',tbl,source_col);
 EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP DEFAULT',tbl,source_col);
END $$;
SELECT pg_temp.vasoli_money('transactions','amount','amount_paise');
SELECT pg_temp.vasoli_money('budgets','amount','amount_paise');
SELECT pg_temp.vasoli_money('goals','targetamount','target_amount_paise');
SELECT pg_temp.vasoli_money('goals','currentamount','current_amount_paise');
SELECT pg_temp.vasoli_money('goal_contributions','amount','amount_paise');
SELECT pg_temp.vasoli_money('recurring_rules','amount','amount_paise');
SELECT pg_temp.vasoli_money('transaction_splits','amount','amount_paise');

-- Earlier unquoted Marco definitions folded camelCase to lowercase.
SELECT pg_temp.vasoli_rename('marco_threads','userid','userId');
SELECT pg_temp.vasoli_rename('marco_threads','lastmessageat','lastMessageAt');
SELECT pg_temp.vasoli_rename('marco_threads','createdat','createdAt');
SELECT pg_temp.vasoli_rename('marco_threads','updatedat','updatedAt');
SELECT pg_temp.vasoli_rename('marco_messages','threadid','threadId');
SELECT pg_temp.vasoli_rename('marco_messages','partsjson','partsJson');
SELECT pg_temp.vasoli_rename('marco_messages','createdat','createdAt');
