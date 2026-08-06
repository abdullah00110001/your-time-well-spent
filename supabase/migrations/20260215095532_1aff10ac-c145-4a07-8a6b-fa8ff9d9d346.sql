-- Allow users to insert their own subscriptions
CREATE POLICY "Users can insert own subscriptions"
ON public.user_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);
