-- Fix wallet privilege escalation, public payment credentials, and manual payment realtime leakage.

-- 1) Wallets: users may view/create their own wallet, but may not mutate premium/balance fields directly.
DROP POLICY IF EXISTS "Users can update their own wallet" ON public.user_wallets;

-- 2) App settings: public access must never expose payment provider credentials.
DROP POLICY IF EXISTS "Anyone can view settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated users can view safe settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can view all settings" ON public.app_settings;

CREATE POLICY "Authenticated users can view safe settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (key <> 'payment_providers');

CREATE POLICY "Admins can view all settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3) Manual payments: do not publish sensitive phone/trx rows through broad Realtime changes.
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.manual_payments;

-- If clients use Realtime Broadcast later, only allow authenticated users to join their own payment channels.
DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NOT NULL THEN
    ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can receive own manual payment realtime messages" ON realtime.messages;
    CREATE POLICY "Users can receive own manual payment realtime messages"
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
      topic = ('manual_payments:' || auth.uid()::text)
      OR topic = ('manual_payments:user:' || auth.uid()::text)
    );
  END IF;
END $$;
