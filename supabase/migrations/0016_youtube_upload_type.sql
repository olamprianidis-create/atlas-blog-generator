-- Stat.ATLAS: let the admin choose "Video" vs "Short" per YouTube upload.
--
-- YouTube's API has no explicit "make this a Short" flag — a video under
-- 3 minutes gets classified as a Short when its title or description
-- contains "#Shorts" (see utils/youtube.ts's uploadVideoToYoutube). This
-- column just remembers which the admin picked, so the tag can be applied
-- consistently whether the video publishes immediately or later via cron.
alter table video_uploads add column if not exists youtube_upload_type text not null default 'video'
  check (youtube_upload_type in ('video', 'short'));
