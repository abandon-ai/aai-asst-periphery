import {APIGatewayEvent, Handler} from "aws-lambda";
import redisClient from "../utils/redisClient";
import sqsClient from "../utils/sqsClient";
import {SendMessageCommand} from "@aws-sdk/client-sqs";
import openai from "../utils/openai";

export const handler: Handler = async (event: APIGatewayEvent, context) => {
  const body = JSON.parse(event?.body || '{}');
  const token = event.pathParameters?.proxy || undefined;

// do not process groups, bots and old messages(24h)
  if (
    body?.message?.chat?.id < 0 ||
    body?.message?.from?.is_bot ||
    body?.message?.date < Math.floor(new Date().getTime() / 1000) - 24 * 60 * 60
  ) {
    return {
      statusCode: 200,
      body: JSON.stringify({}),
    }
  }

  // Check assistant_id
  const assistant_id = await redisClient.get(`ASST_ID#${token}`);
  console.log("Query ASST_ID", assistant_id);
  if (!assistant_id) {
    return {
      statusCode: 200,
      body: JSON.stringify({}),
    }
  }

  const chat_id = body?.message?.chat?.id;

  // Check thread, if not exist, create
  let thread_id = await redisClient.get(
    `THREAD#${assistant_id}:${chat_id}`,
  );
  console.log("Cached thread", thread_id);

  // Create new thread
  if (!thread_id || body?.message?.text?.trim() === "/start") {
    if (thread_id) {
      try {
        await openai.beta.threads.del(thread_id as string);
        console.log("threads.del...success", thread_id);
      } catch (e) {
        console.log("threads.del...error", e);
      }
    }
    try {
      const { id } = await openai.beta.threads.create();
      console.log("threads.create...success", id);
      thread_id = id;
      await redisClient.set(
        `THREAD#${assistant_id}:${chat_id}`,
        thread_id,
      );
    } catch (_) {
      console.log("threads.create...error");
      return {
        statusCode: 200,
        body: JSON.stringify({}),
      }
    }
  }

  try {
    await redisClient.set(`INVOKE_RUNS_CREATE#${assistant_id}:${thread_id}`, body.update_id);
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: process.env.AI_ASST_SQS_FIFO_URL,
        MessageBody: JSON.stringify({
          thread_id,
          assistant_id,
          token,
          chat_id,
          update_id: body.update_id,
          message: JSON.stringify(body),
          intent: "threads.messages.create",
        }),
        MessageAttributes: {
          intent: {
            StringValue: "threads.messages.create",
            DataType: "String",
          },
          from: {
            StringValue: "telegram",
            DataType: "String",
          },
        },
        MessageGroupId: `${assistant_id}-${thread_id}`,
      }),
    )
    console.log("threads.messages.create...queued");
  } catch (_) {
    console.log("openai.beta.threads.messages.create error");
  }

  return {
    statusCode: 200,
    body: JSON.stringify({}),
  }
}