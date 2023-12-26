// @ts-ignore
import {Runs, RunCreateParams} from "openai/resources/beta/threads";

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