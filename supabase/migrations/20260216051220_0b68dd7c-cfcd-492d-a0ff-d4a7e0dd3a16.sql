
-- Create manual_payments table for phone-based payments (bKash/Nagad/Rocket)
CREATE TABLE public.manual_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID REFERENCES public.subscription_plans(id),
  payment_method TEXT NOT NULL DEFAULT 'bkash', -- bkash, nagad, rocket
  phone_number TEXT NOT NULL,
  trx_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BDT',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  admin_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;

-- Users can submit their own payments
CREATE POLICY "Users can create own manual payments"
ON public.manual_payments FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own payments
CREATE POLICY "Users can view own manual payments"
ON public.manual_payments FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all manual payments"
ON public.manual_payments FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update (approve/reject)
CREATE POLICY "Admins can update manual payments"
ON public.manual_payments FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_manual_payments_updated_at
BEFORE UPDATE ON public.manual_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add admin_payment_info to app_settings for storing payment phone numbers
-- (will use existing app_settings table with key 'manual_payment_info')

-- Fix notification insert policy to be cleaner for admins
-- Drop the redundant system policy that conflicts
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Ensure admin insert policy covers INSERT specifically
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id);

-- Add realtime for manual_payments
ALTER PUBLICATION supabase_realtime ADD TABLE public.manual_payments;
