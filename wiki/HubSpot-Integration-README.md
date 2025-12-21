# HubSpot Agent Tool Integration

This directory contains the configuration files for integrating your Supabase Edge Functions as **HubSpot Agent Tools**.

## What is this?
HubSpot Agent Tools allow HubSpot's AI Agents (in their Chat or Workflows) to call your external APIs. We have configured a tool that allows HubSpot to call your `fetch-callgear-data` Edge Function.

## How to Deploy

Since the `hs` CLI is not installed in this environment, you need to deploy this from your local machine or a machine with the HubSpot CLI installed.

### Prerequisites
1.  **Install HubSpot CLI:**
    ```bash
    npm install -g @hubspot/cli
    ```
2.  **Authenticate:**
    ```bash
    hs account auth
    ```

### Deployment Steps
1.  **Create a new HubSpot Project (if you haven't already):**
    ```bash
    hs project create
    ```
    (Select a template like "Getting started" or "Empty")

2.  **Copy the Tool Configuration:**
    Copy the `callgear-analytics-tool-hsmeta.json` file into the `src/app/workflow-actions/` directory of your HubSpot project.
    If that directory doesn't exist, create it.

3.  **Upload to HubSpot:**
    Run this command from your HubSpot project root:
    ```bash
    hs project upload
    ```

### Usage
Once uploaded, go to your HubSpot Portal -> **Automations** -> **AI Agents** (or Workflows). You should now see "Get CallGear Analytics" as an available tool for your agents.
