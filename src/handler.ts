import {Handler, SQSEvent} from "aws-lambda";
import OpenAI from "openai";
import {SendMessageCommand, SQSClient} from "@aws-sdk/client-sqs";
import {Redis} from "@upstash/redis";
import {functionHandlerMap, TelegramFunctions} from "./tools/telegram";
// @ts-ignore
import {RunSubmitToolOutputsParams} from "openai/resources/beta/threads";

export const sqsClient = new SQSClient({
  region: "ap-northeast-1",
});

export const redisClient = Redis.fromEnv();

const openai = new OpenAI();

export const handler: Handler = async (event: SQSEvent, context) => {
  const records = event.Records;
  for (const record of records) {
    const {messageAttributes, body} = record;
    const intent = messageAttributes?.intent?.stringValue || undefined;
    const from = messageAttributes?.from?.stringValue || undefined;

    const randomSecond = Math.floor(Math.random() * 100) + 100;
    if (intent === 'threads.runs.create') {
      if (from === "telegram") {
        const {thread_id, assistant_id} = JSON.parse(body);
        const {id} = await openai.beta.threads.runs.create(thread_id, {
          assistant_id,
          additional_instructions: 'You are a telegram bot now. You will receive a update from telegram API. Then, you should send message to target chat.',
          tools: TelegramFunctions,
        })

        await sqsClient.send(new SendMessageCommand({
          QueueUrl: process.env.AI_ASST_SQS_FIFO_URL,
          MessageBody: JSON.stringify({
            thread_id,
            run_id: id,
            assistant_id,
          }),
          MessageAttributes: {
            intent: {
              DataType: 'String',
              StringValue: 'threads.runs.retrieve'
            },
          },
          MessageDeduplicationId: `${thread_id}-${id}`,
        }))
      }
    } else if (intent === 'threads.runs.retrieve') {
      const {thread_id, run_id, assistant_id} = JSON.parse(body);
      const {status, required_action} = await openai.beta.threads.runs.retrieve(thread_id, run_id)
      console.log(thread_id, run_id, status);
      switch (status) {
        case "queued":
          // When Runs are first created or when you complete the required_action, they are moved to a queued status.
          // They should almost immediately move to in_progress.
          break;
        case "requires_action":
          // When using the Function calling tool, the Run will move to a required_action state once the model
          // determines the names and arguments of the functions to be called.
          // You must then run those functions and submit the outputs before the run proceeds.
          // If the outputs are not provided before the expires_at timestamp passes (roughly 10 mins past creation),
          // the run will move to an expired status.
          if (!required_action) {
            break;
          }
          const tool_calls = required_action.submit_tool_outputs.tool_calls;
          let tool_outputs: Array<RunSubmitToolOutputsParams.ToolOutput> = [];
          for (const toolCall of tool_calls) {
            const function_name = toolCall.function.name;
            const handler = functionHandlerMap[function_name!];
            if (!handler) {
              continue;
            }
            const tooOutPut = await handler(toolCall, assistant_id);
            tool_outputs.push(tooOutPut);
          }
          if (tool_outputs.length > 0) {
            await openai.beta.threads.runs.submitToolOutputs(thread_id, run_id, {
              tool_outputs,
            })
          } else {
            console.log("No tool outputs provided");
          }
          break;
        case "cancelling":
          // You can attempt to cancel an in_progress run using the Cancel Run endpoint.
          // Once the attempt to cancel succeeds, status of the Run moves to cancelled.
          // Cancellation is attempted but not guaranteed.
          break;
        case "in_progress":
          // While in_progress, the Assistant uses the model and tools to perform steps.
          // You can view progress being made by the Run by examining the Run Steps.
          break;
        case "completed":
        // The Run successfully completed! You can now view all Messages the Assistant added to the Thread,
        //  and all the steps the Run took.
        //  You can also continue the conversation by adding more user Messages to the Thread and creating another Run.
        case "failed":
        // You can view the reason for the failure by looking at the last_error object in the Run.
        // The timestamp for the failure will be recorded under failed_at.
        case "cancelled":
        // Run was successfully cancelled.
        case "expired":
          // This happens when the function calling outputs were not submitted before expires_at and the run expires.
          // Additionally, if the runs take too long to execute and go beyond the time stated in expires_at,
          // our systems will expire the run.
          break;
        default:
          break;
      }
    } else {
      console.log(intent, from)
    }
    // sleep randomSecond
    await new Promise((resolve) => setTimeout(resolve, randomSecond));
  }
  return `Successfully processed ${records.length} records.`;
}