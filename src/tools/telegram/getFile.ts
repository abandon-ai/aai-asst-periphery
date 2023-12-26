// @ts-ignore
import {Runs, RunCreateParams} from "openai/resources/beta/threads";

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