# Setting Up Your LangSmith Dataset in the Application

Follow these steps to keep a reusable evaluation dataset alongside the app code, adapted from the LangSmith guide on managing datasets in an application (see the official steps at https://docs.langchain.com/langsmith/manage-datasets-in-application#set-up-your-dataset).

## 1) Initialize the client
```python
from langsmith import Client
ls = Client()
```

```typescript
import { Client } from "langsmith";
const ls = new Client();
```

## 2) Create or fetch the dataset by name
This pattern is safe to run on every deploy so the dataset always exists without creating duplicates.

```python
dataset = ls.create_dataset(dataset_name="Toxic Queries", description="Evaluation set for toxicity classifier")
```

```typescript
const dataset = await ls.createDataset("Toxic Queries", {
  description: "Evaluation set for toxicity classifier",
});
```

If you prefer to reuse an existing dataset when it already exists, fetch it first and only create when missing:

```python
try:
    dataset = ls.read_dataset(dataset_name="Toxic Queries")
except Exception:
    dataset = ls.create_dataset(dataset_name="Toxic Queries")
```

```typescript
let dataset = await ls.readDataset({ datasetName: "Toxic Queries" });
if (!dataset) {
  dataset = await ls.createDataset("Toxic Queries");
}
```

## 3) Add or refresh examples
Use your source-of-truth data (CSV/JSON fixtures) and upsert them into the dataset. A simple approach is to wipe and replace when the fixture changes so you always evaluate against the latest labels.

```python
examples = [
    {"inputs": {"text": "Shut up, idiot"}, "outputs": {"label": "Toxic"}},
    {"inputs": {"text": "You're a wonderful person"}, "outputs": {"label": "Not toxic"}},
]

# Clear old examples (optional) then add the new set
ls.delete_examples(dataset_id=dataset.id)
ls.create_examples(dataset_id=dataset.id, examples=examples)
```

```typescript
const inputs = [
  { input: "Shut up, idiot" },
  { input: "You're a wonderful person" },
];
const outputs = [
  { outputs: "Toxic" },
  { outputs: "Not toxic" },
];

await ls.deleteExamples({ datasetId: dataset.id });
await ls.createExamples({ datasetId: dataset.id, inputs, outputs });
```

## 4) Keep the dataset name/ID with your app config
Store the dataset name or ID in environment/config (e.g., `LANGSMITH_DATASET_NAME`) so evaluation scripts and CI jobs pull the same labeled set every run. Pass this value into `evaluate()`/`aevaluate()` so the runner loads the correct dataset.

## 5) Automate in CI
Add a lightweight setup step in CI that runs the dataset bootstrap code before evaluations. This guarantees the dataset exists and is up to date before calling `evaluate()`, matching the workflow in the LangSmith "Set up your dataset" guide.
