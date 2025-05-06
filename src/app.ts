import tmi from "tmi.js";
import consola from "consola"; // Import consola
import { env } from "./utils/env";
import { prismaConnect, prisma } from "./database";
import { io } from "socket.io-client";

/**
 * Type for cider player data
 */
interface Artwork {
  width: number;
  url: string;
  height: number;
  textColor3: string;
  textColor2: string;
  textColor4: string;
  textColor1: string;
  bgColor: string;
  hasP3: boolean;
}

interface PlayParams {
  id: string;
  kind: string;
  isLibrary: boolean;
  reporting: boolean;
  catalogId: string;
  reportingId: string;
}

// Based on the provided data, the preview object is empty.
// If there are actual properties in the preview, you would add them here.
interface Preview {}

interface TrackData {
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

/**
 * Import Environment variables
 */
const TWITCH_USERNAME = env.TWITCH_USERNAME;
const TWITCH_OAUTH = env.TWITCH_OAUTH;
const TWITCH_CHANNEL = env.TWITCH_CHANNEL;

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
  channels: [TWITCH_CHANNEL],
});

client.connect();

const prefix = "!";

client.on("message", async (channel, tags, message, self) => {
  if (self) return;

  const lowerCaseMessage = message.toLowerCase().trim();

  const isCommand = lowerCaseMessage.startsWith(prefix);

  if (!isCommand) return;

  // Extract the command
  const args = lowerCaseMessage.slice(prefix.length).split(" ");
  const command = args.shift();

  switch (command) {
    case "song":
    case "music":
    case "track":
    case "nowplaying":
      /**
       * This is a command to get the current song playing
       * with aliases like "song", "music", "track", "nowplaying"
       * returns "Now Playing: <song name> by <artist> from the album <album> | URL: <url>"
       * It also checks if the song is in the database
       */
      try {
        const currentSong = await prisma.playedSongs.findFirst({
          orderBy: {
            createdAt: "desc",
          },
        });
        if (!currentSong) {
          client.say(
            channel,
            `@${tags.username}, No song is currently playing or it has not been added to the database.`
          );
        } else {
          client.say(
            channel,
            `Now Playing: ${currentSong.name} by ${currentSong.artist} from the album ${currentSong.album} | URL: ${currentSong.url}`
          );
        }
      } catch (error) {
        consola.error("Error fetching current song:", error);
        client.say(
          channel,
          `@${tags.username}, An error occurred while fetching the current song. Please try again later.`
        );
      }
      break;

    case "lastsong":
    case "lasttrack":
    case "lastmusic":
      /**
       * This is a command to get the last song played
       * with aliases like "lastsong", "lasttrack", "lastmusic"
       * returns "Last Played: <song name> by <artist> from the album <album> | URL: <url>"
       */
      try {
        const lastSongData = await prisma.playedSongs.findMany({
          orderBy: {
            createdAt: "desc",
          },
          take: 2,
        });

        if (!lastSongData || lastSongData.length < 2) {
          client.say(
            channel,
            `@${tags.username}, No previous song has been played or added to the database.`
          );
        } else {
          client.say(
            channel,
            `Last Played: ${lastSongData[1].name} by ${lastSongData[1].artist} from the album ${lastSongData[1].album} | URL: ${lastSongData[1].url}`
          );
        }
      } catch (error) {
        consola.error("Error fetching last song:", error);
        client.say(
          channel,
          `@${tags.username}, An error occurred while fetching the last song. Please try again later.`
        );
      }
      break;

    default:
      consola.info(
        `Command not recognized: ${command} in channel ${channel} from ${tags.username}`
      );
      break;
  }
});

client.on("connected", (addr, port) => {
  consola.success(`Connected to Twitch: ${addr}:${port}`);
});

/**
 * Connect to Cid's WebSocket Server
 */

// Connect to the Socket.IO server
const socket = io("http://localhost:10767", {
  transports: ["websocket"], // Specify the transport method
});

// Event listener for connection
socket.on("connect", () => {
  consola.success("Connected to the Cider WebSocket server");
});

// Event listener for messages from the server
socket.on("API:Playback", async (data: { type: string; data: TrackData }) => {
  if (data.type === "playbackStatus.nowPlayingItemDidChange") {
    const trackData = data.data;
    const region = "us"; // Or any desired region code
    const trackCatalogId = trackData.playParams.catalogId;
    const songTitleSlug = trackData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""); // Simple slug generation

    const appleMusicUrl = `https://music.apple.com/${region}/song/${songTitleSlug}/${trackCatalogId}`;

    try {
      await prisma.playedSongs.create({
        data: {
          name: trackData.name,
          artist: trackData.artistName,
          album: trackData.albumName,
          url: appleMusicUrl || "No URL provided",
        },
      });
      consola.info(
        `Added "${trackData.name} by ${trackData.artistName}" to played songs.`
      );
    } catch (error) {
      consola.error("Error adding song to database:", error);
    }
  }
});

// Event listener for disconnection
socket.on("disconnect", () => {
  consola.warn("Disconnected from the Cider WebSocket server");
});

// Event listener for errors
socket.on("error", (error: any) => {
  consola.error("Socket.IO error:", error);
});
