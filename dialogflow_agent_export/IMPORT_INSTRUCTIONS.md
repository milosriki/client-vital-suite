# Dialogflow ES Agent Import Instructions

## 1. Zip the files

You must create a ZIP file containing the `agent.json`, `package.json`, `intents/` folder, and `entities/` folder.

**Mac/Linux Command:**

```bash
cd dialogflow_agent_export
zip -r ptd_agent_mark.zip .
```

## 2. Import into Dialogflow ES

1. Go to the [Dialogflow Console](https://dialogflow.cloud.google.com).
2. Create a new Agent (or select your existing one).
   - _Tip:_ Backup your existing agent first (Export -> Zip).
3. Click the **Gear Icon** ⚙️ (Settings) next to the agent name.
4. Go to the **Export and Import** tab.
5. Click **RESTORE FROM ZIP** (Warning: This overwrites everything) or **IMPORT FROM ZIP** (Merges).
   - **Recommended:** RESTORE FROM ZIP for a clean slate that matches the PTD Spec exactly.
6. Upload `ptd_agent_mark.zip`.
7. Type "RESTORE" to confirm.

## 3. Verify Import

- Check **Entities**: You should see `ptd_city`, `ptd_area_dubai`, etc. with synonyms.
- Check **Intents**: You should see `ptd.discovery.goal`, `global.price`, etc.
- Check **Fulfillment**: Ensure the Webhook URL is set to your Supabase Function URL.

## 4. Test It

Type "Hi" in the simulator.

- It should trigger Default Welcome (or you might need to add a Welcome intent if I didn't include it).
- Type "I want to lose weight".
- It should trigger `ptd.discovery.goal` and ask "Perfect — are you based in Dubai or Abu Dhabi?".
- Check the **Contexts** at the bottom of the simulator. You should see `ptd.session` with `lifespan: 50`.
