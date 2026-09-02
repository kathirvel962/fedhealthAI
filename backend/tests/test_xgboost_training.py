#!/usr/bin/env python
"""
Test script to verify XGBoost model training works correctly.
Tests all 4 PHC models and checks for training success/accuracy.
"""
import os
import sys
import django
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fedhealth.settings')
django.setup()

from api.models import Patient, LocalModel, TrainingMetadata
from api.ml_utils import train_federated_model
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_xgboost_training():
    """Test XGBoost model training for all PHCs"""
    print("\n" + "="*70)
    print("XGBOOST FEDERATED LEARNING TEST")
    print("="*70)
    
    results = {}
    
    for phc_num in range(1, 5):
        phc_id = f'PHC_{phc_num}'
        patient_count = Patient.objects.filter(phc_id=phc_id).count()
        
        print(f"\n[PHC{phc_num}] Starting training with {patient_count} patients...")
        
        if patient_count < 10:
            print(f"[PHC{phc_num}] NOT ENOUGH DATA - Need >= 10 samples")
            results[phc_id] = {
                'status': 'SKIPPED',
                'reason': 'insufficient_data',
                'patient_count': patient_count
            }
            continue
        
        try:
            # Train model
            result = train_federated_model(phc_id, trigger_reason='testing')
            
            if result.get('error'):
                print(f"[PHC{phc_num}] TRAINING FAILED - {result['error']}")
                results[phc_id] = {
                    'status': 'FAILED',
                    'error': result['error'],
                    'patient_count': patient_count
                }
            else:
                print(f"[PHC{phc_num}] TRAINING SUCCESS")
                print(f"  Version: {result.get('version_string')}")
                print(f"  Accuracy: {result.get('accuracy', 0):.4f}")
                print(f"  Precision: {result.get('precision', 0):.4f}")
                print(f"  Recall: {result.get('recall', 0):.4f}")
                print(f"  F1-Score: {result.get('f1_score', 0):.4f}")
                print(f"  Samples: {result.get('num_samples', 0)}")
                
                results[phc_id] = {
                    'status': 'SUCCESS',
                    'accuracy': result.get('accuracy', 0),
                    'precision': result.get('precision', 0),
                    'recall': result.get('recall', 0),
                    'f1_score': result.get('f1_score', 0),
                    'version': result.get('version_string'),
                    'patient_count': patient_count,
                    'num_samples': result.get('num_samples', 0)
                }
        except Exception as e:
            print(f"[PHC{phc_num}] EXCEPTION - {str(e)}")
            results[phc_id] = {
                'status': 'EXCEPTION',
                'error': str(e),
                'patient_count': patient_count
            }
    
    # Print summary
    print("\n" + "="*70)
    print("TRAINING SUMMARY")
    print("="*70)
    
    success_count = 0
    for phc_id, result in results.items():
        status = result['status']
        if status == 'SUCCESS':
            success_count += 1
            print(f"✓ {phc_id}: {status} | Accuracy: {result['accuracy']:.4f} | Version: {result['version']}")
        else:
            print(f"✗ {phc_id}: {status} | {result.get('error', result.get('reason', 'Unknown'))}")
    
    print(f"\nTotal: {success_count}/4 models trained successfully")
    
    # Check model count in database
    model_count = LocalModel.objects.count()
    print(f"Local Models in DB: {model_count}")
    
    # Check for XGBoost model type
    xgb_models = LocalModel.objects.filter(weights__model_type='xgboost_classifier').count()
    print(f"XGBoost Models: {xgb_models}")
    
    return success_count >= 3  # At least 3 models should succeed

if __name__ == '__main__':
    success = test_xgboost_training()
    if success:
        print("\n✓ XGBOOST TRAINING TEST PASSED")
        exit(0)
    else:
        print("\n✗ XGBOOST TRAINING TEST FAILED")
        exit(1)
