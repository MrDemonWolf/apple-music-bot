import type { Artwork } from "./Artwork";
import type { PlayParams } from "./PlayParams";
import type { Preview } from "./Preview";

export interface TrackData {
  albumName: string;
  discNumber: number;
  genreNames: string[];
  hasLyrics: boolean;
  trackNumber: number;
  releaseDate: string;
  durationInMillis: number;
  name: string;
  artistName: string;
  contentRating: string;
  artwork: Artwork;
  playParams: PlayParams;
  composerName?: string;
  isrc?: string;
  previews: Preview[];
  currentPlaybackTime: number;
  remainingTime: number;
}
