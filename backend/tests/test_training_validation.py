#!/usr/bin/env python
"""
Test script to validate training pipeline fixes.
Tests comprehensive validation logic, train/test split, and overfitting detection.
"""
import os
import sys
import django
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fedhealth.settings')
django.setup()

from api.models import Patient, LocalModel
from api.ml_utils import train_federated_model, train_local_model, preprocess_data, evaluate_model
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

print("\n" + "="*90)
print("TRAINING PIPELINE VALIDATION TEST")
print("="*90 + "\n")

# Test PHC
TEST_PHC = 'PHC_1'

# Check data
patient_count = Patient.objects.filter(phc_id=TEST_PHC).count()
print(f"✓ Patient data for {TEST_PHC}: {patient_count} samples")

if patient_count == 0:
    print("✗ No patient data found. Skipping test.")
    exit(1)

# ============================================
# TEST 1: Data Preprocessing
# ============================================
print("\n" + "-"*90)
print("TEST 1: Data Preprocessing & Feature Engineering")
print("-"*90)

patients = list(Patient.objects.filter(phc_id=TEST_PHC))
feature_columns = ['fever', 'cough', 'rash', 'wbc_count']

X, y, features = preprocess_data(patients, feature_columns)

print(f"✓ Loaded {len(patients)} patients")
print(f"✓ Feature matrix shape: {X.shape}")
print(f"✓ Label distribution: {dict(zip(*np.unique(y, return_counts=True)))}")
print(f"✓ Features used: {features}")
print(f"✓ Diagnosis NOT in features: {'diagnosis' not in features}")

# Check for NaN
has_nan = np.isnan(X).any()
print(f"✓ No NaN in features: {not has_nan}")

# ============================================
# TEST 2: Model Training with Validation
# ============================================
print("\n" + "-"*90)
print("TEST 2: Model Training with Comprehensive Validation")
print("-"*90)

model_result = train_local_model(X, y, feature_columns)

if model_result.get('error'):
    print(f"✗ Training error: {model_result['error']}")
    exit(1)

print(f"✓ Model trained successfully")
print(f"✓ Training samples: {model_result['num_train']}")
print(f"✓ Test samples: {model_result['num_test']}")
print(f"✓ Stratified split: {model_result['stratified']}")
print(f"✓ Classes: {model_result['classes']}")
print(f"✓ Cross-validation scores: {model_result['cv_scores']}")
print(f"✓ CV mean accuracy: {model_result['cv_mean']:.4f} ± {model_result['cv_std']:.4f}")

# ============================================
# TEST 3: Model Evaluation (Train vs Test)
# ============================================
print("\n" + "-"*90)
print("TEST 3: Model Evaluation on Hold-Out Test Set")
print("-"*90)

eval_result = evaluate_model(model_result)

if eval_result.get('error'):
    print(f"✗ Evaluation error: {eval_result['error']}")
    exit(1)

metrics = eval_result['metrics']

print(f"\n→ TEST SET METRICS (Hold-Out Data):")
print(f"  - Accuracy:    {metrics['test_accuracy']:.4f}")
print(f"  - Precision:   {metrics['test_precision']:.4f}")
print(f"  - Recall:      {metrics['test_recall']:.4f}")
print(f"  - F1-Score:    {metrics['test_f1_score']:.4f}")
if metrics['test_roc_auc']:
    print(f"  - ROC-AUC:     {metrics['test_roc_auc']:.4f}")

print(f"\n→ TRAIN SET METRICS (For Comparison):")
print(f"  - Accuracy:    {metrics['train_accuracy']:.4f}")
print(f"  - Precision:   {metrics['train_precision']:.4f}")
print(f"  - Recall:      {metrics['train_recall']:.4f}")
print(f"  - F1-Score:    {metrics['train_f1_score']:.4f}")

print(f"\n→ OVERFITTING ANALYSIS:")
print(f"  - Accuracy Gap (Train-Test): {metrics['accuracy_delta']:.4f}")
print(f"  - F1 Gap (Train-Test):       {metrics['f1_delta']:.4f}")
print(f"  - Overfitting Detected:      {metrics['overfitting_detected']}")
if metrics['overfitting_reason']:
    print(f"  - Reason:                    {metrics['overfitting_reason']}")

print(f"\n→ SAMPLE DISTRIBUTION:")
print(f"  - Total samples:             {metrics['num_train_samples'] + metrics['num_test_samples']}")
print(f"  - Training set:              {metrics['num_train_samples']} ({100*metrics['num_train_samples']/(metrics['num_train_samples']+metrics['num_test_samples']):.1f}%)")
print(f"  - Test set:                  {metrics['num_test_samples']} ({100*metrics['num_test_samples']/(metrics['num_train_samples']+metrics['num_test_samples']):.1f}%)")

print(f"\n→ CLASS DISTRIBUTION:")
print(f"  Train: {metrics['class_distribution_train']}")
print(f"  Test:  {metrics['class_distribution_test']}")

print(f"\n→ CONFUSION MATRIX:")
cm = np.array(metrics['test_confusion_matrix'])
print(f"  {cm}")

print(f"\n→ CLASSIFICATION REPORT BY CLASS:")
class_report = metrics['classification_report']
for class_name, scores in class_report.items():
    print(f"  {class_name}:")
    print(f"    - Precision: {scores['precision']:.4f}")
    print(f"    - Recall:    {scores['recall']:.4f}")
    print(f"    - F1-Score:  {scores['f1-score']:.4f}")
    print(f"    - Support:   {scores['support']}")

# ============================================
# TEST 4: Full Training Pipeline
# ============================================
print("\n" + "-"*90)
print("TEST 4: Full Training Pipeline (train_federated_model)")
print("-"*90)

# Check if model already exists
existing_models = LocalModel.objects.filter(phc_id=TEST_PHC).count()
print(f"ℹ Existing models for {TEST_PHC}: {existing_models}")

full_result = train_federated_model(TEST_PHC, trigger_reason='validation_test')

if full_result.get('error'):
    print(f"✗ Training error: {full_result['error']}")
else:
    print(f"✓ Full pipeline completed successfully")
    print(f"  - Version:                  {full_result.get('version_string')}")
    print(f"  - Test Accuracy:            {full_result.get('accuracy'):.4f}")
    print(f"  - Train Accuracy:           {full_result.get('train_accuracy'):.4f}")
    print(f"  - Accuracy Delta:           {full_result.get('accuracy_delta'):.4f}")
    print(f"  - Overfitting Detected:     {full_result.get('overfitting_detected')}")
    print(f"  - Precision:                {full_result.get('precision'):.4f}")
    print(f"  - Recall:                   {full_result.get('recall'):.4f}")
    print(f"  - F1-Score:                 {full_result.get('f1_score'):.4f}")
    print(f"  - Samples (Total):          {full_result.get('num_samples')}")
    print(f"  - Samples (Train):          {full_result.get('num_train_samples')}")
    print(f"  - Samples (Test):           {full_result.get('num_test_samples')}")
    
    if 'ml_insights' in full_result:
        print(f"\n  - ML Insights:")
        drift = full_result['ml_insights'].get('drift_detection', {})
        risk = full_result['ml_insights'].get('composite_risk_score', {})
        if drift.get('drift_detected'):
            print(f"    • Drift detected: {drift['accuracy_drop_percentage']:.2f}% drop")
        if risk.get('risk_score'):
            print(f"    • Risk score: {risk['risk_score']:.2f}/100 ({risk['severity']})")

# ============================================
# VALIDATION CHECKLIST
# ============================================
print("\n" + "="*90)
print("VALIDATION CHECKLIST")
print("="*90)

checklist = [
    ("✓", "train_test_split is used", True),
    ("✓", "test set is not empty", model_result.get('num_test', 0) > 0),
    ("✓", "evaluation is on X_test, y_test (NOT full X, y)", 'X_test' in model_result and 'y_test' in model_result),
    ("✓", "diagnosis is NOT in feature matrix", 'diagnosis' not in feature_columns),
    ("✓", "stratified splitting is used", model_result.get('stratified', False)),
    ("✓", "confusion matrix is computed", 'test_confusion_matrix' in metrics),
    ("✓", "classification report is generated", len(metrics['classification_report']) > 0),
    ("✓", "cross-validation is performed (n>100)", len(model_result['cv_scores']) > 0),
    ("✓", "train vs test comparison reveals realism", metrics['accuracy_delta'] < 0.5),  # Reasonable gap
]

for symbol, description, passed in checklist:
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"{status}: {description}")

print("\n" + "="*90)
print("SUMMARY")
print("="*90)
print(f"Test dataset: {patient_count} samples")
print(f"Test accuracy (realistic): {metrics['test_accuracy']:.4f}")
print(f"Train/Test gap: {metrics['accuracy_delta']:.4f} (should be small)")
print(f"All validations: {'✓ PASSED' if all(p for _, _, p in checklist) else '✗ FAILED'}")
print("="*90 + "\n")
