-- Phase 3 onboarding step seeding
-- Adds Phase 3 steps for businesses that have completed Phase 2

-- Seed Phase 3 steps for all businesses that have completed Phase 2
INSERT INTO public.onboarding_steps (business_id, phase, step_key, status)
SELECT
  op.business_id,
  3,
  step_key,
  'available'
FROM public.onboarding_progress op
CROSS JOIN (VALUES
  ('hire_sales_manager'),
  ('hire_review_agent'),
  ('hire_operations_manager')
) AS steps(step_key)
WHERE op.phase_2_completed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.onboarding_steps s
    WHERE s.business_id = op.business_id
      AND s.phase = 3
      AND s.step_key = steps.step_key
  );

-- Auto-complete hire_sales_manager if Sales Manager is already activated
UPDATE public.onboarding_steps os
SET status = 'completed',
    completed_at = now()
WHERE os.phase = 3
  AND os.step_key = 'hire_sales_manager'
  AND os.status != 'completed'
  AND EXISTS (
    SELECT 1 FROM public.agent_settings ag
    WHERE ag.business_id = os.business_id
      AND ag.agent IN ('sales_manager', 'front_desk')
      AND ag.mode NOT IN ('off')
  );

-- Auto-complete hire_review_agent if Review Agent is already activated
UPDATE public.onboarding_steps os
SET status = 'completed',
    completed_at = now()
WHERE os.phase = 3
  AND os.step_key = 'hire_review_agent'
  AND os.status != 'completed'
  AND EXISTS (
    SELECT 1 FROM public.agent_settings ag
    WHERE ag.business_id = os.business_id
      AND ag.agent IN ('review_agent', 'reviews')
      AND ag.mode NOT IN ('off')
  );

-- Auto-complete hire_operations_manager if Operations Manager is already activated
UPDATE public.onboarding_steps os
SET status = 'completed',
    completed_at = now()
WHERE os.phase = 3
  AND os.step_key = 'hire_operations_manager'
  AND os.status != 'completed'
  AND EXISTS (
    SELECT 1 FROM public.agent_settings ag
    WHERE ag.business_id = os.business_id
      AND ag.agent = 'operations_manager'
      AND ag.mode NOT IN ('off')
  );

-- Create or replace initialise_phase3_plan function
CREATE OR REPLACE FUNCTION public.initialise_phase3_plan(p_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.onboarding_steps (business_id, phase, step_key, status)
  VALUES
    (p_business_id, 3, 'hire_sales_manager',       'available'),
    (p_business_id, 3, 'hire_review_agent',         'available'),
    (p_business_id, 3, 'hire_operations_manager',   'available')
  ON CONFLICT (business_id, phase, step_key) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.initialise_phase3_plan(uuid) TO authenticated;
