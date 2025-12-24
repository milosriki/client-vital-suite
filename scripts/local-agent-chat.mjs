import readline from 'readline';

const AGENT_URL = 'http://localhost:54321/functions/v1/ptd-agent-claude';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("\n🤖 PTD Agent Local Chat (Connected to Real Stripe Data)");
console.log("-------------------------------------------------------");
console.log("Type your message below. Type 'exit' to quit.\n");

async function chat() {
  rl.question('You: ', async (input) => {
    if (input.toLowerCase() === 'exit') {
      rl.close();
      return;
    }

    try {
      console.log("Thinking...");
      const response = await fetch(AGENT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY' // Local serve usually ignores this with --no-verify-jwt
        },
        body: JSON.stringify({ message: input })
      });

      const data = await response.json();
      console.log(`\nAgent: ${data.response}\n`);
    } catch (error) {
      console.error("\nError connecting to agent. Make sure 'npx supabase functions serve' is running.\n", error.message);
    }

    chat();
  });
}

chat();
