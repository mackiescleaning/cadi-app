-- Atomic front-desk usage check-and-increment.
-- Returns TRUE if the action is allowed (under limit), FALSE if the limit has been reached.
-- Handles month rollover: resets counter when the stored month is older than p_month.

CREATE OR REPLACE FUNCTION check_and_consume_fd_limit(
  p_business_id uuid,
  p_month       date,
  p_limit       integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Upsert row; if a new month has started, reset the counter
  INSERT INTO front_desk_monthly_usage (business_id, month, action_count)
  VALUES (p_business_id, p_month, 0)
  ON CONFLICT (business_id) DO UPDATE SET
    month        = CASE WHEN front_desk_monthly_usage.month < p_month
                        THEN p_month
                        ELSE front_desk_monthly_usage.month END,
    action_count = CASE WHEN front_desk_monthly_usage.month < p_month
                        THEN 0
                        ELSE front_desk_monthly_usage.action_count END;

  -- Atomically increment only if still under the limit
  UPDATE front_desk_monthly_usage
  SET action_count = action_count + 1
  WHERE business_id = p_business_id
    AND month       = p_month
    AND action_count < p_limit
  RETURNING action_count INTO v_count;

  -- v_count is NULL if the UPDATE matched zero rows (limit reached)
  RETURN v_count IS NOT NULL;
END;
$$;
