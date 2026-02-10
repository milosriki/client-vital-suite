import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

export async function executeAwsTools(
  supabase: any,
  toolName: string,
  input: any,
): Promise<string> {
  switch (toolName) {
    case "aws_data_query": {
      const {
        action = "discover_schema",
        question,
        replica = "powerbi",
      } = input;
      try {
        const { data, error } = await supabase.functions.invoke(
          "rds-data-analyst",
          {
            body: { action, question, replica, max_rows: 50 },
          },
        );

        if (error) return `AWS Data Analyst Error: ${error.message}`;
        return JSON.stringify(data, null, 2);
      } catch (e) {
        return `AWS integration error: ${e}`;
      }
    }

    default:
      return `Tool ${toolName} not handled by AWS executor.`;
  }
}
