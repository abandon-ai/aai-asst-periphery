// @ts-ignore
import {Runs, RunCreateParams} from "openai/resources/beta/threads";

export const sendDice: RunCreateParams.AssistantToolsFunction = {
  type: 'function',
  function: {
    name: 'sendDice',
    description: 'Use this method to send an animated emoji that will display a random value.',
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
        emoji: {
          type: 'string',
          description: 'Emoji on which the dice throw animation is based. Currently, must be one of “🎲”, “🎯”, “🏀”, “⚽”, “🎳”, or “🎰”. Dice can have values 1-6 for “🎲”, “🎯” and “🎳”, values 1-5 for “🏀” and “⚽”, and values 1-64 for “🎰”. Defaults to “🎲”',
          default: '🎲',
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