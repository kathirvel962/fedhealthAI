import os
import django
import random
import csv
from datetime import datetime, timezone
from pathlib import Path

# Setup Django environment
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fedhealth.settings')
django.setup()

from api.models import User, Patient, GlobalModel, LocalModel, TrainingMetadata
from api.authentication import hash_password
from api.ml_utils import handle_patient_creation


print("\n===== INITIALIZING DATABASE =====\n")

# ---------------------------------------------------
# [1] CLEAR EXISTING DATA
# ---------------------------------------------------

print("Clearing existing data...")

User.objects.all().delete()
Patient.objects.all().delete()
GlobalModel.objects.all().delete()
LocalModel.objects.all().delete()
TrainingMetadata.objects.all().delete()

print("[OK] Old data cleared\n")


# ---------------------------------------------------
# [2] CREATE DEMO USERS
# ---------------------------------------------------

demo_users = [
    {'username': 'district_admin', 'password': 'password123', 'role': 'DISTRICT_ADMIN', 'phc_id': None},
    {'username': 'phc1_user', 'password': 'password123', 'role': 'PHC_USER', 'phc_id': 'PHC_1'},
    {'username': 'phc2_user', 'password': 'password123', 'role': 'PHC_USER', 'phc_id': 'PHC_2'},
    {'username': 'phc3_user', 'password': 'password123', 'role': 'PHC_USER', 'phc_id': 'PHC_3'},
    {'username': 'phc4_user', 'password': 'password123', 'role': 'PHC_USER', 'phc_id': 'PHC_4'},
    {'username': 'surveillance_user', 'password': 'password123', 'role': 'SURVEILLANCE_OFFICER', 'phc_id': None},
]

print("Creating demo users...")

for user_data in demo_users:
    try:
        User.objects.create(
            username=user_data['username'],
            password_hash=hash_password(user_data['password']),
            role=user_data['role'],
            phc_id=user_data['phc_id']
        )
        print(f"  [OK] Created: {user_data['username']} ({user_data['role']})")
    except Exception as e:
        print(f"  [ERROR] Error creating user {user_data['username']}: {str(e)}")

print("\n[OK] Demo users created\n")


# ---------------------------------------------------
# [3] SEED PATIENT DATA FROM CSV FILES & TRIGGER TRAINING
# ---------------------------------------------------

print("Seeding patient data from CSV files...\n")

# CSV files to load
csv_files = {
    'PHC_1': '../PHC1_dataset_500_rows.csv',
    'PHC_2': '../PHC2_dataset_500_rows.csv',
    'PHC_3': '../PHC3_dataset_500_rows.csv',
    'PHC_4': '../PHC4_dataset_500_rows.csv',
}

for phc_id, csv_path in csv_files.items():
    full_path = Path(__file__).parent / csv_path
    
    if not full_path.exists():
        print(f"  [SKIP] CSV file not found: {full_path}")
        continue
    
    patient_count = 0
    
    try:
        with open(full_path, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            
            for row in reader:
                try:
                    # Extract only fields needed for Patient model
                    # CSV has extra columns (patient_id, blood_pressure, prescription, visit_date)
                    # We only use: age, gender, fever, cough, rash, wbc_count, diagnosis
                    
                    Patient.objects.create(
                        phc_id=phc_id,
                        age=int(row['age']),
                        gender=row['gender'][0].upper(),  # Take first letter (M/F)
                        fever=int(row['fever']),
                        cough=int(row['cough']),
                        rash=int(row['rash']),
                        wbc_count=int(row['wbc_count']),
                        diagnosis=row['diagnosis'].strip(),
                        created_at=datetime.now(timezone.utc)
                    )
                    patient_count += 1
                except ValueError as e:
                    # Skip rows with invalid data
                    pass
                except Exception as e:
                    pass  # Skip problematic rows silently
        
        print(f"  [OK] Loaded {patient_count} patients for {phc_id} from CSV")
        
        # ============================================
        # TRIGGER TRAINING AFTER CSV LOAD
        # ============================================
        
        print(f"  [INFO] Triggering training for {phc_id}...", end=' ')
        
        try:
            # Set up metadata and trigger training
            metadata = TrainingMetadata.objects.filter(phc_id=phc_id).first()
            if not metadata:
                metadata = TrainingMetadata.objects.create(phc_id=phc_id)
            
            # Set count to trigger training
            metadata.patients_since_last_training = patient_count
            metadata.updated_at = datetime.now(timezone.utc)
            metadata.save()
            
            # Trigger training pipeline
            training_result = handle_patient_creation(phc_id)
            
            if training_result.get('model_trained'):
                print(
                    f"[TRAINED] v{training_result.get('model_version')} "
                    f"Acc: {training_result.get('model_accuracy'):.4f}"
                )
            else:
                error = training_result.get('error', training_result.get('trigger_reason', 'Unknown'))
                print(f"[SKIPPED] {error}")
        except Exception as e:
            print(f"[ERROR] {str(e)}")
    
    except IOError as e:
        print(f"  [ERROR] Could not read CSV file: {csv_path}")

print("\n[OK] Patient data seeded from CSV files\n")


# ---------------------------------------------------
# [4] FINAL STATUS
# ---------------------------------------------------

print("===== DATABASE INITIALIZED SUCCESSFULLY [OK] =====")

print("\n[CREDENTIALS] Demo Users:")
for user in demo_users:
    print(f"  - {user['username']} / {user['password']} ({user['role']})")

print("\n[INFO] Database ready for UI testing and federated training!")
print("If training is auto-triggered at 20+ patients per PHC,")
print("local models should now be created automatically.\n")