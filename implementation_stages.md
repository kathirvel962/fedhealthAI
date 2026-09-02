STAGE 1 — Clean and stabilize the existing project
Goal

Get the existing system into a reliable baseline before changing ML.

Add/fix
PHC identity consistency
API response consistency
database indexes
authentication authorization
failing tests
frontend API handling
error handling
environment configuration
logging
remove fake frontend data
remove dead code
Important

Your audit found:

15 tests, 1 failure, 9 errors.

Fix that before implementing the new FL pipeline.

Prompt 1

You are working on my existing Federated Health Intelligence Network project.

Do NOT rebuild the project from scratch and do NOT change the overall React + Django + MongoDB architecture.

First perform a stabilization and cleanup pass.

Objectives:

Inspect the entire repository before modifying anything.
Fix all existing backend test failures and errors.
Fix inconsistent PHC identifiers.
Use one canonical format everywhere: PHC_1, PHC_2, PHC_3, PHC_4, PHC_5.
Remove hard-coded PHC lists where database discovery can be used.
Make all frontend API response fields consistent with backend serializers.
Remove dead, duplicate, obsolete, debug, placeholder, and simulation code only when it is confirmed unused.
Remove frontend Math.random(), fake metrics, synthetic chart values, and fabricated intelligence. Replace them with real API data or "No data available".
Organize backend utility scripts into logical directories without breaking imports.
Improve error handling so raw Python exceptions are not exposed through APIs.
Ensure environment variables are used for secrets and configuration.
Keep existing authentication, patient management, dashboards, risk scoring, local model training, and alerts working.
Do not implement new federated-learning algorithms yet.
Do not add SHAP, fairness, differential privacy, or personalization yet.

After modifications:

run Django system checks
run the complete backend test suite
build the React frontend
report every changed file
report every test/build result
do not claim success unless the commands actually pass.

Preserve existing functionality wherever it is valid.

STAGE 2 — Create a REAL federated model representation

This is the most important technical change.

Your current XGBoost models are serialized independently.

You need a clean abstraction:

LocalModel
    ↓
ModelParameters
    ↓
FederatedUpdate

Create something conceptually like:

FederatedRound
FederatedClientUpdate
GlobalModel

For example:

FederatedRound
----------------
round_id
status
started_at
completed_at
participants
global_model_version

and:

FederatedClientUpdate
---------------------
round_id
phc_id
sample_count
local_model_version
parameters
metrics
created_at
STAGE 3 — Actual FedAvg

There is an important technical issue here:

Standard FedAvg is naturally defined for neural-network parameters.

XGBoost trees aren't straightforwardly averaged like neural-network weights.

So don't have an AI agent blindly write:

global_weights = sum(local_weights)

for arbitrary XGBoost trees.

You have two reasonable options.

Option A — Recommended for your project

Move the federated prediction model to a neural network.

For example:

Input clinical features
        ↓
Dense layer
        ↓
Dense layer
        ↓
Disease probabilities

Then actual:

W_global =
Σ (n_k / N) W_k

is straightforward.

Option B

Keep XGBoost as the local baseline model, but implement a genuine federated-compatible global model separately.

For an academic FL project, Option A is cleaner if demonstrating FedAvg is one of your core claims.

You can retain XGBoost as:

Local PHC baseline

while using:

Federated Neural Network

as the actual global model.

This gives you a stronger experimental story:

PHC XGBoost
     vs
Federated Global Model
     vs
Personalized Global + Local Model
STAGE 4 — Non-IID handling

This should be a major part of your project because healthcare data is naturally heterogeneous.

Add a partition analysis module.

For each PHC calculate:

Samples
Disease distribution
Age distribution
Gender distribution
Feature statistics
Class imbalance

Then calculate a heterogeneity metric.

For example:

Jensen-Shannon divergence

between PHCs.

Dashboard:

PHC        Samples    Dengue    Malaria    Fever    JS Divergence
PHC_1       2000       22%       18%       31%        0.00
PHC_2       1800       10%       31%       20%        0.14
PHC_3       2200       35%        9%       18%        0.21
...

This makes your Non-IID claim measurable instead of just theoretical.

STAGE 5 — Personalized FL

After global FedAvg works, add personalization.

I recommend keeping this simple.

Use:

Global model
      ↓
PHC-specific fine-tuning
      ↓
Personalized PHC model

So:

Global model
     +
Local PHC data
     ↓
Personalized model

You can describe this as a personalized fine-tuning approach rather than claiming FedPer/Ditto/etc. unless you actually implement one of those algorithms.

The system becomes:

Global model
 ├── PHC_1 personalized model
 ├── PHC_2 personalized model
 ├── PHC_3 personalized model
 ├── PHC_4 personalized model
 └── PHC_5 personalized model
STAGE 6 — Prediction API

This is essential.

Currently you train models but don't have a proper prediction endpoint.

Add:

POST /api/predictions/

Input:

{
  "age": 32,
  "gender": "Female",
  "temperature": 38.7,
  "heart_rate": 98,
  "systolic_bp": 118,
  "wbc": 5200,
  "platelets": 180000,
  "hemoglobin": 12.4,
  "cough": 1,
  "fatigue": 1,
  "headache": 1,
  "vomiting": 0,
  "breathlessness": 0
}

Output:

{
  "prediction": "Dengue",
  "confidence": 0.87,
  "probabilities": {
    "Healthy": 0.03,
    "Viral Fever": 0.06,
    "Dengue": 0.87,
    "Malaria": 0.02,
    "Typhoid": 0.01,
    "Pneumonia": 0.01
  },
  "model_version": "global_v12"
}
STAGE 7 — SHAP explainability

Now add actual patient-level explainability.

The user should be able to see:

Prediction: Dengue
Confidence: 87%

Factors influencing prediction

Platelet count       ███████████
Temperature          █████████
Fatigue              ██████
WBC count            ████
Heart rate           ███
Age                  ██

And preferably:

Why this prediction?

Higher temperature increased Dengue probability.

Lower platelet count increased Dengue probability.

Patient age had a smaller contribution.

Do not call basic XGBoost feature importance "patient-level explainability."

STAGE 8 — Fairness engine

Add evaluation by:

Gender
Age groups
PHC
City
District

Metrics:

Accuracy
Precision
Recall
F1
AUROC
Sensitivity
Specificity

Then disparity:

max(metric) - min(metric)

Dashboard:

                    PHC1 PHC2 PHC3 PHC4 PHC5
Recall               91   88   83   90   86
Specificity          94   92   91   89   93
F1                   92   89   86   90   89

This directly supports your Trust layer.

STAGE 9 — Privacy

Only after the FL pipeline works.

Implement:

Update clipping
local update
      ↓
clip norm
      ↓
privacy mechanism
      ↓
aggregator
Differential privacy

Add:

clipping
+
Gaussian noise
+
privacy accounting

Don't merely write "DP enabled" in the UI.

Store:

epsilon
delta
noise_multiplier
clipping_norm

for each federated round.

Secure aggregation

This is separate from DP.

If you implement it, the architecture becomes:

PHC updates
    ↓
masked/encrypted updates
    ↓
secure aggregator
    ↓
aggregate

However, don't add secure communication just for the presentation diagram.

Your earlier direction of going directly from model updates to federated aggregation is fine for the conceptual architecture if you clearly distinguish that from secure aggregation.

STAGE 10 — Intelligence dashboard

Finally redesign the UI around:

Privacy → Heterogeneity → Intelligence → Trust
Admin dashboard
FEDERATED HEALTH INTELLIGENCE

┌────────────┬────────────┬────────────┬────────────┐
│ PHCs       │ Patients   │ FL Round   │ Global F1  │
│ 5          │ 10,003     │ #18        │ 91.2%      │
└────────────┴────────────┴────────────┴────────────┘

Federated Learning
──────────────────────────────

PHC 1 ✓
PHC 2 ✓
PHC 3 ✓
PHC 4 ✓
PHC 5 ✓

Global model v18

Then:

Model performance
Local vs Global

PHC 1   87%
PHC 2   84%
PHC 3   82%
PHC 4   89%
PHC 5   86%

Global  91%
Non-IID
PHC heterogeneity
Fairness
Gender
Age
PHC
Explainability
Top clinical factors
Privacy
DP ε
Clipping
Aggregation status


STAGE 1 — Clean and stabilize the existing project
Goal

Get the existing system into a reliable baseline before changing ML.

Add/fix
PHC identity consistency
API response consistency
database indexes
authentication authorization
failing tests
frontend API handling
error handling
environment configuration
logging
remove fake frontend data
remove dead code
Important

Your audit found:

15 tests, 1 failure, 9 errors.

Fix that before implementing the new FL pipeline.

Prompt 1

You are working on my existing Federated Health Intelligence Network project.

Do NOT rebuild the project from scratch and do NOT change the overall React + Django + MongoDB architecture.

First perform a stabilization and cleanup pass.

Objectives:

Inspect the entire repository before modifying anything.
Fix all existing backend test failures and errors.
Fix inconsistent PHC identifiers.
Use one canonical format everywhere: PHC_1, PHC_2, PHC_3, PHC_4, PHC_5.
Remove hard-coded PHC lists where database discovery can be used.
Make all frontend API response fields consistent with backend serializers.
Remove dead, duplicate, obsolete, debug, placeholder, and simulation code only when it is confirmed unused.
Remove frontend Math.random(), fake metrics, synthetic chart values, and fabricated intelligence. Replace them with real API data or "No data available".
Organize backend utility scripts into logical directories without breaking imports.
Improve error handling so raw Python exceptions are not exposed through APIs.
Ensure environment variables are used for secrets and configuration.
Keep existing authentication, patient management, dashboards, risk scoring, local model training, and alerts working.
Do not implement new federated-learning algorithms yet.
Do not add SHAP, fairness, differential privacy, or personalization yet.

After modifications:

run Django system checks
run the complete backend test suite
build the React frontend
report every changed file
report every test/build result
do not claim success unless the commands actually pass.

Preserve existing functionality wherever it is valid.

STAGE 2 — Create a REAL federated model representation

This is the most important technical change.

Your current XGBoost models are serialized independently.

You need a clean abstraction:

LocalModel
    ↓
ModelParameters
    ↓
FederatedUpdate

Create something conceptually like:

FederatedRound
FederatedClientUpdate
GlobalModel

For example:

FederatedRound
----------------
round_id
status
started_at
completed_at
participants
global_model_version

and:

FederatedClientUpdate
---------------------
round_id
phc_id
sample_count
local_model_version
parameters
metrics
created_at
STAGE 3 — Actual FedAvg

There is an important technical issue here:

Standard FedAvg is naturally defined for neural-network parameters.

XGBoost trees aren't straightforwardly averaged like neural-network weights.

So don't have an AI agent blindly write:

global_weights = sum(local_weights)

for arbitrary XGBoost trees.

You have two reasonable options.

Option A — Recommended for your project

Move the federated prediction model to a neural network.

For example:

Input clinical features
        ↓
Dense layer
        ↓
Dense layer
        ↓
Disease probabilities

Then actual:

W_global =
Σ (n_k / N) W_k

is straightforward.

Option B

Keep XGBoost as the local baseline model, but implement a genuine federated-compatible global model separately.

For an academic FL project, Option A is cleaner if demonstrating FedAvg is one of your core claims.

You can retain XGBoost as:

Local PHC baseline

while using:

Federated Neural Network

as the actual global model.

This gives you a stronger experimental story:

PHC XGBoost
     vs
Federated Global Model
     vs
Personalized Global + Local Model
STAGE 4 — Non-IID handling

This should be a major part of your project because healthcare data is naturally heterogeneous.

Add a partition analysis module.

For each PHC calculate:

Samples
Disease distribution
Age distribution
Gender distribution
Feature statistics
Class imbalance

Then calculate a heterogeneity metric.

For example:

Jensen-Shannon divergence

between PHCs.

Dashboard:

PHC        Samples    Dengue    Malaria    Fever    JS Divergence
PHC_1       2000       22%       18%       31%        0.00
PHC_2       1800       10%       31%       20%        0.14
PHC_3       2200       35%        9%       18%        0.21
...

This makes your Non-IID claim measurable instead of just theoretical.

STAGE 5 — Personalized FL

After global FedAvg works, add personalization.

I recommend keeping this simple.

Use:

Global model
      ↓
PHC-specific fine-tuning
      ↓
Personalized PHC model

So:

Global model
     +
Local PHC data
     ↓
Personalized model

You can describe this as a personalized fine-tuning approach rather than claiming FedPer/Ditto/etc. unless you actually implement one of those algorithms.

The system becomes:

Global model
 ├── PHC_1 personalized model
 ├── PHC_2 personalized model
 ├── PHC_3 personalized model
 ├── PHC_4 personalized model
 └── PHC_5 personalized model
STAGE 6 — Prediction API

This is essential.

Currently you train models but don't have a proper prediction endpoint.

Add:

POST /api/predictions/

Input:

{
  "age": 32,
  "gender": "Female",
  "temperature": 38.7,
  "heart_rate": 98,
  "systolic_bp": 118,
  "wbc": 5200,
  "platelets": 180000,
  "hemoglobin": 12.4,
  "cough": 1,
  "fatigue": 1,
  "headache": 1,
  "vomiting": 0,
  "breathlessness": 0
}

Output:

{
  "prediction": "Dengue",
  "confidence": 0.87,
  "probabilities": {
    "Healthy": 0.03,
    "Viral Fever": 0.06,
    "Dengue": 0.87,
    "Malaria": 0.02,
    "Typhoid": 0.01,
    "Pneumonia": 0.01
  },
  "model_version": "global_v12"
}
STAGE 7 — SHAP explainability

Now add actual patient-level explainability.

The user should be able to see:

Prediction: Dengue
Confidence: 87%

Factors influencing prediction

Platelet count       ███████████
Temperature          █████████
Fatigue              ██████
WBC count            ████
Heart rate           ███
Age                  ██

And preferably:

Why this prediction?

Higher temperature increased Dengue probability.

Lower platelet count increased Dengue probability.

Patient age had a smaller contribution.

Do not call basic XGBoost feature importance "patient-level explainability."

STAGE 8 — Fairness engine

Add evaluation by:

Gender
Age groups
PHC
City
District

Metrics:

Accuracy
Precision
Recall
F1
AUROC
Sensitivity
Specificity

Then disparity:

max(metric) - min(metric)

Dashboard:

                    PHC1 PHC2 PHC3 PHC4 PHC5
Recall               91   88   83   90   86
Specificity          94   92   91   89   93
F1                   92   89   86   90   89

This directly supports your Trust layer.

STAGE 9 — Privacy

Only after the FL pipeline works.

Implement:

Update clipping
local update
      ↓
clip norm
      ↓
privacy mechanism
      ↓
aggregator
Differential privacy

Add:

clipping
+
Gaussian noise
+
privacy accounting

Don't merely write "DP enabled" in the UI.

Store:

epsilon
delta
noise_multiplier
clipping_norm

for each federated round.

Secure aggregation

This is separate from DP.

If you implement it, the architecture becomes:

PHC updates
    ↓
masked/encrypted updates
    ↓
secure aggregator
    ↓
aggregate

However, don't add secure communication just for the presentation diagram.

Your earlier direction of going directly from model updates to federated aggregation is fine for the conceptual architecture if you clearly distinguish that from secure aggregation.

STAGE 10 — Intelligence dashboard

Finally redesign the UI around:

Privacy → Heterogeneity → Intelligence → Trust
Admin dashboard
FEDERATED HEALTH INTELLIGENCE

┌────────────┬────────────┬────────────┬────────────┐
│ PHCs       │ Patients   │ FL Round   │ Global F1  │
│ 5          │ 10,003     │ #18        │ 91.2%      │
└────────────┴────────────┴────────────┴────────────┘

Federated Learning
──────────────────────────────

PHC 1 ✓
PHC 2 ✓
PHC 3 ✓
PHC 4 ✓
PHC 5 ✓

Global model v18

Then:

Model performance
Local vs Global

PHC 1   87%
PHC 2   84%
PHC 3   82%
PHC 4   89%
PHC 5   86%

Global  91%
Non-IID
PHC heterogeneity
Fairness
Gender
Age
PHC
Explainability
Top clinical factors
Privacy
DP ε
Clipping
Aggregation status