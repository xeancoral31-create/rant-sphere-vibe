export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  duration: string;
  coverUrl: string;
  audioUrl: string;
}

export const MUSIC_LIBRARY: MusicTrack[] = [
  {
    id: "track-1",
    title: "Midnight Vibing",
    artist: "Lofi Dreamer",
    genre: "Lofi / Chill",
    duration: "2:45",
    coverUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3",
  },
  {
    id: "track-2",
    title: "Neon City Drive",
    artist: "SynthWave Pulse",
    genre: "Synthwave",
    duration: "3:12",
    coverUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=future-ambient-118544.mp3",
  },
  {
    id: "track-3",
    title: "Purple Sunset Clouds",
    artist: "Aesthetic Beats",
    genre: "Chillhop",
    duration: "2:30",
    coverUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=chill-abstract-intention-12099.mp3",
  },
  {
    id: "track-4",
    title: "Unfiltered Emotion",
    artist: "Sphere Echo",
    genre: "Ambient",
    duration: "2:58",
    coverUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f792cb.mp3?filename=ambient-piano-amp-strings-10711.mp3",
  },
  {
    id: "track-5",
    title: "Cyberpunk Rant",
    artist: "Glitch Echo",
    genre: "Electronic",
    duration: "3:05",
    coverUrl: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/download/audio/2021/11/25/audio_94dd4822f3.mp3?filename=electronic-future-beats-117997.mp3",
  },
  {
    id: "track-6",
    title: "Coffee & Thoughts",
    artist: "Morning Dew",
    genre: "Acoustic / Chill",
    duration: "2:15",
    coverUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/01/26/audio_d0c6ff1101.mp3?filename=lofi-chill-medium-version-159456.mp3",
  },
];
