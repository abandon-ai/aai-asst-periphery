// @ts-ignore
import {Runs, RunCreateParams, RunSubmitToolOutputsParams} from "openai/resources/beta/threads";
import {redisClient} from "../../handler";


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
        message_thread_id: {
          type: 'number',
          description: 'Unique identifier for the target message thread (topic) of the forum; for forum supergroups only',
          default: null,
        },
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

export const forwardMessageHandler: (toolCall: Runs.RequiredActionFunctionToolCall, assistant_id: string) => Promise<RunSubmitToolOutputsParams.ToolOutput> = async (toolCall, assistant) => {
  if (toolCall.function.arguments) {
    const {
      chat_id,
      message_thread_id,
      from_chat_id,
      message_id,
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
      const functionResponse = await fetch(`https://api.telegram.org/bot${telegram}/forwardMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id,
          message_thread_id,
          from_chat_id,
          message_id,
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
        output: `Failed to forward message.`,
      }
    }
  } else {
    return {
      tool_call_id: toolCall.id,
      output: `No arguments provided.`,
    }
  }
}