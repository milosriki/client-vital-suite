# How to Evaluate an LLM Application with LangSmith

This guide summarizes the end-to-end flow for running evaluations against an LLM-powered application using the LangSmith SDK. It is adapted from the LangSmith docs to fit our project’s documentation.

## Prerequisites
- Python: `langsmith>=0.3.13`
- TypeScript/JS: `langsmith>=0.2.9`
- (Optional) OpenAI client if you want to wrap calls for tracing.

## 1) Define the application
Create a callable that accepts an input dictionary and returns an output dictionary. Optional tracing wrappers decorate model calls so you can inspect traces in LangSmith.

```python
from langsmith import traceable, wrappers
from openai import OpenAI

oai_client = wrappers.wrap_openai(OpenAI())

@traceable
def toxicity_classifier(inputs: dict) -> dict:
    instructions = (
        "Review the user query and respond 'Toxic' if it contains insults/threats/negativity,"
        " otherwise respond 'Not toxic'."
    )
    messages = [
        {"role": "system", "content": instructions},
        {"role": "user", "content": inputs["text"]},
    ]
    result = oai_client.chat.completions.create(
        messages=messages, model="gpt-4o-mini", temperature=0
    )
    return {"class": result.choices[0].message.content}
```

```typescript
import { OpenAI } from "openai";
import { wrapOpenAI } from "langsmith/wrappers";
import { traceable } from "langsmith/traceable";

const oaiClient = wrapOpenAI(new OpenAI());

export const toxicityClassifier = traceable(async (text: string) => {
  const result = await oaiClient.chat.completions.create({
    messages: [
      {
        role: "system",
        content:
          "Review the user query and respond 'Toxic' if it contains insults/threats/negativity, otherwise respond 'Not toxic'.",
      },
      { role: "user", content: text },
    ],
    model: "gpt-4o-mini",
    temperature: 0,
  });
  return result.choices[0].message.content;
});
```

## 2) Create or select a dataset
Datasets are collections of labeled examples. Here’s how to create one with inputs and expected outputs. For a fuller, repeatable setup (including how to refresh examples before CI runs), see `docs/SETTING_UP_LANGSMITH_DATASETS.md`.

```python
from langsmith import Client

ls_client = Client()
examples = [
    {"inputs": {"text": "Shut up, idiot"}, "outputs": {"label": "Toxic"}},
    {"inputs": {"text": "You're a wonderful person"}, "outputs": {"label": "Not toxic"}},
]

dataset = ls_client.create_dataset(dataset_name="Toxic Queries")
ls_client.create_examples(dataset_id=dataset.id, examples=examples)
```

```typescript
import { Client } from "langsmith";

const langsmith = new Client();
const labeledTexts = [
  ["Shut up, idiot", "Toxic"],
  ["You're a wonderful person", "Not toxic"],
];

const [inputs, outputs] = labeledTexts.reduce(
  ([i, o], [text, label]) => [[...i, { input: text }], [...o, { outputs: label }]],
  [[], []] as [Array<Record<string, any>>, Array<Record<string, any>>]
);

const datasetName = "Toxic Queries";
const dataset = await langsmith.createDataset(datasetName);
await langsmith.createExamples({ inputs, outputs, datasetId: dataset.id });
```

## 3) Define an evaluator
Evaluators score outputs. With labels present, a simple equality check works.

```python
def correct(inputs: dict, outputs: dict, reference_outputs: dict) -> bool:
    return outputs["class"] == reference_outputs["label"]
```

```typescript
import type { EvaluationResult } from "langsmith/evaluation";

function correct({ outputs, referenceOutputs }: {
  outputs: Record<string, any>;
  referenceOutputs?: Record<string, any>;
}): EvaluationResult {
  const score = outputs.output === referenceOutputs?.outputs;
  return { key: "correct", score };
}
```

## 4) Run the evaluation
Call `evaluate()` (or `aevaluate()` in Python for large jobs) with the target function, dataset name/ID, and evaluators. Use `max_concurrency`/`maxConcurrency` to parallelize.

```python
results = ls_client.evaluate(
    toxicity_classifier,
    data="Toxic Queries",
    evaluators=[correct],
    experiment_prefix="gpt-4o-mini, baseline",  # optional name prefix
    description="Testing the baseline system.",
    max_concurrency=4,
)
```

```typescript
import { evaluate } from "langsmith/evaluation";

await evaluate((inputs) => toxicityClassifier(inputs["input"]), {
  data: datasetName,
  evaluators: [correct],
  experimentPrefix: "gpt-4o-mini, baseline",
  maxConcurrency: 4,
});
```

## 5) Explore the results
Each run creates an experiment visible in the LangSmith UI. If tracing is enabled, you can open individual traces to inspect prompts, model responses, and feedback scores. Evaluation scores are attached as feedback to each output.

## Tips for larger jobs
- Prefer `aevaluate()` in Python for long or high-volume runs.
- Tune `max_concurrency` to match your rate limits.
- Keep datasets small and focused when iterating on prompts; expand to larger labeled sets for regressions.

