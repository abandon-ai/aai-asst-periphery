import {TelegramFunctions} from "../../tools/telegram";
import sqsClient from "../../utils/sqsClient";
import {ChangeMessageVisibilityCommand, SendMessageCommand} from "@aws-sdk/client-sqs";
import ddbDocClient from "../../utils/ddbDocClient";
import {UpdateCommand} from "@aws-sdk/lib-dynamodb";
import redisClient from "../../utils/redisClient";
import backOffSecond from "../../utils/backOffSecond";
import {SQSRecord} from "aws-lambda";
import openai from "../../utils/openai";

const Threads_runs_create = async (record: SQSRecord) => {
  const {messageAttributes, body, receiptHandle, messageId} = record;
  const retryTimes = await redisClient.incr(messageId);
  const from = messageAttributes?.from?.stringValue || undefined;

  console.log("threads.runs.create...retryTimes", retryTimes);
  if (from === "telegram") {
    const {thread_id, assistant_id, token, chat_id, message} = JSON.parse(body);
    try {
      const {id: run_id, expires_at} = await openai.beta.threads.runs.create(thread_id, {
        assistant_id,
        additional_instructions: 'You are a telegram bot now. You will receive a update from telegram API. Then, you should send message to target chat.',
        tools: TelegramFunctions,
      });
      console.log("threads.runs.create...success", run_id);
      redisClient.pipeline()
        .set(`RUN#${thread_id}`, run_id, {
          exat: expires_at,
        })
        .del(messageId);
      await Promise.all([
        sqsClient.send(new SendMessageCommand({
          QueueUrl: process.env.AI_ASST_SQS_FIFO_URL,
          MessageBody: JSON.stringify({
            thread_id,
            run_id,
            assistant_id,
            token,
            chat_id,
            intent: "threads.runs.retrieve",
          }),
          MessageAttributes: {
            intent: {
              DataType: 'String',
              StringValue: 'threads.runs.retrieve'
            },
          },
          MessageGroupId: `${assistant_id}-${thread_id}`,
        })),
        ddbDocClient.send(new UpdateCommand({
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
        }))
      ])
      console.log("threads.runs.retrieve...queued");
    } catch (e) {
      console.log("threads.runs.create...Change Message Visibility", backOffSecond(retryTimes - 1));
      await sqsClient.send(new ChangeMessageVisibilityCommand({
        QueueUrl: process.env.AI_ASST_SQS_FIFO_URL,
        ReceiptHandle: receiptHandle,
        VisibilityTimeout: backOffSecond(retryTimes - 1),
      }))
      throw new Error("threads.runs.create...failed to create run");
    }
  } else {
    console.log("threads.runs.create...from error", from);
  }
}

export default Threads_runs_create