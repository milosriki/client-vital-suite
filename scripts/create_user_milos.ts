import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  const envPath = join(process.cwd(), ".env.local");
  let content = "";
  try {
    content = await readFile(envPath, "utf-8");
  } catch (e) {
    console.error("Could not read .env.local");
    return;
  }
  const url = content.match(/SUPABASE_URL="([^"]+)"/)?.[1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)?.[1];

  if (!url || !key) {
    console.error("Missing keys in .env.local");
    return;
  }

  const supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log("Updating user: milosriki86@gmail.com...");

  // 1. List users to find the ID
  const {
    data: { users },
    error: listError,
  } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error("List users error:", listError);
    return;
  }

  const user = users.find((u) => u.email === "milosriki86@gmail.com");

  if (!user) {
    console.error("User not found in list (weird given the previous error).");
    return;
  }

  console.log(`Found user ${user.id}. Updating password...`);

  const { data: updateData, error: updateError } =
    await supabase.auth.admin.updateUserById(user.id, {
      password: "richard200@",
      user_metadata: { role: "admin" },
      email_confirm: true,
    });

  if (updateError) {
    console.error("Error updating user:", updateError);
  } else {
    console.log("User updated successfully:", updateData.user.email);
  }
}

run();
