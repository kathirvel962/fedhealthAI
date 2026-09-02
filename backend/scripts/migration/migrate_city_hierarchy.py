#!/usr/bin/env python
"""
Migration Script: Add City-Level Hierarchy to System

Maps existing PHCs to cities:
- PHC_1 → Pollachi
- PHC_2 → Pollachi
- PHC_3 → Thondamuthur
- PHC_4 → Thondamuthur
- PHC_5 → Kinathukadavu

Coimbatore remains as district.
"""
import os
import sys
import django
from datetime import datetime

# Setup Django environment
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fedhealth.settings')
django.setup()

from api.models import PHC, Patient, RiskScore

# PHC to City Mapping
PHC_CITY_MAPPING = {
    'PHC_1': 'Pollachi',
    'PHC_2': 'Pollachi',
    'PHC_3': 'Thondamuthur',
    'PHC_4': 'Thondamuthur',
    'PHC_5': 'Kinathukadavu'
}

DISTRICT_ID = 'Coimbatore'


VERIFIED_PHC_DATA = {
    'PHC_1': {
        'phc_name': 'Zamin Uthukuli PHC',
        'latitude': 10.9765,
        'longitude': 77.0012,
        'email': 'zaminuthukuli.phc@tn.gov.in'
    },
    'PHC_2': {
        'phc_name': 'Vadakkipalayam PHC',
        'latitude': 10.9575,
        'longitude': 76.9538,
        'email': 'vadakkipalayam.phc@tn.gov.in'
    },
    'PHC_3': {
        'phc_name': 'Thondamuthur PHC',
        'latitude': 10.9950,
        'longitude': 76.8290,
        'email': 'thondamuthur.phc@tn.gov.in'
    },
    'PHC_4': {
        'phc_name': 'Pooluvapatti PHC',
        'latitude': 10.9634,
        'longitude': 76.7985,
        'email': 'pooluvapatti.phc@tn.gov.in'
    },
    'PHC_5': {
        'phc_name': 'Kinathukadavu PHC',
        'latitude': 10.8242,
        'longitude': 77.0185,
        'email': 'kinathukadavu.phc@tn.gov.in'
    }
}


def migrate_phcs():
    """Update existing PHC records with city information"""
    print("\n" + "="*70)
    print("MIGRATION: Adding City-Level Hierarchy to PHCs")
    print("="*70)
    
    for phc_id, city in PHC_CITY_MAPPING.items():
        # Check if PHC exists in DB
        existing_phc = PHC.objects(name=phc_id).first()
        verified_data = VERIFIED_PHC_DATA.get(phc_id, {})
        
        if existing_phc:
            # Update existing PHC with city and details
            existing_phc.city = city
            if verified_data:
                existing_phc.phc_name = verified_data['phc_name']
                existing_phc.latitude = verified_data['latitude']
                existing_phc.longitude = verified_data['longitude']
                existing_phc.email = verified_data['email']
            existing_phc.updated_at = datetime.utcnow()
            existing_phc.save()
            print(f"✓ Updated PHC: {phc_id} → City: {city}")
        else:
            # Create new PHC if it doesn't exist
            phc = PHC.objects.create(
                name=phc_id,
                district_id=DISTRICT_ID,
                city=city,
                phc_name=verified_data.get('phc_name'),
                latitude=verified_data.get('latitude'),
                longitude=verified_data.get('longitude'),
                email=verified_data.get('email')
            )
            print(f"✓ Created PHC: {phc_id} → City: {city}")


def migrate_patients():
    """Add city field to all existing patient records"""
    print("\n" + "="*70)
    print("MIGRATION: Adding City Field to Patients")
    print("="*70)
    
    total_updated = 0
    
    for phc_id, city in PHC_CITY_MAPPING.items():
        # Update all patients from this PHC with city
        result = Patient.objects.filter(phc_id=phc_id).update(
            set__city=city
        )
        total_updated += result
        patient_count = Patient.objects.filter(phc_id=phc_id).count()
        print(f"✓ {phc_id}: {patient_count} patients → City: {city}")
    
    print(f"\nTotal patients updated with city: {total_updated}")


def validate_migration():
    """Validate that migration was successful"""
    print("\n" + "="*70)
    print("VALIDATION: Checking Migration Success")
    print("="*70)
    
    # Check PHCs
    print("\n1. PHC Records with Cities:")
    phcs = PHC.objects()
    for phc in phcs:
        print(f"   {phc.name}: District={phc.district_id}, City={phc.city}")
    
    # Check Patient City Distribution
    print("\n2. Patient City Distribution:")
    for city in set(PHC_CITY_MAPPING.values()):
        patient_count = Patient.objects.filter(city=city).count()
        print(f"   {city}: {patient_count} patients")
    
    # Check patients without city (should be 0)
    patients_without_city = Patient.objects.filter(city=None).count()
    print(f"\n3. Patients without city: {patients_without_city}")
    
    if patients_without_city == 0:
        print("   ✓ All patients have city assigned")
    else:
        print("   ⚠ WARNING: Some patients missing city!")
    
    # Summary by PHC
    print("\n4. Summary by PHC:")
    for phc_id, city in PHC_CITY_MAPPING.items():
        count = Patient.objects.filter(phc_id=phc_id).count()
        print(f"   {phc_id} ({city}): {count} patients")


if __name__ == '__main__':
    try:
        migrate_phcs()
        migrate_patients()
        validate_migration()
        
        print("\n" + "="*70)
        print("✓ MIGRATION COMPLETE")
        print("="*70)
        
    except Exception as e:
        print(f"\n✗ MIGRATION FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
