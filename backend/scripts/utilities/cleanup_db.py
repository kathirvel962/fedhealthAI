#!/usr/bin/env python
"""Clear all MongoDB collections for testing/reset"""
import sys
import os

# Setup Django environment
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fedhealth.settings')

import django
django.setup()

from api.models import User, Patient, PHC, LocalModel, GlobalModel, Alert, TrainingMetadata

# Drop all collections
User.drop_collection()
Patient.drop_collection()
PHC.drop_collection()
LocalModel.drop_collection()
GlobalModel.drop_collection()
Alert.drop_collection()
TrainingMetadata.drop_collection()

print("✅ All MongoDB collections cleared successfully!")
