import {Handler, SQSEvent} from "aws-lambda";
import Threads_runs_create from "./intent/threads_runs_create";
import Threads_runs_retrieve from "./intent/threads_runs_retrieve";
import Threads_messages_create from "./intent/threads_messages_create";

export const handler: Handler = async (event: SQSEvent, context) => {
  const records = event.Records;
  for (const record of records) {
    const intent = record?.messageAttributes?.intent?.stringValue || undefined;

    if (intent === 'threads.messages.create') {
      await Threads_messages_create(record);
    } else if (intent === 'threads.runs.create') {
      await Threads_runs_create(record);
    } else if (intent === 'threads.runs.retrieve') {
      await Threads_runs_retrieve(record);
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