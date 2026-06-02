-- Enable realtime change notifications on the jobs table so that when a staff
-- member marks a job complete via the staff-jobs edge function, the owner's
-- scheduler view updates without a manual refresh.

ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
