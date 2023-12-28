import {sendMessage, sendMessageHandler} from "./sendMessage";
// @ts-ignore
import {RunCreateParams, Runs, RunSubmitToolOutputsParams} from "openai/resources/beta/threads";

export const TelegramFunctions: Array<RunCreateParams.AssistantToolsFunction> = [
  sendMessage,
]

export const functionHandlerMap: {
  [key: string]: (toolCall: Runs.RequiredActionFunctionToolCall, assistant: string) => Promise<RunSubmitToolOutputsParams.ToolOutput>
} = {
  sendMessage: sendMessageHandler,
}