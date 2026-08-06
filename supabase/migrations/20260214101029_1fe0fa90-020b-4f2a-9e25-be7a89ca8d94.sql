
-- Update existing plans with weekly pricing and trial days
UPDATE public.subscription_plans SET price_weekly = 0, trial_days = 0 WHERE plan_key = 'free';
UPDATE public.subscription_plans SET price_weekly = 1.99, trial_days = 3 WHERE plan_key = 'premium';
UPDATE public.subscription_plans SET price_weekly = 3.99, trial_days = 7 WHERE plan_key = 'ultimate';
