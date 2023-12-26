// @ts-ignore
import {Runs, RunCreateParams, RunSubmitToolOutputsParams} from "openai/resources/beta/threads";
import {redisClient} from "../../handler";

export const getFile: RunCreateParams.AssistantToolsFunction = {
  type: 'function',
  function: {
    name: 'getFile',
    description: 'Use this method to get basic information about a file and prepare it for downloading. For the moment, bots can download files of up to 20MB in size.',
    parameters: {
      type: 'object',
      properties: {
        file_id: {
          type: 'string',
          description: 'File identifier to get information about',
        },
      },
      required: ["file_id"],
    }
  }
}

export const getFileHandler: (toolCall: Runs.RequiredActionFunctionToolCall, assistant_id: string) => Promise<RunSubmitToolOutputsParams.ToolOutput> = async (toolCall, assistant) => {
  if (toolCall.function.arguments) {
    const {
      file_id,
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
      const functionResponse = await fetch(`https://api.telegram.org/bot${telegram}/getFile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file_id,
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
        output: `Failed to get file`,
      }
    }
  } else {
    return {
      tool_call_id: toolCall.id,
      output: `No arguments provided.`,
    }
  }
}