import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function find() {
  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .ilike("firstname", "%Marko%")
    .ilike("lastname", "%Antic%");

  console.log("Marko in DB:", data);
}
find();
