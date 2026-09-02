#!/usr/bin/env python
"""
Direct XGBoost training script - uses Django settings
"""
import os
import sys
import django
from datetime import datetime

# Setup Django environment
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fedhealth.settings')
django.setup()

# Import models and ML utilities
from api.models import Patient, LocalModel, TrainingMetadata
from api.ml_utils import train_federated_model

print("\n" + "="*70)
print("XGBOOST MODEL TRAINING - LOCAL PHC MODELS")
print("="*70)

# Check patient data
total_patients = Patient.objects.count()
print(f"\nTotal patients in database: {total_patients}")

if total_patients == 0:
    print("\nERROR: No patient data found in database!")
    print("Please run seed_from_csv.py first to load the dataset.")
    sys.exit(1)

# PHCs to train
phcs = ['PHC_1', 'PHC_2', 'PHC_3', 'PHC_4', 'PHC_5']

print("\n" + "="*70)
print("TRAINING LOCAL MODELS FOR ALL PHCS")
print("="*70)

for phc_id in phcs:
    existing = LocalModel.objects.filter(phc_id=phc_id).count()
    patients = Patient.objects.filter(phc_id=phc_id).count()
    
    print(f"\n{phc_id}: {patients} patients, {existing} existing models")
    
    if patients == 0:
        print(f"  -> Skipping (no patient data)")
        continue
    
    if existing > 0:
        print(f"  -> Skipping (model already exists)")
        continue
    
    try:
        print(f"  >> Training XGBoost model...")
        result = train_federated_model(phc_id, trigger_reason='MANUAL_INITIALIZATION')
        
        if result.get('error'):
            print(f"    [ERROR] {result['error']}")
        else:
            acc = result.get('accuracy', 0)
            samples = result.get('num_samples', 0)
            version = result.get('version', 0)
            print(f"    [SUCCESS] Version: {version}, Accuracy: {acc:.1%}, Samples: {samples}")
    except Exception as e:
        print(f"    [ERROR] Exception: {str(e)}")
        import traceback
        traceback.print_exc()

print("\n" + "="*70)
print("TRAINING COMPLETE")
print("="*70)

# Summary
print("\nFinal Summary:")
for phc_id in phcs:
    models = LocalModel.objects.filter(phc_id=phc_id).count()
    if models > 0:
        latest = LocalModel.objects.filter(phc_id=phc_id).order_by('-version').first()
        print(f"  {phc_id}: {models} model(s) - Latest accuracy: {latest.accuracy:.1%}")
    else:
        print(f"  {phc_id}: No models trained")

print("\n")
