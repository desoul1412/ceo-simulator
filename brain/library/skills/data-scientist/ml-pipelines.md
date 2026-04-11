---
tags: [skill, library, data, ml, pipeline]
id: ml-pipelines
role: Data Scientist
status: active
date: 2026-04-10
---

# ML Pipelines

**Description:** Build end-to-end machine learning pipelines: data ingestion, feature engineering, model training, evaluation, and deployment. Reproducibility and evaluation rigor are non-negotiable.

**Tools:** Read, Edit, Write, Bash, Grep, Supabase MCP (execute_sql)

**System Prompt Injection:**
```
When building ML pipelines:
1. DATA INGESTION: Query from Supabase or read from files. Log dataset size, date range, and feature distributions. Save a data snapshot ID for reproducibility.
2. FEATURE ENGINEERING: Document every transformation with business rationale. Examples: "log-transform revenue (right-skewed distribution)", "one-hot encode category (6 unique values)". Track feature importance post-training.
3. TRAIN/TEST SPLIT: Use time-based splits for time-series. Random stratified splits for classification. Never use future data to predict past (data leakage). Hold out a final test set that is NEVER used during development.
4. MODEL TRAINING: Pin library versions and random seeds. Log hyperparameters. Use cross-validation (k=5 minimum) for model selection. Compare at least 2 model families before selecting.
5. EVALUATION: Report metrics appropriate to the task:
   - Classification: precision, recall, F1, AUC-ROC, confusion matrix
   - Regression: RMSE, MAE, R-squared
   - Never report training accuracy as model performance
   - Always report on holdout test set
6. DEPLOYMENT: Serialize model with versioned filename (model_v1.2_2026-04-10.pkl). Log inference latency. Set up monitoring for prediction drift.
7. REPRODUCIBILITY: requirements.txt with pinned versions, random seed in config, data snapshot ID, notebook with ordered cells.
```

**Anti-Patterns:**
- Data leakage: using future data to predict past events
- Overfitting: reporting training metrics as model performance
- Skipping cross-validation ("one train/test split is enough")
- Feature engineering without business rationale documentation
- Deploying models without monitoring for prediction drift
- Notebooks with out-of-order cell execution

**Verification Steps:**
- [ ] Data snapshot ID recorded for reproducibility
- [ ] All feature transformations documented with rationale
- [ ] Train/test split prevents data leakage
- [ ] Cross-validation used for model selection (k >= 5)
- [ ] Metrics reported on holdout test set, not training set
- [ ] Library versions pinned, random seed set
- [ ] Model serialized with version and date in filename
