-- ATLAS Blog Generator: store an optional header image URL per article
-- (uploaded via Step 1 of the editor, stored in the shared Vercel Blob
-- store that the ATLAS Website also reads images from).

alter table scheduled_articles
  add column if not exists image_url text;
