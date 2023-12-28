import redisClient from "../../utils/redisClient";
import sqsClient from "../../utils/sqsClient";
import {ChangeMessageVisibilityCommand} from "@aws-sdk/client-sqs";
import backOffSecond from "../../utils/backOffSecond";
import {functionHandlerMap} from "../../tools/telegram";
import {SQSRecord} from "aws-lambda";
import openai from "../../utils/openai";

const Threads_runs_retrieve = async (record: SQSRecord) => {
  const {body, receiptHandle, messageId} = record;
  const nextNonce = await redisClient.incr(messageId);

  console.log("threads.runs.retrieve...nextNonce", nextNonce);
  const {thread_id, run_id, assistant_id, token, chat_id} = JSON.parse(body);
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
          console.log('threads.runs.retrieve...failed to send chat action', e);
        })
        await sqsClient.send(new ChangeMessageVisibilityCommand({
          QueueUrl: process.env.AI_ASST_SQS_FIFO_URL,
          ReceiptHandle: receiptHandle,
          VisibilityTimeout: backOffSecond(nextNonce - 1),
        }))
        throw new Error(`threads.runs.retrieve...${status}`);
      case "requires_action":
        await redisClient.del(receiptHandle);
        if (!required_action) {
          break;
        }
        const tool_calls = required_action.submit_tool_outputs.tool_calls;
        const tool_outputs = [];
        for (const toolCall of tool_calls) {
          const function_name = toolCall.function.name;
          console.log("threads.runs.retrieve...function", function_name);
          const handler = functionHandlerMap[function_name!];
          if (handler) {
            // Instead of awaiting each handler, push the promise into an array
            const res = await handler(toolCall, assistant_id)
            tool_outputs.push(res);
          } else {
            console.log(`threads.runs.retrieve...${function_name} not found`);
          }
          const random = Math.floor(Math.random() * 1000);
          await new Promise((resolve) => setTimeout(resolve, random));
        }
        try {
          openai.beta.threads.runs.submitToolOutputs(thread_id, run_id, {
            tool_outputs,
          });
        } catch (e) {
          console.log("threads.runs.retrieve...failed to submit tool outputs", e);
        }
        break;
      case "cancelling":
      case "completed":
      case "failed":
      case "cancelled":
      case "expired":
      default:
        await redisClient.del(messageId);
        break;
    }
  } catch (e) {
    await sqsClient.send(new ChangeMessageVisibilityCommand({
      QueueUrl: process.env.AI_ASST_SQS_FIFO_URL,
      ReceiptHandle: receiptHandle,
      VisibilityTimeout: backOffSecond(nextNonce - 1),
    }))
    throw new Error("threads.runs.retrieve...failed");
  }
}

export default Threads_runs_retrieve;