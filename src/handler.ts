import {Handler, SQSEvent} from "aws-lambda";
import OpenAI from "openai";
import {ChangeMessageVisibilityCommand, DeleteMessageCommand, SendMessageCommand, SQSClient} from "@aws-sdk/client-sqs";
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
    const {messageAttributes, body, receiptHandle} = record;
    const intent = messageAttributes?.intent?.stringValue || undefined;
    const from = messageAttributes?.from?.stringValue || undefined;

    const randomSecond = Math.floor(Math.random() * 100) + 100;
    if (intent === 'threads.runs.create') {
      if (from === "telegram") {
        const {thread_id, assistant_id} = JSON.parse(body);
        try {
          const {id: run_id} = await openai.beta.threads.runs.create(thread_id, {
            assistant_id,
            additional_instructions: 'You are a telegram bot now. You will receive a update from telegram API. Then, you should send message to target chat.',
            tools: TelegramFunctions,
          })

          await sqsClient.send(new SendMessageCommand({
            QueueUrl: process.env.AI_ASST_SQS_FIFO_URL,
            MessageBody: JSON.stringify({
              thread_id,
              run_id,
              assistant_id,
            }),
            MessageAttributes: {
              intent: {
                DataType: 'String',
                StringValue: 'threads.runs.retrieve'
              },
            },
            MessageGroupId: `${assistant_id}-${thread_id}`,
            MessageDeduplicationId: `${assistant_id}-${thread_id}-${run_id}`,
          }))
        } catch (e) {
          console.log("Failed to create run", e);
        }
      }
      await sqsClient.send(new DeleteMessageCommand({
        QueueUrl: process.env.AI_ASST_SQS_FIFO_URL,
        ReceiptHandle: receiptHandle,
      }))
    } else if (intent === 'threads.runs.retrieve') {
      const {thread_id, run_id, assistant_id} = JSON.parse(body);
      try {
        const {status, required_action} = await openai.beta.threads.runs.retrieve(thread_id, run_id);
        console.log(thread_id, run_id, status);
        switch (status) {
          // When Runs are first created or when you complete the required_action, they are moved to a queued status.
          // They should almost immediately move to in_progress.
          case "queued":
          // While in_progress, the Assistant uses the model and tools to perform steps.
          // You can view progress being made by the Run by examining the Run Steps.
          case "in_progress":
            console.log("Change message visibility to 10 seconds");
            await sqsClient.send(new ChangeMessageVisibilityCommand({
              QueueUrl: process.env.AI_ASST_SQS_FIFO_URL,
              ReceiptHandle: receiptHandle,
              VisibilityTimeout: 10,
            }))
            break;
          // When using the Function calling tool, the Run will move to a required_action state once the model
          // determines the names and arguments of the functions to be called.
          // You must then run those functions and submit the outputs before the run proceeds.
          // If the outputs are not provided before the expires_at timestamp passes (roughly 10 mins past creation),
          // the run will move to an expired status.
          case "requires_action":
            if (!required_action) {
              console.log("Required action not found");
              break;
            }
            const tool_calls = required_action.submit_tool_outputs.tool_calls;
            if (tool_calls.length === 0) {
              console.log("No tool calls found");
              break;
            }
            let tool_outputs_promises = [];
            for (const toolCall of tool_calls) {
              const function_name = toolCall.function.name;
              console.log("function_name", function_name);
              const handler = functionHandlerMap[function_name!];
              if (handler) {
                // Instead of awaiting each handler, push the promise into an array
                tool_outputs_promises.push(handler(toolCall, assistant_id));
              } else {
                console.log(`Function ${function_name} not found`);
              }
            }
            if (tool_outputs_promises.length === 0) {
              console.log("No tool outputs found");
              break;
            }
            Promise.all(tool_outputs_promises).then((tool_outputs: Array<RunSubmitToolOutputsParams.ToolOutput>) => {
              openai.beta.threads.runs.submitToolOutputs(thread_id, run_id, {
                tool_outputs,
              });
            }).catch(error => {
              // Handle errors for any of the promises
              console.error("Error while processing tool outputs:", error);
            });
            break;
          // You can attempt to cancel an in_progress run using the Cancel Run endpoint.
          // Once the attempt to cancel succeeds, status of the Run moves to cancelled.
          // Cancellation is attempted but not guaranteed.
          case "cancelling":
          // The Run successfully completed! You can now view all Messages the Assistant added to the Thread, and all the steps the Run took.
          // You can also continue the conversation by adding more user Messages to the Thread and creating another Run.
          case "completed":
          // You can view the reason for the failure by looking at the last_error object in the Run.
          // The timestamp for the failure will be recorded under failed_at.
          case "failed":
          // Run was successfully cancelled.
          case "cancelled":
          // This happens when the function calling outputs were not submitted before expires_at and the run expires.
          // Additionally, if the runs take too long to execute and go beyond the time stated in expires_at,
          // our systems will expire the run.
          case "expired":
            // Delete the SQS message
            console.log("Deleted message");
            await sqsClient.send(new DeleteMessageCommand({
              QueueUrl: process.env.AI_ASST_SQS_FIFO_URL,
              ReceiptHandle: receiptHandle,
            }))
            break;
          default:
            break;
        }
      } catch (e) {
        console.log(e)
      }
    } else {
      console.log(intent, from)
    }
    // sleep randomSecond
    await new Promise((resolve) => setTimeout(resolve, randomSecond));
  }
  return `Successfully processed ${records.length} records.`;
}