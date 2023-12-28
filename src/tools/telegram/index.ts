import {sendMessage, sendMessageHandler} from "./sendMessage";
// @ts-ignore
import {RunCreateParams, Runs, RunSubmitToolOutputsParams} from "openai/resources/beta/threads";
import {sendDice, sendDiceHandler} from "./sendDice";
import {sendSticker, sendStickerHandler} from "./sendSticker";
import {forwardMessage, forwardMessageHandler} from "./forwardMessage";

export const TelegramFunctions: Array<RunCreateParams.AssistantToolsFunction> = [
  sendMessage,
  sendDice,
  sendSticker,
  forwardMessage,
]

export const functionHandlerMap: {
  [key: string]: (toolCall: Runs.RequiredActionFunctionToolCall, assistant: string) => Promise<RunSubmitToolOutputsParams.ToolOutput>
} = {
  sendMessage: sendMessageHandler,
  sendDice: sendDiceHandler,
  sendSticker: sendStickerHandler,
  forwardMessage: forwardMessageHandler,
}