// @ts-ignore
import {Runs, RunCreateParams} from "openai/resources/beta/threads";


export const forwardMessage: RunCreateParams.AssistantToolsFunction = {
  type: 'function',
  function: {
    name: 'forwardMessage',
    description: 'Use this method to forward messages of any kind. Service messages can\'t be forwarded. On success, the sent Message is returned.',
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
        from_chat_id: {
          type: 'string',
          description: 'Unique identifier for the chat where the original message was sent (or channel username in the format @channelusername)',
        },
        // disable_notification: {
        //   type: 'boolean',
        //   description: 'Sends the message silently. Users will receive a notification with no sound.',
        //   default: null,
        // },
        // protect_content: {
        //   type: 'boolean',
        //   description: 'Protects the contents of the forwarded message from forwarding and saving',
        // },
        message_id: {
          type: 'boolean',
          description: 'Message identifier in the chat specified in from_chat_id',
        },
      },
      required: ["chat_id", "from_chat_id", "message_id"],
    }
  }
}