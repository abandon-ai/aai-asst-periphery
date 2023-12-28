import {Handler, SQSEvent} from "aws-lambda";
import OpenAI from "openai";
import {SendMessageCommand, ChangeMessageVisibilityCommand} from "@aws-sdk/client-sqs";
import {UpdateCommand} from "@aws-sdk/lib-dynamodb";
import {functionHandlerMap, TelegramFunctions} from "./tools/telegram";
import sqsClient from "./utils/sqsClient";
import ddbDocClient from "./utils/ddbDocClient";
import redisClient from "./utils/redisClient";
import backOffSecond from "./utils/backOffSecond";

const openai = new OpenAI();

export const handler: Handler = async (event: SQSEvent, context) => {
  const records = event.Records;
  for (const record of records) {
    const {messageAttributes, body, receiptHandle} = record;
    const nextNonce = await redisClient.incr(receiptHandle);
    const intent = messageAttributes?.intent?.stringValue || undefined;
    const from = messageAttributes?.from?.stringValue || undefined;

    if (intent === 'threads.runs.create') {
      if (from === "telegram") {
        const {thread_id, assistant_id, update_id, token, chat_id} = JSON.parse(body);
        console.log("threads.runs.create")
        try {
          const {id: run_id} = await openai.beta.threads.runs.create(thread_id, {
            assistant_id,
            additional_instructions: 'You are a telegram bot now. You will receive a update from telegram API. Then, you should send message to target chat.',
            tools: TelegramFunctions,
          });
          await sqsClient.send(new SendMessageCommand({
            QueueUrl: process.env.AI_ASST_SQS_FIFO_URL,
            MessageBody: JSON.stringify({
              thread_id,
              run_id,
              assistant_id,
              update_id,
              token,
              chat_id,
            }),
            MessageAttributes: {
              intent: {
                DataType: 'String',
                StringValue: 'threads.runs.retrieve'
              },
            },
            MessageGroupId: `${assistant_id}-${thread_id}`,
          }));
          await ddbDocClient.send(new UpdateCommand({
            TableName: "abandonai-prod",
            Key: {
              PK: `ASST#${assistant_id}`,
              SK: `THREAD#${thread_id}`,
            },
            ExpressionAttributeNames: {
              "#runs": "runs",
              "#updated": "updated",
            },
            ExpressionAttributeValues: {
              ":empty_list": [],
              ":runs": [run_id],
              ":updated": Math.floor(Date.now() / 1000),
            },
            UpdateExpression:
              "SET #runs = list_append(if_not_exists(#runs, :empty_list), :runs), #updated = :updated",
          }));
          await redisClient.del(receiptHandle);
          console.log(run_id);
        } catch (e) {
          await sqsClient.send(new ChangeMessageVisibilityCommand({
            QueueUrl: process.env.AI_ASST_SQS_FIFO_URL,
            ReceiptHandle: receiptHandle,
            VisibilityTimeout: backOffSecond(nextNonce - 1),
          }))
          throw new Error("Failed to create run");
        }
      } else {
        console.log("Not from telegram");
      }
    } else if (intent === 'threads.runs.retrieve') {
      const {thread_id, run_id, assistant_id, token, chat_id} = JSON.parse(body);
      console.log("threads.runs.retrieve");
      try {
        const {status, required_action, expires_at} = await openai.beta.threads.runs.retrieve(thread_id, run_id);
        console.log(status);
        await redisClient.set(`${assistant_id}:${thread_id}:run`, run_id, {
          exat: expires_at,
        });
        switch (status) {
          case "queued":
          case "in_progress":
            fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                chat_id,
                action: "typing",
              })
            }).catch((e) => {
              console.log('SendChatAction error', e);
            })
            await sqsClient.send(new ChangeMessageVisibilityCommand({
              QueueUrl: process.env.AI_ASST_SQS_FIFO_URL,
              ReceiptHandle: receiptHandle,
              VisibilityTimeout: backOffSecond(nextNonce - 1),
            }))
            throw new Error("queued or in_progress");
          case "requires_action":
            await redisClient.del(receiptHandle);
            if (!required_action) {
              console.log("Required action not found");
              break;
            }
            const tool_calls = required_action.submit_tool_outputs.tool_calls;
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
            const tool_outputs = await Promise.all(tool_outputs_promises);
            try {
              openai.beta.threads.runs.submitToolOutputs(thread_id, run_id, {
                tool_outputs,
              });
            } catch (e) {
              console.log("Failed to submit tool outputs", e);
            }
            break;
          case "cancelling":
          case "completed":
          case "failed":
          case "cancelled":
          case "expired":
          default:
            await redisClient.del(receiptHandle);
            break;
        }
      } catch (e) {
        await sqsClient.send(new ChangeMessageVisibilityCommand({
          QueueUrl: process.env.AI_ASST_SQS_FIFO_URL,
          ReceiptHandle: receiptHandle,
          VisibilityTimeout: backOffSecond(nextNonce - 1),
        }))
        throw new Error("Failed to retrieve run");
      }
    } else {
      console.log("Unknown intent", intent);
    }
  }
  console.log(`Successfully processed ${records.length} records.`);
  return {
    success: true,
    count: records.length,
  };
}