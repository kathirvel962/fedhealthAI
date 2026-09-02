#!/usr/bin/env python
"""
Seed MongoDB with 10,000 patient records from CSV.

IMPORTANT: This script:
- Clears old patient data
- Loads new dataset from CSV
- Validates data integrity
- Inserts bulk records
- Creates required indexes
"""
import os
import sys
import django
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fedhealth.settings')
django.setup()

from api.models import Patient
from datetime import datetime
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================
# CONFIGURATION
# ============================================
CSV_PATH = r'c:\Users\jones\Downloads\Synthetic_PHC_ABDM_Dataset_10000.csv'
EXPECTED_PHCS = ['PHC_1', 'PHC_2', 'PHC_3', 'PHC_4', 'PHC_5']
EXPECTED_RECORDS_PER_PHC = 2000
TOTAL_EXPECTED_RECORDS = 10000

# ============================================
# COLUMN MAPPING (CSV → Model)
# ============================================
COLUMN_MAPPING = {
    'Patient_ID': 'patient_id',
    'Age': 'age',
    'Gender': 'gender',
    'PHC_ID': 'phc_id',
    'Fever': 'fever',
    'Cough': 'cough',
    'Fatigue': 'fatigue',
    'Headache': 'headache',
    'Vomiting': 'vomiting',
    'Breathlessness': 'breathlessness',
    'Temperature_C': 'temperature_c',
    'Heart_Rate': 'heart_rate',
    # Note: BP_Systolic is generated during seeding (not in CSV)
    'WBC_Count': 'wbc_count',
    'Platelet_Count': 'platelet_count',
    'Hemoglobin': 'hemoglobin',
    'Disease_Label': 'disease_label',
    'Severity_Level': 'severity_level'
}

def validate_csv_exists():
    """Check if CSV file exists"""
    if not os.path.exists(CSV_PATH):
        logger.error(f"CSV file not found: {CSV_PATH}")
        return False
    logger.info(f"✓ CSV file found: {CSV_PATH}")
    return True

def load_csv():
    """Load CSV and validate structure"""
    logger.info("Loading CSV...")
    try:
        df = pd.read_csv(CSV_PATH)
        logger.info(f"✓ Loaded {len(df)} records")
        
        # Validate columns
        missing_cols = set(COLUMN_MAPPING.keys()) - set(df.columns)
        if missing_cols:
            logger.error(f"✗ Missing columns: {missing_cols}")
            return None
        
        logger.info(f"✓ All {len(COLUMN_MAPPING)} required columns present")
        return df
    except Exception as e:
        logger.error(f"✗ Error loading CSV: {str(e)}")
        return None

def validate_data(df):
    """Validate data integrity"""
    logger.info("\nValidating data...")
    
    # Check total records
    if len(df) != TOTAL_EXPECTED_RECORDS:
        logger.warning(f"⚠ Expected {TOTAL_EXPECTED_RECORDS} records, got {len(df)}")
    else:
        logger.info(f"✓ Total records: {len(df)}")
    
    # Check PHC distribution
    phc_counts = df['PHC_ID'].value_counts().to_dict()
    logger.info(f"✓ PHC Distribution:")
    for phc_id in EXPECTED_PHCS:
        count = phc_counts.get(phc_id, 0)
        if count == EXPECTED_RECORDS_PER_PHC:
            logger.info(f"  {phc_id}: {count} ✓")
        else:
            logger.warning(f"  {phc_id}: {count} (expected {EXPECTED_RECORDS_PER_PHC})")
    
    # Check for duplicates
    duplicate_ids = df['Patient_ID'].duplicated().sum()
    if duplicate_ids > 0:
        logger.warning(f"⚠ Found {duplicate_ids} duplicate Patient_IDs")
        return False
    logger.info(f"✓ No duplicate Patient_IDs")
    
    # Check for null values
    null_counts = df.isnull().sum()
    if null_counts.sum() > 0:
        logger.warning(f"⚠ Found {null_counts.sum()} null values:")
        print(null_counts[null_counts > 0])
        return False
    logger.info(f"✓ No null values")
    
    # Check disease labels
    diseases = df['Disease_Label'].unique()
    logger.info(f"✓ Disease labels: {sorted(diseases)}")
    
    # Check severity levels
    severities = df['Severity_Level'].unique()
    logger.info(f"✓ Severity levels: {sorted(severities)}")
    
    return True

def clear_old_patients():
    """Clear existing patient data"""
    logger.info("\nClearing old patient data...")
    try:
        count = Patient.objects.count()
        if count > 0:
            Patient.objects.delete()
            logger.info(f"✓ Deleted {count} old patient records")
        else:
            logger.info(f"✓ No old records to delete")
    except Exception as e:
        logger.error(f"✗ Error clearing data: {str(e)}")
        return False
    return True

def seed_patients(df):
    """Insert patient records into MongoDB"""
    logger.info(f"\nSeeding {len(df)} patient records...")
    
    try:
        # Convert DataFrame to list of Patient documents
        patients_to_insert = []
        
        for idx, row in df.iterrows():
            # Generate BP_Systolic if not in CSV (reasonable estimate based on age)
            # Formula: 90 + (age * 0.5) + random variation (0-10)
            import random
            age = int(row['Age'])
            base_bp = 90 + (age * 0.3)
            bp_systolic = int(base_bp + random.randint(-5, 10))
            bp_systolic = max(70, min(180, bp_systolic))  # Clamp to realistic range
            
            # Create a realistic timestamp spread over 90 days
            # For PHC_3 and Dengue, we put more cases in the last 14 days to simulate an outbreak
            import random
            from datetime import timedelta
            disease = str(row['Disease_Label'])
            phc = str(row['PHC_ID'])
            
            if phc == 'PHC_3' and disease == 'Dengue':
                if random.random() < 0.65:
                    # Current period (0-14 days ago)
                    days_ago = random.randint(0, 14)
                else:
                    # Baseline period (15-90 days ago)
                    days_ago = random.randint(15, 90)
            else:
                # Normal uniform distribution
                days_ago = random.randint(0, 90)
                
            created_at = datetime.utcnow() - timedelta(days=days_ago)
            
            patient = Patient(
                patient_id=str(row['Patient_ID']),
                age=age,
                gender=str(row['Gender']),
                phc_id=str(row['PHC_ID']),
                fever=int(row['Fever']),
                cough=int(row['Cough']),
                fatigue=int(row['Fatigue']),
                headache=int(row['Headache']),
                vomiting=int(row['Vomiting']),
                breathlessness=int(row['Breathlessness']),
                temperature_c=float(row['Temperature_C']),
                heart_rate=int(row['Heart_Rate']),
                bp_systolic=bp_systolic,
                wbc_count=int(row['WBC_Count']),
                platelet_count=int(row['Platelet_Count']),
                hemoglobin=float(row['Hemoglobin']),
                disease_label=str(row['Disease_Label']),
                severity_level=str(row['Severity_Level']),
                created_at=created_at
            )
            patients_to_insert.append(patient)
            
            # Print progress every 1000 records
            if (idx + 1) % 1000 == 0:
                logger.info(f"  Prepared {idx + 1} records...")
        
        # Bulk insert
        logger.info("Inserting records into MongoDB...")
        inserted = Patient.objects.insert(patients_to_insert, write_concern={"w": 1})
        logger.info(f"✓ Inserted {len(inserted)} patient records")
        
        return True
    except Exception as e:
        logger.error(f"✗ Error seeding patients: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def create_indexes():
    """Ensure required indexes exist"""
    logger.info("\nCreating indexes...")
    try:
        # Indexes are defined in model meta, but ensure they exist
        Patient.ensure_indexes()
        logger.info("✓ Indexes created successfully")
        return True
    except Exception as e:
        logger.warning(f"⚠ Error creating indexes: {str(e)}")
        return True  # Don't fail on this

def verify_seeding():
    """Verify seeding success"""
    logger.info("\n" + "="*70)
    logger.info("VERIFICATION")
    logger.info("="*70)
    
    try:
        total = Patient.objects.count()
        logger.info(f"Total patients: {total}")
        
        if total != TOTAL_EXPECTED_RECORDS:
            logger.warning(f"⚠ Expected {TOTAL_EXPECTED_RECORDS}, got {total}")
        else:
            logger.info(f"✓ Record count matches expected")
        
        # Count by PHC
        logger.info("\nPatients per PHC:")
        for phc_id in sorted(EXPECTED_PHCS):
            count = Patient.objects.filter(phc_id=phc_id).count()
            logger.info(f"  {phc_id}: {count}")
        
        # Count by disease
        logger.info("\nPatients by Disease:")
        diseases = Patient.objects.distinct('disease_label')
        for disease in sorted(diseases):
            count = Patient.objects.filter(disease_label=disease).count()
            logger.info(f"  {disease}: {count}")
        
        # Count by severity
        logger.info("\nPatients by Severity:")
        severities = Patient.objects.distinct('severity_level')
        for severity in sorted(severities):
            count = Patient.objects.filter(severity_level=severity).count()
            logger.info(f"  {severity}: {count}")
        
        logger.info("\n" + "="*70)
        logger.info("✓ SEEDING COMPLETE")
        logger.info("="*70)
        
        return True
    except Exception as e:
        logger.error(f"✗ Verification error: {str(e)}")
        return False

def main():
    """Main seeding workflow"""
    logger.info("\n" + "="*70)
    logger.info("PATIENT DATA MIGRATION - CSV SEEDING")
    logger.info("="*70 + "\n")
    
    # Step 1: Validate CSV exists
    if not validate_csv_exists():
        sys.exit(1)
    
    # Step 2: Load CSV
    df = load_csv()
    if df is None:
        sys.exit(1)
    
    # Step 3: Validate data
    if not validate_data(df):
        logger.warning("Data validation warnings - proceeding with caution")
    
    # Step 4: Skip clear - collection already dropped, seed directly
    
    # Step 5: Seed patients
    if not seed_patients(df):
        sys.exit(1)
    
    # Step 6: Create indexes
    create_indexes()
    
    # Step 7: Verify
    verify_seeding()

if __name__ == '__main__':
    main()
