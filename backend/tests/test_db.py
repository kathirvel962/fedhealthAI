import os
import django
import sys

# Initialize Django settings and database connections
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fedhealth.settings')
django.setup()

# Import models
from api.models import Patient, LocalModel

print("\nChecking data in database...")
total = Patient.objects.count()
print(f"Total patients: {total}")

for phc in ['PHC_1', 'PHC_2', 'PHC_3', 'PHC_4', 'PHC_5']:
    count = Patient.objects.filter(phc_id=phc).count()
    models = LocalModel.objects.filter(phc_id=phc).count()
    print(f"{phc}: {count} patients, {models} models")

print("\nDone!")
