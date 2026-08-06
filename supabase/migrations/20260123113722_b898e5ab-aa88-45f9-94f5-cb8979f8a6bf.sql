-- Fix the feedback_type check constraint to include all valid types
ALTER TABLE admin_feedback DROP CONSTRAINT IF EXISTS admin_feedback_feedback_type_check;

ALTER TABLE admin_feedback ADD CONSTRAINT admin_feedback_feedback_type_check 
  CHECK (feedback_type = ANY (ARRAY[
    'daily', 'weekly', 'motivation', 'advice', 
    'encouragement', 'concern', 'suggestion', 'reminder',
    'broadcast', 'alert', 'celebration'
  ]::text[]));