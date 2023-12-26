// @ts-ignore
import {Runs, RunCreateParams} from "openai/resources/beta/threads";

export const sendSticker: RunCreateParams.AssistantToolsFunction = {
  type: 'function',
  function: {
    name: 'sendSticker',
    description: 'Use this method to send static .WEBP, animated .TGS, or video .WEBM stickers.',
    parameters: {
      type: 'object',
      properties: {
        chat_id: {
          type: 'string',
          description: 'Unique identifier for the target chat or username of the target channel (in the format @channelusername).',
        },
        message_thread_id: {
          type: 'number',
          description: 'Unique identifier for the target message thread (topic) of the forum; for forum supergroups only',
          default: null,
        },
        sticker: {
          type: 'string',
          description: 'Sticker to send. Pass a file_id as String to send a file that exists on the Telegram servers (recommended), pass an HTTP URL as a String for Telegram to get a .WEBP sticker from the Internet, or upload a new .WEBP or .TGS sticker using multipart/form-data. More information on Sending Files ». Video stickers can only be sent by a file_id. Animated stickers can\'t be sent via an HTTP URL.',
        },
        emoji: {
          type: 'string',
          description: 'Emoji associated with the sticker; only for just uploaded stickers',
          default: null,
        },
        // disable_notification: {
        //   type: 'boolean',
        //   description: 'Sends the message silently. Users will receive a notification with no sound.',
        //   default: null,
        // },
        // protect_content: {
        //   type: 'boolean',
        //   description: 'Protects the contents of the sent message from forwarding and saving',
        //   default: null,
        // },
        reply_to_message_id: {
          type: 'number',
          description: 'If the message is a reply, ID of the original message',
          default: null,
        },
        // allow_sending_without_reply: {
        //   type: 'boolean',
        //   description: 'Pass True if the message should be sent even if the specified replied-to message is not found',
        //   default: null,
        // },
        reply_markup: {
          type: 'object',
          description: 'Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove reply keyboard or to force a reply from the user.',
          default: null
        }
      },
      required: ["chat_id"],
    }
  }
}