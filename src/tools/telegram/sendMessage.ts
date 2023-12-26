// @ts-ignore
import {RunCreateParams, Runs, RunSubmitToolOutputsParams} from "openai/resources/beta/threads";
import {redisClient} from "../../handler";

export const sendMessage: RunCreateParams.AssistantToolsFunction = {
  type: 'function',
  function: {
    name: 'sendMessage',
    description: 'Use this method to send text messages.',
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
        text: {
          type: 'string',
          description: 'Text of the message to be sent, 1-4096 characters.',
        },
        parse_mode: {
          type: 'string',
          description: 'Mode for parsing entities in the message text.',
          enum: ['Markdown', 'HTML', 'MarkdownV2'],
          default: null,
        },
        // disable_notification: {
        //   type: 'boolean',
        //   description: 'Sends the message silently. Users will receive a notification with no sound.',
        //   default: null,
        // },
        // disable_web_page_preview: {
        //   type: 'boolean',
        //   description: 'Disables link previews for links in this message',
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
      required: ["chat_id", "text"],
    }
  }
}

export const sendMessageHandler: (toolCall: Runs.RequiredActionFunctionToolCall, assistant_id: string) => Promise<RunSubmitToolOutputsParams.ToolOutput> = async (toolCall, assistant) => {
  if (toolCall.function.arguments) {
    const {
      chat_id,
      message_thread_id,
      text,
      parse_mode,
      reply_to_message_id,
      reply_markup
    } = JSON.parse(toolCall.function.arguments);
    const asst_info = await redisClient.get(`ASST#${assistant}`);
    // @ts-ignore
    const telegram = asst_info?.metadata?.telegram || undefined;
    if (!telegram) {
      return {
        tool_call_id: toolCall.id,
        output: 'This assistant is not configured to use Telegram.',
      }
    }
    try {
      const functionResponse = await fetch(`https://api.telegram.org/bot${telegram}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id,
          message_thread_id,
          text,
          parse_mode,
          reply_to_message_id,
          reply_markup,
        })
      }).then((res) => res.json());
      return {
        tool_call_id: toolCall.id,
        output: functionResponse,
      }
    } catch (e) {
      console.error(e);
      return {
        tool_call_id: toolCall.id,
        output: `Failed to send message.`,
      }
    }
  } else {
    return {
      tool_call_id: toolCall.id,
      output: `No arguments provided.`,
    }
  }
}