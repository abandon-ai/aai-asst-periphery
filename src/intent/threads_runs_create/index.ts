import {TelegramFunctions} from "../../tools/telegram";
import sqsClient from "../../utils/sqsClient";
import {ChangeMessageVisibilityCommand, SendMessageCommand} from "@aws-sdk/client-sqs";
import ddbDocClient from "../../utils/ddbDocClient";
import {UpdateCommand} from "@aws-sdk/lib-dynamodb";
import redisClient from "../../utils/redisClient";
import backOffSecond from "../../utils/backOffSecond";
import OpenAI from "openai";
import {SQSRecord} from "aws-lambda";

const Threads_runs_create = async (record: SQSRecord) => {
  const {messageAttributes, body, receiptHandle, messageId} = record;
  const nextNonce = await redisClient.incr(messageId);
  const from = messageAttributes?.from?.stringValue || undefined;
  const openai = new OpenAI();

  console.log("nextNonce", nextNonce);
  console.log("backOffSecond", backOffSecond(nextNonce - 1));
  if (from === "telegram") {
    const {thread_id, assistant_id, update_id, token, chat_id} = JSON.parse(body);
    console.log("threads.runs.create...")
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
      await redisClient.del(messageId);
      console.log("threads.runs.create:", run_id);
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
}

export default Threads_runs_create