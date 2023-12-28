// @ts-ignore
import {Runs, RunCreateParams, RunSubmitToolOutputsParams} from "openai/resources/beta/threads";
import redisClient from "../../utils/redisClient";

export const getUserProfilePhotos: RunCreateParams.AssistantToolsFunction = {
  type: 'function',
  function: {
    name: 'getUserProfilePhotos',
    description: 'Use this method to get a list of profile pictures for a user.',
    parameters: {
      type: 'object',
      properties: {
        user_id: {
          type: 'integer',
          description: 'Unique identifier of the target user',
        },
        offset: {
          type: 'integer',
          description: 'Sequential number of the first photo to be returned. By default, all photos are returned.',
          default: 0
        },
        limit: {
          type: 'integer',
          description: 'Limits the number of photos to be retrieved. Values between 1—100 are accepted. Defaults to 100.',
          default: 100
        }
      },
      required: ["user_id"],
    }
  }
}

export const getUserProfilePhotosHandler: (toolCall: Runs.RequiredActionFunctionToolCall, assistant_id: string) => Promise<RunSubmitToolOutputsParams.ToolOutput> = async (toolCall, assistant) => {
  if (toolCall.function.arguments) {
    const {
      user_id,
      offset,
      limit,
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
      const functionResponse = await fetch(`https://api.telegram.org/bot${telegram}/getUserProfilePhotos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id,
          offset,
          limit,
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
        output: `Failed to get user profile photos`,
      }
    }
  } else {
    return {
      tool_call_id: toolCall.id,
      output: `No arguments provided.`,
    }
  }
}