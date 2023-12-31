import {SQSRecord} from "aws-lambda";
import redisClient from "../../utils/redisClient";
import openai from "../../utils/openai";
import sqsClient from "../../utils/sqsClient";
import {ChangeMessageVisibilityCommand, SendMessageCommand} from "@aws-sdk/client-sqs";
import backOffSecond from "../../utils/backOffSecond";
import { Ratelimit } from "@upstash/ratelimit";
import RedisClient from "../../utils/redisClient";

const Threads_messages_create = async (record: SQSRecord) => {
  const {messageAttributes, body, receiptHandle, messageId} = record;
  const from = messageAttributes?.from?.stringValue || undefined;
  const retryTimes = await redisClient.incr(messageId);

  console.log("threads.messages.create...retry times", retryTimes);
  if (from === "telegram") {
    // message is telegram's update data
    const {thread_id, message, assistant_id, chat_id, token, update_id} = JSON.parse(body);
    const ratelimit = new Ratelimit({
      redis: RedisClient,
      limiter: Ratelimit.slidingWindow(10, "5 m"),
      prefix: "threads/messages/create/ratelimit",
    });
    const { success, limit, remaining, reset } = await ratelimit.limit(`${assistant_id}:${thread_id}:${chat_id}`);
    if (!success) {
      await sqsClient.send(new ChangeMessageVisibilityCommand({
        QueueUrl: process.env.AI_ASST_SQS_FIFO_URL,
        ReceiptHandle: receiptHandle,
        VisibilityTimeout: Math.floor(reset / 1000) + 1,
      }))
      throw new Error(`Rate limit exceeded for ${assistant_id}:${thread_id}:${chat_id}, limit: ${limit}, remaining: ${remaining}, reset: ${reset}`);
    }
    try {
      // If the thread is unlocked, then, you can run it.
      await openai.beta.threads.messages.create(thread_id as string, {
        role: "user",
        content: message,
      })
      console.log("threads.messages.create...success");
      // Queue to create a run of this thread.
      // When running, this thread will be blocked!
      // (When running) No more messages will be created, and no more runs.
      const invokeRunsCreateUpdateId = await redisClient.get(`INVOKE_RUNS_CREATE#${assistant_id}:${thread_id}`) || 0;
      if (update_id >= invokeRunsCreateUpdateId) {
        await sqsClient.send(
          new SendMessageCommand({
            QueueUrl: process.env.AI_ASST_SQS_FIFO_URL,
            MessageBody: JSON.stringify({
              thread_id,
              assistant_id,
              token,
              chat_id,
              message,
              intent: "threads.runs.create",
            }),
            MessageAttributes: {
              intent: {
                StringValue: "threads.runs.create",
                DataType: "String",
              },
              from: {
                StringValue: from,
                DataType: "String",
              },
            },
            MessageGroupId: `${assistant_id}-${thread_id}`,
          }),
        )
        console.log("threads.runs.create...queued");
      } else {
        console.log("threads.runs.create...wait more messages to invoke")
      }
    } catch (e) {
      console.log("threads.messages.create...wait", backOffSecond(retryTimes - 1))
      await sqsClient.send(new ChangeMessageVisibilityCommand({
        QueueUrl: process.env.AI_ASST_SQS_FIFO_URL,
        ReceiptHandle: receiptHandle,
        VisibilityTimeout: backOffSecond(retryTimes - 1),
      }))
      throw `threads.messages.create...the thread is blocked ${thread_id}`
    }
  } else {
    console.log("threads.messages.create...from error", from);
  }
}

export default Threads_messages_create;