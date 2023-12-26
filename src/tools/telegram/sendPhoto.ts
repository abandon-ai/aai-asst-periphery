// @ts-ignore
import {RunCreateParams} from "openai/resources/beta/threads";

export const sendPhoto: RunCreateParams.AssistantToolsFunction = {
  type: 'function',
  function: {
    name: 'sendPhoto',
    description: 'Use this method to send photos',
    parameters: {
      type: 'object',
      properties: {
        chat_id: {
          type: 'string',
          description: 'Unique identifier for the target chat or username of the target channel (in the format @channelusername).',
        },
        // message_thread_id: {
        //   type: 'number',
        //   description: 'Unique identifier for the target message thread (topic) of the forum; for forum supergroups only',
        //   default: null,
        // },
        photo: {
          type: 'string',
          description: 'Photo to send. Pass a file_id as String to send a photo that exists on the Telegram servers (recommended), pass an HTTP URL as a String for Telegram to get a photo from the Internet, or upload a new photo using multipart/form-data. The photo must be at most 10 MB in size. The photo\'s width and height must not exceed 10000 in total. Width and height ratio must be at most 20',
        },
        caption: {
          type: 'string',
          description: 'Photo caption (may also be used when resending photos by file_id), 0-1024 characters after entities parsing',
          default: null,
        },
        parse_mode: {
          type: 'string',
          description: 'Mode for parsing entities in the photo caption. See formatting options for more details.',
          enum: ['Markdown', 'HTML', 'MarkdownV2'],
          default: null,
        },
        has_spoiler: {
          type: 'boolean',
          description: 'Pass True if the photo needs to be covered with a spoiler animation',
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
      required: ["chat_id", "photo"],
    }
  }
}