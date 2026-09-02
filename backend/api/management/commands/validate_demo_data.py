import re
from django.core.management.base import BaseCommand
from api.models import (
    User, PHC, Patient, LocalModel, GlobalModel, RiskScore, Alert,
    HealthAlert, PHCRelationship, CohortSnapshot, FederatedRound, NonIIDAnalysisResult
)

class Command(BaseCommand):
    help = 'Validate demonstration database consistency and integrity'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Running demonstration data validations..."))
        self.stdout.write("="*70)

        errors = []

        # 1. PHC count and fields check
        phc_count = PHC.objects.count()
        self.stdout.write(f"PHCs found: {phc_count} (Expected: 5)")
        if phc_count != 5:
            errors.append(f"Invalid PHC count: {phc_count} (expected 5)")

        phcs = list(PHC.objects.all())
        emails = []
        for p in phcs:
            # Coordinate check
            if p.latitude is None or p.longitude is None:
                errors.append(f"PHC {p.name} has missing coordinates")
            elif not (-90.0 <= p.latitude <= 90.0) or not (-180.0 <= p.longitude <= 180.0):
                errors.append(f"PHC {p.name} has coordinates out of bounds: lat={p.latitude}, lon={p.longitude}")

            # Email check
            if not p.email:
                errors.append(f"PHC {p.name} is missing email")
            else:
                email_regex = r"(^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$)"
                if not re.match(email_regex, p.email):
                    errors.append(f"PHC {p.name} has invalid email format: {p.email}")
                if p.email in emails:
                    errors.append(f"PHC {p.name} has duplicate email: {p.email}")
                emails.append(p.email)

        # 2. Patient count and fields check
        patient_count = Patient.objects.count()
        self.stdout.write(f"Patients found: {patient_count} (Expected: 10000)")
        if patient_count != 10000:
            errors.append(f"Invalid total patient count: {patient_count} (expected 10000)")

        phc_ids = ['PHC_1', 'PHC_2', 'PHC_3', 'PHC_4', 'PHC_5']
        for phc_id in phc_ids:
            count = Patient.objects.filter(phc_id=phc_id).count()
            self.stdout.write(f"  • {phc_id} patient count: {count} (Expected: 2000)")
            if count != 2000:
                errors.append(f"PHC {phc_id} has invalid patient count: {count} (expected 2000)")

        # Verify disease labels are valid
        valid_diseases = {'Dengue', 'Healthy', 'Malaria', 'Pneumonia', 'Typhoid', 'Viral Fever'}
        patients = Patient.objects.all()
        orphan_patients = 0
        invalid_disease_labels = 0
        for p in patients:
            if p.phc_id not in phc_ids:
                orphan_patients += 1
            if p.disease_label not in valid_diseases:
                invalid_disease_labels += 1

        if orphan_patients > 0:
            errors.append(f"Orphan patients found: {orphan_patients}")
        if invalid_disease_labels > 0:
            errors.append(f"Patients with invalid disease labels found: {invalid_disease_labels}")

        # 3. User count check
        user_count = User.objects.count()
        self.stdout.write(f"Users found: {user_count} (Expected: 7)")
        if user_count != 7:
            errors.append(f"Invalid user count: {user_count} (expected 7)")

        # 4. Alerts checks
        active_health_alerts = HealthAlert.objects.filter(status__ne='RESOLVED').count()
        resolved_health_alerts = HealthAlert.objects.filter(status='RESOLVED').count()
        self.stdout.write(f"Health alerts: {active_health_alerts} active, {resolved_health_alerts} resolved")
        
        # 5. Local and Global Models
        local_model_count = LocalModel.objects.count()
        global_model_count = GlobalModel.objects.count()
        self.stdout.write(f"Local models: {local_model_count}, Global models: {global_model_count}")
        
        # 6. Non-IID Heterogeneity divergence calculations check
        non_iid_res = NonIIDAnalysisResult.objects.order_by('-analysis_version').first()
        jsd_calculated = False
        if non_iid_res and non_iid_res.pairwise_divergences:
            jsd_calculated = True
        self.stdout.write(f"Heterogeneity pairwise JS Divergence calculated: {jsd_calculated}")
        if not jsd_calculated:
            errors.append("JS Divergence analysis results not computed or empty")

        self.stdout.write("="*70)
        if errors:
            self.stdout.write(self.style.ERROR(f"VALIDATION FAILED: {len(errors)} error(s) discovered!"))
            for err in errors:
                self.stdout.write(self.style.ERROR(f"  ✗ {err}"))
            exit(1)
        else:
            self.stdout.write(self.style.SUCCESS("VALIDATION PASSED: Demonstration dataset is consistent, valid, and complete!"))
            
            # Print expected seed summary
            self.stdout.write("\nFEDHEALTH AI DEMO DATA SUMMARY\n")
            self.stdout.write(f"PHCs:                  {phc_count}")
            self.stdout.write(f"Patients:              {patient_count}")
            self.stdout.write(f"PHC Emails:            {len(emails)} configured")
            self.stdout.write(f"PHC Locations:         {len(phcs)} configured")
            self.stdout.write(f"Active Alerts:         {active_health_alerts}")
            self.stdout.write(f"Historical Alerts:     {resolved_health_alerts}")
            self.stdout.write(f"Training Rounds:       {FederatedRound.objects.count()}")
            self.stdout.write(f"Models:                {local_model_count + global_model_count}")
            self.stdout.write(f"Heterogeneity Divergences: Calculated")
