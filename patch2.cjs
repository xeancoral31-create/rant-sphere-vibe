const fs = require('fs');
let c = fs.readFileSync('src/integrations/supabase/types.ts', 'utf8');
c = c.replace(/"like" \| "comment" \| "follow" \| "mention" \| "reply" \| "share" \| "story_view" \| "message"/g, 
  '"like" | "comment" | "follow" | "mention" | "reply" | "share" | "story_view" | "message" | "friend_request" | "friend_accepted" | "group_invite" | "group_message" | "location_shared" | "emergency"');
c = c.replace(/conversation_participants: {\s*Row: {([\s\S]*?)Insert: {/g, function(match) {
  if (match.includes('role: string')) return match;
  return match.replace('Insert: {', '  role: string\n          muted_until: string | null\n          last_read_at: string | null\n        Insert: {');
});
c = c.replace(/conversation_participants: {[\s\S]*?Insert: {([\s\S]*?)Update: {/g, function(match) {
  if (match.includes('role?: string')) return match;
  return match.replace('Update: {', '  role?: string\n          muted_until?: string | null\n          last_read_at?: string | null\n        Update: {');
});
c = c.replace(/conversation_participants: {[\s\S]*?Update: {([\s\S]*?)Relationships:/g, function(match) {
  if (match.includes('role?: string')) return match;
  return match.replace('Relationships:', '  role?: string\n          muted_until?: string | null\n          last_read_at?: string | null\n        Relationships:');
});
fs.writeFileSync('src/integrations/supabase/types.ts', c);
