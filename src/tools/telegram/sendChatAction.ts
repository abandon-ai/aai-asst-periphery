// @ts-ignore
import {Runs, RunCreateParams, RunSubmitToolOutputsParams} from "openai/resources/beta/threads";
import {redisClient} from "../../handler";

export const sendChatAction: RunCreateParams.AssistantToolsFunction = {
  type: 'function',
  function: {
    name: 'sendChatAction',
    description: 'Use this method when you need to tell the user that something is happening on the bot\'s side. The status is set for 5 seconds or less (when a message arrives from your bot, Telegram clients clear its typing status).',
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
        action: {
          type: 'string',
          description: 'Type of action to broadcast. Choose one, depending on what the user is about to receive: typing for text messages, upload_photo for photos, record_video or upload_video for videos, record_voice or upload_voice for voice notes, upload_document for general files, choose_sticker for stickers, find_location for location data, record_video_note or upload_video_note for video notes.',
          enum: ['typing', 'upload_photo', 'record_video', 'upload_video', 'record_voice', 'upload_voice', 'upload_document', 'choose_sticker', 'find_location', 'record_video_note', 'upload_video_note'],
          default: 'typing',
        },
      },
      required: ["chat_id", "action"],
    }
  }
}

export const sendChatActionHandler: (toolCall: Runs.RequiredActionFunctionToolCall, assistant_id: string) => Promise<RunSubmitToolOutputsParams.ToolOutput> = async (toolCall, assistant) => {
  if (toolCall.function.arguments) {
    const {chat_id, message_thread_id, action} = JSON.parse(toolCall.function.arguments);
    const asst_info = await redisClient.get(`ASST#${assistant}`);
    // @ts-ignore
    const telegram = asst_info?.metadata?.telegram || undefined;
    if (!telegram) {
      return {
        tool_call_id: toolCall.id,
        output: `This assistant is not configured to use Telegram.`,
      }
    }
    try {
      return await fetch(`https://api.telegram.org/bot${telegram}/sendChatAction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id,
          message_thread_id,
          action
        })
      }).then((res) => res.json())
    } catch (e) {
      console.error(e);
      return {
        tool_call_id: toolCall.id,
        output: `Failed to send chat action.`,
      }
    }
  } else {
    return {
      tool_call_id: toolCall.id,
      output: `No arguments provided.`,
    }
  }
}