-- 083: Phase 3 of the 30-day plan reduced to two live steps.
--
-- Review Agent and Operations Manager are still coming-soon, so the plan was
-- ending in dead ends. Phase 3 is now: hire_sales_manager → install_widget
-- (put the Front Desk on your own website — WidgetSetupWizard, widget_configs).
-- Payments step deferred until a payment processor integration is live.

-- New seeding function: two steps only
CREATE OR REPLACE FUNCTION public.initialise_phase3_plan(p_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.onboarding_steps (business_id, phase, step_key, status)
  VALUES
    (p_business_id, 3, 'hire_sales_manager', 'available'),
    (p_business_id, 3, 'install_widget',     'available')
  ON CONFLICT (business_id, phase, step_key) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.initialise_phase3_plan(uuid) TO authenticated;

-- Seed install_widget for businesses already in Phase 3
INSERT INTO public.onboarding_steps (business_id, phase, step_key, status)
SELECT DISTINCT s.business_id, 3, 'install_widget', 'available'
FROM public.onboarding_steps s
WHERE s.phase = 3
ON CONFLICT (business_id, phase, step_key) DO NOTHING;

-- Auto-complete install_widget where the widget is already configured + enabled
UPDATE public.onboarding_steps os
SET status = 'completed', completed_at = now()
WHERE os.phase = 3
  AND os.step_key = 'install_widget'
  AND os.status != 'completed'
  AND EXISTS (
    SELECT 1 FROM public.widget_configs wc
    WHERE wc.business_id = os.business_id AND wc.enabled = true
  );

-- Retire the coming-soon steps: drop rows nobody completed. Completed rows
-- stay as history (the app no longer reads them either way).
DELETE FROM public.onboarding_steps
WHERE phase = 3
  AND step_key IN ('hire_review_agent', 'hire_operations_manager')
  AND status != 'completed';
