-- DP-002 (v0.24.0): approving a request to join a free Session claims the
-- spot at once — there is no payment to wait for. Anyone already approved
-- and waiting in a free Session is registered now.
UPDATE session_participants sp
SET status = 'registered'
FROM sessions s
WHERE s.id = sp.session_id AND s.price_model = 'free' AND sp.status = 'waitlist';
