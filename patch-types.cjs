const fs = require('fs');

const path = 'src/integrations/supabase/types.ts';
let content = fs.readFileSync(path, 'utf8');

const missingTables = `
      friend_requests: {
        Row: any
        Insert: any
        Update: any
        Relationships: []
      }
      friendships: {
        Row: any
        Insert: any
        Update: any
        Relationships: []
      }
      group_activity: {
        Row: any
        Insert: any
        Update: any
        Relationships: []
      }
      group_invitations: {
        Row: any
        Insert: any
        Update: any
        Relationships: []
      }
      group_poll_options: {
        Row: any
        Insert: any
        Update: any
        Relationships: []
      }
      group_poll_votes: {
        Row: any
        Insert: any
        Update: any
        Relationships: []
      }
      group_polls: {
        Row: any
        Insert: any
        Update: any
        Relationships: []
      }
      location_sharing_sessions: {
        Row: any
        Insert: any
        Update: any
        Relationships: []
      }
      message_attachments: {
        Row: {
          created_at: string
          duration_seconds: number | null
          file_name: string | null
          height: number | null
          id: string
          message_id: string
          mime_type: string | null
          size_bytes: number | null
          thumbnail_url: string | null
          url: string
          width: number | null
        }
        Insert: any
        Update: any
        Relationships: []
      }
      message_reactions: {
        Row: any
        Insert: any
        Update: any
        Relationships: []
      }
      pinned_messages: {
        Row: any
        Insert: any
        Update: any
        Relationships: []
      }
      trusted_contacts: {
        Row: any
        Insert: any
        Update: any
        Relationships: []
      }
`;

if (!content.includes('friend_requests: {')) {
  content = content.replace('      user_settings: {', missingTables + '      user_settings: {');
}

content = content.replace(/conversations: {\s+Row: {/g, 'conversations: {\n        Row: {\n          is_barkada: boolean\n          description: string | null\n          avatar_url: string | null\n          created_by: string | null');
content = content.replace(/conversations: {\s*Row: {([\s\S]*?)Insert: {/g, function(match) {
  if (match.includes('is_barkada?: boolean')) return match;
  return match.replace('Insert: {', 'Insert: {\n          is_barkada?: boolean\n          description?: string | null\n          avatar_url?: string | null\n          created_by?: string | null');
});
content = content.replace(/conversations: {[\s\S]*?Update: {/g, function(match) {
  if (match.includes('is_barkada?: boolean')) return match;
  return match.replace('Update: {', 'Update: {\n          is_barkada?: boolean\n          description?: string | null\n          avatar_url?: string | null\n          created_by?: string | null');
});

content = content.replace(/messages: {\s+Row: {/g, 'messages: {\n        Row: {\n          message_type: string\n          reply_to: string | null\n          metadata: any\n          client_id: string | null\n          edited_at: string | null');
content = content.replace(/messages: {\s*Row: {([\s\S]*?)Insert: {/g, function(match) {
  if (match.includes('message_type?: string')) return match;
  return match.replace('Insert: {', 'Insert: {\n          message_type?: string\n          reply_to?: string | null\n          metadata?: any\n          client_id?: string | null\n          edited_at?: string | null');
});
content = content.replace(/messages: {[\s\S]*?Update: {/g, function(match) {
  if (match.includes('message_type?: string')) return match;
  return match.replace('Update: {', 'Update: {\n          message_type?: string\n          reply_to?: string | null\n          metadata?: any\n          client_id?: string | null\n          edited_at?: string | null');
});

fs.writeFileSync(path, content, 'utf8');
console.log('patched');
