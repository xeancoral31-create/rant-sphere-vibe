# RantSphere v2 — Feature Expansion Plan

This is a large batch. I'll ship it in **5 focused phases** so each piece is testable. You can approve the whole plan and I'll execute end-to-end, or stop after any phase.

---

## Phase 1 — OTP Verification (Login + Register)

- Switch signup to Supabase **email OTP** (`signInWithOtp` + `verifyOtp`) instead of magic-link confirmation.
- New `/verify-otp` route with a 6-digit input (shadcn `input-otp`), resend cooldown, and error states.
- Register flow: collect email/username/password → send OTP → verify → create session → redirect home.
- Login flow: add a "Sign in with code" tab alongside password login.
- Profile auto-creation trigger already exists; nothing to change DB-side.

## Phase 2 — MyDay Polish (24h Stories)

- The 24h expiry already exists via `expires_at` default + RLS. Add:
  - Auto-advancing story viewer (progress bars per segment, tap-to-skip, swipe between authors).
  - Background color picker for text-only stories (uses existing `background` column).
  - Viewer list drawer for story owners (who saw it + timestamp).
  - Daily cleanup cron via `pg_cron` to hard-delete expired stories + their storage objects.

## Phase 3 — Polls, Reposts, Richer Interactions

- Extend `ComposeDialog` with **Poll mode**: 2–4 options, stored in `posts.poll_options` (JSONB), `post_type='poll'`.
- New `poll_votes` table (user_id, post_id, option_index) with RLS — one vote per user per poll.
- `PostCard` renders poll bars with live %s, realtime updates.
- **Reposts**: button creates a new post with `reposted_from` set; renders nested original card. Unrepost supported.
- **Comments UI**: inline comment thread under each post (the table already exists).
- **Reactions**: expand beyond `like` to 👍 ❤️ 😂 😮 😢 🔥 with a long-press/hover picker.
- **Bookmarks** table for save-for-later.

## Phase 4 — Video Posts + Hashtag Pages

- ComposeDialog accepts video uploads (`video/*`, 50MB cap, client-side validation) → `posts` bucket, `post_type='video'`.
- `PostCard` renders `<video controls playsInline>` with lazy loading + poster fallback.
- Hashtag extraction: parse `#tag` from post content on insert, upsert into `hashtags` + `post_hashtags`.
- New route `/_authenticated/tag.$tag.tsx`: header with tag name, post count, follower count; tabs for **Top** / **Latest** / **Media**.
- `trending.tsx` upgraded to show top hashtags (last 24h post count) alongside trending posts.

## Phase 5 — AI Moderation (Lovable AI)

- New server function `moderatePost` (createServerFn) called on post insert. Uses **Lovable AI Gateway** with `google/gemini-3-flash-preview` + structured output (zod schema → `{ toxicity, spam, hate, nsfw, reasoning }`).
- High-confidence violations:
  - **Auto-flag**: insert an auto-`report` row with reporter=system user, `reason='ai:<category>'`.
  - **Auto-hide**: add `is_hidden` boolean to `posts`; hidden posts only visible to author + mods.
- Admin dashboard upgraded: AI flag queue (sorted by score), one-click approve/remove, ban user shortcut.
- Same pipeline runs on comments.
- Manual user reports route through the same review queue.

---

## Technical Notes

- **DB migrations**: `poll_votes`, `bookmarks` tables; `is_hidden` + `ai_score` columns on `posts` and `comments`; `pg_cron` job for story cleanup; reactions check constraint relaxed to allow emoji set.
- **Secrets**: none required — `LOVABLE_API_KEY` is already provisioned for AI moderation.
- **Realtime**: poll vote counts, comment threads, and reactions all use existing Realtime channels.
- **Out of scope for this batch** (will queue for next round): 1-on-1 video calls, group chat polish, push notifications, mobile native app, payment-gated content.

Approve and I'll start with Phase 1.
