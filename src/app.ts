import tmi from "tmi.js";
import { env } from "./utils/env";
import { prismaConnect, prisma } from "./database";

/**
 * Type for cider player data
 */
interface Artwork {
  width: number;
  height: number;
  url: string;
}

interface PlayParams {
  id: string;
  kind: string;
}

interface Preview {
  // Define the structure of the preview object if known
  // For example, if it has properties like url and duration, you can define them here
  url: string; // Example property
  durationInMillis: number; // Example property
}

interface MusicData {
  hasTimeSyncedLyrics: boolean;
  albumName: string;
  genreNames: string[];
  trackNumber: number;
  durationInMillis: number;
  releaseDate: string; // ISO 8601 format
  isVocalAttenuationAllowed: boolean;
  isMasteredForItunes: boolean;
  isrc: string;
  artwork: Artwork;
  composerName: string;
  audioLocale: string;
  url: string;
  playParams: PlayParams;
  discNumber: number;
  isAppleDigitalMaster: boolean;
  hasLyrics: boolean;
  audioTraits: string[];
  name: string;
  previews: Preview[]; // Array of preview objects
  artistName: string;
  currentPlaybackTime: number;
  remainingTime: number;
}

/**
 * Import Environment variables
 */
const TWITCH_USERNAME = env.TWITCH_USERNAME;
const TWITCH_OAUTH = env.TWITCH_OAUTH;
const TWITCH_CHANNEL = ["#mrdemonwolf"];

/**
 * Connect to the database
 */
prismaConnect();

/**
 * Purge old songs from the database
 */
async function purgeOldSongs() {
  await prisma.playedSongs.deleteMany({});
}

purgeOldSongs();
const client = new tmi.Client({
  options: { debug: true },
  identity: {
    username: TWITCH_USERNAME,
    password: TWITCH_OAUTH,
  },
  channels: TWITCH_CHANNEL,
});

client.connect();

client.on("message", async (channel, tags, message, self) => {
  if (self) return;

  const multiCommandAliases = ["song", "music", "track", "nowplaying"];
  if (
    multiCommandAliases.some((alias) => message.toLowerCase().includes(alias))
  ) {
    const currentSong = await prisma.playedSongs.findFirst({
      orderBy: {
        createdAt: "desc",
      },
    });
    if (!currentSong)
      return client.say(
        channel,
        `No song is currently playing or it has not been added to the database.`
      );
    return client.say(
      channel,
      `Now Playing: ${currentSong.name} by ${currentSong.artist} from the album ${currentSong.album} | URL: ${currentSong.url}`
    );
  }

  // now one for last song with mutli aliases
  const lastSongAliases = ["lastsong", "lasttrack", "lastmusic"];
  if (lastSongAliases.some((alias) => message.toLowerCase().includes(alias))) {
    const lastSongData = await prisma.playedSongs.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    const lastSong = lastSongData[1];

    if (!lastSongData)
      return client.say(
        channel,
        `No song has been played or it has not been added to the database.`
      );
    return client.say(
      channel,
      `Last Played: ${lastSong.name} by ${lastSong.artist} from the album ${lastSong.album} | URL: ${lastSong.url}`
    );
  }
});

/**
 * Connect to Cid's WebSocket Server
 */

// client.js
import { io } from "socket.io-client";

// Connect to the Socket.IO server
const socket = io("http://localhost:10767", {
  transports: ["websocket"], // Specify the transport method
});

// Event listener for connection
socket.on("connect", () => {
  console.log("Connected to the server");
});

// Event listener for messages from the server
socket.on("API:Playback", async (data: { type: any; data: MusicData }) => {
  if (data.type === "playbackStatus.nowPlayingItemDidChange") {
    await prisma.playedSongs.create({
      data: {
        name: data.data.name,
        artist: data.data.artistName,
        album: data.data.albumName,
        url: data.data.url,
      },
    });
  }
});

// Event listener for disconnection
socket.on("disconnect", () => {
  console.log("Disconnected from the server");
});

// Event listener for errors
socket.on("error", (error: any) => {
  console.error("Socket.IO error:", error);
});
