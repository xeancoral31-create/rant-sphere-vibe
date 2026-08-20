import { PostWithMeta } from "@/components/post/PostCard";
import { MUSIC_LIBRARY } from "@/lib/music";

export interface DemoReel {
  id: string;
  author: {
    username: string;
    display_name: string;
    avatar_url: string;
  };
  video_url: string;
  thumbnail_url: string;
  caption: string;
  music_title: string;
  music_artist: string;
  likes: number;
  comments: number;
  is_ai: boolean;
}

export const SEED_POSTS: PostWithMeta[] = [
  {
    id: "demo-post-1",
    author_id: "demo-user-1",
    content: "Generated this cyberpunk sphere cityscape at 3 AM with neural rendering. The vibrant neon purple aesthetic is unmatched! ✨🏙️ #AIArt #Cyberpunk #NeonSphere",
    media_url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&h=800&fit=crop",
    post_type: "image",
    is_anonymous: false,
    is_hidden: false,
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    profiles: {
      username: "cyber_nova",
      display_name: "Nova Cyber 🌌",
      avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop",
    },
  },
  {
    id: "demo-post-2",
    author_id: "demo-user-2",
    content: "Just dropped a fresh lofi chill beat on OutLoud! Put on your headphones, relax, and let the sphere vibes take over. 🎧💜",
    media_url: JSON.stringify(MUSIC_LIBRARY[0]),
    post_type: "music",
    is_anonymous: false,
    is_hidden: false,
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    profiles: {
      username: "lofi_dreamer",
      display_name: "Lofi Dreamer 🎵",
      avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop",
    },
  },
  {
    id: "demo-post-3",
    author_id: "demo-user-3",
    content: "Morning run across Tokyo skyline before the rain starts. Always take time to breathe before the daily hustle! 🏃‍♂️🌧️ #TokyoVibes #MorningMindset",
    media_url: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&h=600&fit=crop",
    post_type: "image",
    is_anonymous: false,
    is_hidden: false,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    profiles: {
      username: "kenji_tokyo",
      display_name: "Kenji Sato 🗼",
      avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop",
    },
  },
  {
    id: "demo-post-4",
    author_id: "demo-user-4",
    content: "Reminder for today: You don't have to have everything figured out right now. Just show up, put in honest work, and trust the process.",
    media_url: JSON.stringify({ bg: "linear-gradient(135deg, #ff6b6b, #574b90)" }),
    post_type: "rant_gradient",
    is_anonymous: false,
    is_hidden: false,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    profiles: {
      username: "mindset_sphere",
      display_name: "Sphere Mindset 💡",
      avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop",
    },
  },
  {
    id: "demo-post-5",
    author_id: "demo-user-5",
    content: "AI Generated 3D bionic landscape experiment. The details on these glowing crystal shaders came out surreal! 🤖💎 #AIGenerated #3DArt #DigitalArt",
    media_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&h=800&fit=crop",
    post_type: "image",
    is_anonymous: false,
    is_hidden: false,
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    profiles: {
      username: "bionic_architect",
      display_name: "Aura AI Lab 🔮",
      avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop",
    },
  },
  {
    id: "demo-post-6",
    author_id: "demo-user-6",
    content: "Which UI aesthetic hits hardest in 2026? Vote below! 👇",
    media_url: null,
    post_type: "poll",
    is_anonymous: false,
    is_hidden: false,
    poll_options: [
      { text: "💜 Dark Purple Glassmorphism" },
      { text: "🖤 Minimalist Brutalism" },
      { text: "⚡ Cyberpunk Neon Glow" },
      { text: "🌿 Neo-Skeuomorphism" }
    ],
    created_at: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    profiles: {
      username: "ui_designer_sphere",
      display_name: "Alex Design 🎨",
      avatar_url: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&h=150&fit=crop",
    },
  },
  {
    id: "demo-post-7",
    author_id: "demo-user-7",
    content: "Cooking authentic spicy tonkotsu ramen from scratch on a rainy Saturday. 48 hour broth boiling! 🍜🔥 #FoodPorn #RamenLovers #ChefsOfSphere",
    media_url: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&h=600&fit=crop",
    post_type: "image",
    is_anonymous: false,
    is_hidden: false,
    created_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    profiles: {
      username: "chef_marcus",
      display_name: "Marcus Cole 🍳",
      avatar_url: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&h=150&fit=crop",
    },
  },
  {
    id: "demo-post-8",
    author_id: "demo-user-8",
    content: "Late night gaming setup complete. RTX 5090 paired with custom fluid loop. Let's play! 🎮⚡ #Battlestation #GamingRig #Cyberpunk",
    media_url: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=600&fit=crop",
    post_type: "image",
    is_anonymous: false,
    is_hidden: false,
    created_at: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    profiles: {
      username: "pixel_samurai",
      display_name: "Shadow Gamer 🕹️",
      avatar_url: "https://images.unsplash.com/photo-1628157582853-a796fa650a6a?w=150&h=150&fit=crop",
    },
  },
  {
    id: "demo-post-9",
    author_id: "demo-user-9",
    content: "Vibe check: Listening to SynthWave Pulse on the highway. 🌌🚗",
    media_url: JSON.stringify(MUSIC_LIBRARY[1]),
    post_type: "music",
    is_anonymous: false,
    is_hidden: false,
    created_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    profiles: {
      username: "synth_rider",
      display_name: "Elena Vance 🏎️",
      avatar_url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop",
    },
  },
  {
    id: "demo-post-10",
    author_id: "demo-user-10",
    content: "Captured this quiet sunset over the Swiss Alps. Nature never needs a filter. 🏔️✨ #TravelSphere #Alps #Wanderlust",
    media_url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&h=600&fit=crop",
    post_type: "image",
    is_anonymous: false,
    is_hidden: false,
    created_at: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    profiles: {
      username: "wanderer_leo",
      display_name: "Leo Travel 🧭",
      avatar_url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop",
    },
  },
];

export const DEMO_REELS: DemoReel[] = [
  {
    id: "reel-1",
    author: {
      username: "cyber_nova",
      display_name: "Nova Cyber 🌌",
      avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop",
    },
    video_url: "https://assets.mixkit.co/videos/preview/mixkit-futuristic-city-with-flying-cars-at-night-42217-large.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&h=900&fit=crop",
    caption: "Futuristic Neo-Tokyo rendering in 8K 🌃✨",
    music_title: "Neon Horizon",
    music_artist: "SynthWave Pulse",
    likes: 12400,
    comments: 342,
    is_ai: true,
  },
  {
    id: "reel-2",
    author: {
      username: "lofi_dreamer",
      display_name: "Lofi Dreamer 🎵",
      avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop",
    },
    video_url: "https://assets.mixkit.co/videos/preview/mixkit-liquid-neon-light-flows-in-a-loop-42867-large.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=900&fit=crop",
    caption: "Chill audio visualizer for late night coders 🎧💻",
    music_title: "Midnight Vibing",
    music_artist: "Lofi Dreamer",
    likes: 8900,
    comments: 198,
    is_ai: false,
  },
  {
    id: "reel-3",
    author: {
      username: "bionic_architect",
      display_name: "Aura AI Lab 🔮",
      avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop",
    },
    video_url: "https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-with-charts-31913-large.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&h=900&fit=crop",
    caption: "Neural network generative holographic shaders 🔮⚡",
    music_title: "Neural Groove 404",
    music_artist: "OutLoud AI",
    likes: 15600,
    comments: 489,
    is_ai: true,
  },
];
