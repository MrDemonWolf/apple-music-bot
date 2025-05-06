import { ChatUserstate } from "tmi.js";

export type CommandHandler = (
  channel: string,
  tags: ChatUserstate,
  message: string,
  self: boolean,
  client: any // Replace with a more specific client type if available
) => Promise<void> | void;

export interface Command {
  aliases: string[];
  handler: CommandHandler;
}
