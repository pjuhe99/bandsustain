-- 005_live_events_seed.sql
-- /live 시각 확인용 더미. 실 운영 데이터로 교체되면 더 이상 필요 없음.

INSERT INTO live_events (event_date, venue, city, ticket_url, video_url, published) VALUES
  ('2026-06-12', 'Rolling Hall', 'Seoul', 'https://example.com/tickets/rolling-hall', NULL, 1),
  ('2025-12-14', 'Club FF',      'Seoul', NULL, 'https://example.com/live/club-ff-2025-demo-video', 1);
