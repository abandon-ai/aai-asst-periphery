import {sendMessage, sendMessageHandler} from "./sendMessage";
import {sendChatAction, sendChatActionHandler} from "./sendChatAction";
// @ts-ignore
import {Runs, RunSubmitToolOutputsParams} from "openai/resources/beta/threads";

export const TelegramFunctions: any[] = [
  sendMessage,
  sendChatAction,
]

export const functionHandlerMap: {[key: string]: (toolCall: Runs.RequiredActionFunctionToolCall, assistant_id: string) => Promise<RunSubmitToolOutputsParams.ToolOutput>} = {
  sendMessage: sendMessageHandler,
  sendChatAction: sendChatActionHandler,
}