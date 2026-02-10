provider "google" {
  project = var.project_id
  region  = "us-central1"
}

resource "google_dialogflow_cx_agent" "prod_agent" {
  display_name = "prod-agent"
  location     = "global"
  default_language_code = "en"
  time_zone    = "America/Los_Angeles"
  
  enable_stackdriver_logging = true
  enable_spell_correction    = true
  
  advanced_settings {
    logging_settings {
      enable_interaction_logging = true
    }
  }
}

resource "google_dialogflow_cx_flow" "default_flow" {
  agent        = google_dialogflow_cx_agent.prod_agent.id
  display_name = "Default Start Flow"

  event_handlers {
    event = "sys.no-match-default"
    trigger_fulfillment {
      messages {
        text {
          text = ["I didn't catch that. Could you say it again?"]
        }
      }
    }
  }
}
