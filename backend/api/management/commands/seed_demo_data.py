import random
import numpy as np
from datetime import datetime, timezone, timedelta
from django.core.management.base import BaseCommand
from api.models import (
    User, PHC, Patient, TrainingMetadata, LocalModel, GlobalModel,
    RiskScore, Alert, HealthAlert, PHCRelationship, CohortSnapshot,
    FederatedRound, FederatedClientUpdate, GlobalModelVersion,
    ModelEvaluationResult, NonIIDAnalysisResult
)
from api.authentication import hash_password
from api.ml_utils import train_federated_model, perform_federated_round
from api.city_risk_calculator import calculate_district_risk_score
from api.surveillance_service import run_surveillance_detection
from api.non_iid_analyzer import run_non_iid_analysis

def clear_collections():
    User.objects.delete()
    PHC.objects.delete()
    Patient.objects.delete()
    TrainingMetadata.objects.delete()
    LocalModel.objects.delete()
    GlobalModel.objects.delete()
    RiskScore.objects.delete()
    Alert.objects.delete()
    HealthAlert.objects.delete()
    PHCRelationship.objects.delete()
    CohortSnapshot.objects.delete()
    FederatedRound.objects.delete()
    FederatedClientUpdate.objects.delete()
    GlobalModelVersion.objects.delete()
    ModelEvaluationResult.objects.delete()
    NonIIDAnalysisResult.objects.delete()

def create_snapshot_at_date(phc_id, snapshot_date):
    patients = Patient.objects.filter(phc_id=phc_id, created_at__lte=snapshot_date)
    patient_list = list(patients)
    if not patient_list:
        return
    
    total = len(patient_list)
    fever_count = sum(1 for p in patient_list if p.fever)
    cough_count = sum(1 for p in patient_list if p.cough)
    fatigue_count = sum(1 for p in patient_list if p.fatigue)
    headache_count = sum(1 for p in patient_list if p.headache)
    vomiting_count = sum(1 for p in patient_list if p.vomiting)
    breathlessness_count = sum(1 for p in patient_list if p.breathlessness)
    male_count = sum(1 for p in patient_list if p.gender == 'Male')
    high_severity_count = sum(1 for p in patient_list if p.severity_level == 'High')
    
    # Disease distribution
    distribution = {}
    for p in patient_list:
        label = p.disease_label or 'Unknown'
        distribution[label] = distribution.get(label, 0) + 1
        
    CohortSnapshot.objects.create(
        phc_id=phc_id,
        snapshot_date=snapshot_date,
        total_patients=total,
        average_age=sum(p.age for p in patient_list) / total,
        male_percentage=(male_count / total) * 100,
        female_percentage=(1 - male_count / total) * 100,
        fever_percentage=(fever_count / total) * 100,
        cough_percentage=(cough_count / total) * 100,
        fatigue_percentage=(fatigue_count / total) * 100,
        headache_percentage=(headache_count / total) * 100,
        vomiting_percentage=(vomiting_count / total) * 100,
        breathlessness_percentage=(breathlessness_count / total) * 100,
        average_wbc_count=sum(p.wbc_count for p in patient_list) / total,
        average_temperature_c=sum(p.temperature_c for p in patient_list) / total,
        average_heart_rate=sum(p.heart_rate for p in patient_list) / total,
        average_bp_systolic=sum(p.bp_systolic for p in patient_list) / total,
        average_platelet_count=sum(p.platelet_count for p in patient_list) / total,
        average_hemoglobin=sum(p.hemoglobin for p in patient_list) / total,
        high_severity_percentage=(high_severity_count / total) * 100,
        disease_distribution=distribution
    )

class Command(BaseCommand):
    help = 'Rebuild the database from a clean state with a deterministic, consistent demo dataset'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Clearing database collections..."))
        clear_collections()
        self.stdout.write(self.style.SUCCESS("All collections cleared."))

        # 1. Seed PHC Master Data
        self.stdout.write(self.style.WARNING("Seeding Master PHC records..."))
        phcs = [
            {
                'name': 'PHC_1',
                'phc_name': 'Narasipuram Primary Health Center',
                'city': 'Thondamuthur',
                'district_id': 'Coimbatore',
                'latitude': 10.9915,
                'longitude': 76.7712,
                'email': 'phc.1fed@gmail.com'
            },
            {
                'name': 'PHC_2',
                'phc_name': 'S.M.C. Palayam Primary Health Center',
                'city': 'Annur',
                'district_id': 'Coimbatore',
                'latitude': 11.1769,
                'longitude': 77.0703,
                'email': 'phc.2fed@gmail.com'
            },
            {
                'name': 'PHC_3',
                'phc_name': 'Z. Puravipalayam Primary Health Center',
                'city': 'Pollachi North',
                'district_id': 'Coimbatore',
                'latitude': 10.7360,
                'longitude': 76.9629,
                'email': 'phc.3fed@gmail.com'
            },
            {
                'name': 'PHC_4',
                'phc_name': 'Vellalore Primary Health Center',
                'city': 'Madukkarai',
                'district_id': 'Coimbatore',
                'latitude': 10.9778,
                'longitude': 77.0277,
                'email': 'phc.4fed@gmail.com'
            },
            {
                'name': 'PHC_5',
                'phc_name': 'Kuniamuthur Primary Health Center',
                'city': 'Madukkarai / Coimbatore South',
                'district_id': 'Coimbatore',
                'latitude': 10.9627,
                'longitude': 76.9550,
                'email': 'phc.5fed@gmail.com'
            }
        ]
        for p in phcs:
            PHC.objects.create(**p)
        self.stdout.write(self.style.SUCCESS("Master PHC records successfully seeded."))

        # 2. Seed Demo User Credentials
        self.stdout.write(self.style.WARNING("Seeding demo users..."))
        users = [
            {
                'username': 'district_admin',
                'password_hash': hash_password('password123'),
                'role': 'DISTRICT_ADMIN'
            },
            {
                'username': 'phc1_user',
                'password_hash': hash_password('password123'),
                'role': 'PHC_USER',
                'phc_id': 'PHC_1'
            },
            {
                'username': 'phc2_user',
                'password_hash': hash_password('password123'),
                'role': 'PHC_USER',
                'phc_id': 'PHC_2'
            },
            {
                'username': 'phc3_user',
                'password_hash': hash_password('password123'),
                'role': 'PHC_USER',
                'phc_id': 'PHC_3'
            },
            {
                'username': 'phc4_user',
                'password_hash': hash_password('password123'),
                'role': 'PHC_USER',
                'phc_id': 'PHC_4'
            },
            {
                'username': 'phc5_user',
                'password_hash': hash_password('password123'),
                'role': 'PHC_USER',
                'phc_id': 'PHC_5'
            },
            {
                'username': 'surveillance_user',
                'password_hash': hash_password('password123'),
                'role': 'SURVEILLANCE_OFFICER'
            }
        ]
        for u in users:
            User.objects.create(**u)
        self.stdout.write(self.style.SUCCESS("Demo users successfully seeded."))

        # 3. Seed Deterministic Patients
        self.stdout.write(self.style.WARNING("Configuring patient generator..."))
        random.seed(20260829)
        np.random.seed(20260829)
        
        now = datetime.utcnow()
        
        phc_cities = {
            'PHC_1': 'Thondamuthur',
            'PHC_2': 'Annur',
            'PHC_3': 'Pollachi North',
            'PHC_4': 'Madukkarai',
            'PHC_5': 'Madukkarai / Coimbatore South'
        }
        
        disease_choices = ['Dengue', 'Healthy', 'Malaria', 'Pneumonia', 'Typhoid', 'Viral Fever']
        
        # Baseline disease probabilities
        baseline_probs = {
            'PHC_1': [0.30, 0.20, 0.12, 0.12, 0.10, 0.16],
            'PHC_2': [0.10, 0.20, 0.25, 0.13, 0.12, 0.20],
            'PHC_3': [0.10, 0.15, 0.12, 0.14, 0.14, 0.35],
            'PHC_4': [0.12, 0.21, 0.12, 0.21, 0.19, 0.15],
            'PHC_5': [0.22, 0.05, 0.25, 0.15, 0.15, 0.18]
        }
        
        # Outbreak probabilities (last 14 days)
        outbreak_probs = {
            'PHC_1': [0.30, 0.20, 0.12, 0.12, 0.10, 0.16], # stable Dengue
            'PHC_2': [0.05, 0.15, 0.55, 0.05, 0.05, 0.15], # Malaria dominant outbreak
            'PHC_3': [0.05, 0.10, 0.05, 0.05, 0.05, 0.70], # Viral Fever outbreak
            'PHC_4': [0.10, 0.15, 0.05, 0.50, 0.10, 0.10], # Pneumonia outbreak
            'PHC_5': [0.02, 0.03, 0.85, 0.03, 0.02, 0.05]  # Malaria dominant critical outbreak
        }
        
        self.stdout.write("Generating 10,000 patients (2,000 per PHC)...")
        
        patient_id_counter = 1
        patients_to_create = []
        
        for phc_id, city in phc_cities.items():
            for i in range(2000):
                # i from 0 to 1999: created_at starts from 90 days ago up to now
                fraction = i / 2000.0
                days_ago = 90.0 * (1.0 - fraction)
                created_at = now - timedelta(days=days_ago)
                
                # Check if in outbreak period (last 14 days)
                is_outbreak_period = days_ago <= 14.0
                
                # Select probabilities
                probs = outbreak_probs[phc_id] if is_outbreak_period else baseline_probs[phc_id]
                
                # Deterministic selection using cumulative probability
                disease = random.choices(disease_choices, weights=probs)[0]
                
                # Generate age based on PHC profile
                if phc_id == 'PHC_1':
                    age = int(random.triangular(0, 80, 24))
                elif phc_id == 'PHC_3':
                    age = int(random.triangular(15, 100, 62))
                else:
                    age = int(random.uniform(5, 85))
                
                # Generate gender based on PHC target
                p_gender = random.random()
                if phc_id == 'PHC_1':
                    gender = 'Male' if p_gender < 0.49 else 'Female'
                elif phc_id == 'PHC_2':
                    gender = 'Male' if p_gender < 0.51 else 'Female'
                elif phc_id == 'PHC_3':
                    gender = 'Male' if p_gender < 0.52 else 'Female'
                elif phc_id == 'PHC_4':
                    gender = 'Male' if p_gender < 0.50 else 'Female'
                else: # PHC_5
                    gender = 'Male' if p_gender < 0.51 else 'Female'
                
                # Clinical parameters based on diagnosis
                if disease == 'Healthy':
                    fever = 1 if random.random() < 0.05 else 0
                    cough = 1 if random.random() < 0.05 else 0
                    fatigue = 1 if random.random() < 0.05 else 0
                    headache = 1 if random.random() < 0.05 else 0
                    vomiting = 1 if random.random() < 0.01 else 0
                    breathlessness = 1 if random.random() < 0.01 else 0
                    
                    temperature_c = round(random.uniform(36.2, 37.2), 1)
                    heart_rate = int(random.uniform(60, 80))
                    bp_systolic = int(random.uniform(110, 130))
                    wbc_count = int(random.uniform(4500, 10000))
                    platelet_count = int(random.uniform(150000, 350000))
                    hemoglobin = round(random.uniform(12.0, 16.0), 1)
                    severity_level = 'Low'
                    
                elif disease == 'Dengue':
                    fever = 1 if random.random() < 0.90 else 0
                    headache = 1 if random.random() < 0.80 else 0
                    fatigue = 1 if random.random() < 0.75 else 0
                    vomiting = 1 if random.random() < 0.50 else 0
                    cough = 1 if random.random() < 0.15 else 0
                    breathlessness = 1 if random.random() < 0.10 else 0
                    
                    temperature_c = round(random.uniform(38.5, 40.5), 1)
                    heart_rate = int(random.uniform(80, 115))
                    bp_systolic = int(random.uniform(90, 115))
                    wbc_count = int(random.uniform(2000, 4500))
                    platelet_count = int(random.uniform(30000, 120000))
                    hemoglobin = round(random.uniform(11.0, 15.5), 1)
                    
                    p_sev = random.random()
                    severity_level = 'High' if p_sev < 0.40 else ('Medium' if p_sev < 0.80 else 'Low')
                    
                elif disease == 'Malaria':
                    fever = 1 if random.random() < 0.95 else 0
                    fatigue = 1 if random.random() < 0.80 else 0
                    headache = 1 if random.random() < 0.70 else 0
                    vomiting = 1 if random.random() < 0.45 else 0
                    cough = 1 if random.random() < 0.20 else 0
                    breathlessness = 1 if random.random() < 0.15 else 0
                    
                    temperature_c = round(random.uniform(38.2, 40.8), 1)
                    heart_rate = int(random.uniform(85, 120))
                    bp_systolic = int(random.uniform(90, 120))
                    if phc_id == 'PHC_5':
                        wbc_count = int(random.uniform(2000, 4400))  # critical abnormal WBC
                    else:
                        wbc_count = int(random.uniform(3500, 8000))
                    platelet_count = int(random.uniform(60000, 140000))
                    hemoglobin = round(random.uniform(8.5, 12.0), 1)
                    
                    p_sev = random.random()
                    if phc_id == 'PHC_5':
                        severity_level = 'High' if p_sev < 0.90 else ('Medium' if p_sev < 0.98 else 'Low')
                    else:
                        severity_level = 'High' if p_sev < 0.45 else ('Medium' if p_sev < 0.85 else 'Low')
                    
                elif disease == 'Pneumonia':
                    cough = 1 if random.random() < 0.95 else 0
                    breathlessness = 1 if random.random() < 0.90 else 0
                    fever = 1 if random.random() < 0.85 else 0
                    fatigue = 1 if random.random() < 0.80 else 0
                    headache = 1 if random.random() < 0.30 else 0
                    vomiting = 1 if random.random() < 0.20 else 0
                    
                    temperature_c = round(random.uniform(37.5, 40.0), 1)
                    heart_rate = int(random.uniform(90, 125))
                    bp_systolic = int(random.uniform(100, 140))
                    wbc_count = int(random.uniform(11000, 19000))
                    platelet_count = int(random.uniform(150000, 380000))
                    hemoglobin = round(random.uniform(10.0, 14.0), 1)
                    
                    p_sev = random.random()
                    severity_level = 'High' if p_sev < 0.50 else ('Medium' if p_sev < 0.85 else 'Low')
                    
                elif disease == 'Typhoid':
                    fever = 1 if random.random() < 0.90 else 0
                    fatigue = 1 if random.random() < 0.85 else 0
                    headache = 1 if random.random() < 0.75 else 0
                    vomiting = 1 if random.random() < 0.40 else 0
                    cough = 1 if random.random() < 0.25 else 0
                    breathlessness = 1 if random.random() < 0.10 else 0
                    
                    temperature_c = round(random.uniform(38.8, 40.5), 1)
                    heart_rate = int(random.uniform(70, 95))
                    bp_systolic = int(random.uniform(90, 120))
                    wbc_count = int(random.uniform(3000, 6000))
                    platelet_count = int(random.uniform(100000, 180000))
                    hemoglobin = round(random.uniform(10.5, 14.5), 1)
                    
                    p_sev = random.random()
                    severity_level = 'High' if p_sev < 0.35 else ('Medium' if p_sev < 0.80 else 'Low')
                    
                else: # Viral Fever
                    fever = 1 if random.random() < 0.90 else 0
                    fatigue = 1 if random.random() < 0.80 else 0
                    headache = 1 if random.random() < 0.65 else 0
                    cough = 1 if random.random() < 0.40 else 0
                    vomiting = 1 if random.random() < 0.20 else 0
                    breathlessness = 1 if random.random() < 0.10 else 0
                    
                    temperature_c = round(random.uniform(37.8, 39.8), 1)
                    heart_rate = int(random.uniform(80, 110))
                    bp_systolic = int(random.uniform(100, 130))
                    wbc_count = int(random.uniform(5000, 11000))
                    platelet_count = int(random.uniform(130000, 220000))
                    hemoglobin = round(random.uniform(12.0, 15.0), 1)
                    
                    p_sev = random.random()
                    severity_level = 'Medium' if p_sev < 0.55 else ('Low' if p_sev < 0.90 else 'High')
                
                # Dynamic override to guarantee critical outbreak for PHC_5
                if phc_id == 'PHC_5' and disease != 'Healthy':
                    fever = 1 if random.random() < 0.98 else 0
                    wbc_count = int(random.uniform(2000, 4400)) if random.random() < 0.95 else int(random.uniform(11500, 15000))
                
                patient_id = f"P{patient_id_counter:05d}"
                patient_id_counter += 1
                
                p = Patient(
                    patient_id=patient_id,
                    age=age,
                    gender=gender,
                    phc_id=phc_id,
                    city=city,
                    fever=fever,
                    cough=cough,
                    fatigue=fatigue,
                    headache=headache,
                    vomiting=vomiting,
                    breathlessness=breathlessness,
                    temperature_c=temperature_c,
                    heart_rate=heart_rate,
                    bp_systolic=bp_systolic,
                    wbc_count=wbc_count,
                    platelet_count=platelet_count,
                    hemoglobin=hemoglobin,
                    disease_label=disease,
                    severity_level=severity_level,
                    created_at=created_at
                )
                patients_to_create.append(p)

        # 4. Insert Patients in Two Stages (Baseline and then Outbreak)
        baseline_patients = [p for p in patients_to_create if p.created_at <= now - timedelta(days=14)]
        outbreak_patients = [p for p in patients_to_create if p.created_at > now - timedelta(days=14)]
        
        self.stdout.write(f"Inserting {len(baseline_patients)} baseline patients...")
        Patient.objects.insert(baseline_patients)
        
        self.stdout.write("Running local training [Version 1] for all PHCs...")
        for phc_id in phc_cities.keys():
            train_federated_model(phc_id)
            
        self.stdout.write(f"Inserting {len(outbreak_patients)} outbreak patients...")
        Patient.objects.insert(outbreak_patients)
        
        self.stdout.write("Running local training [Version 2] for all PHCs...")
        for phc_id in phc_cities.keys():
            train_federated_model(phc_id)
        
        self.stdout.write(self.style.SUCCESS("All local models successfully trained (Versions 1 and 2)."))

        # 5. Orchestrate Federated Round 1
        self.stdout.write(self.style.WARNING("Orchestrating Federated Learning Round 1..."))
        perform_federated_round(1, list(phc_cities.keys()))
        self.stdout.write(self.style.SUCCESS("Federated Round 1 completed and aggregated successfully."))

        # 6. Execute Risk Score calculations
        self.stdout.write(self.style.WARNING("Calculating PHC, City, and District Risk Scores..."))
        calculate_district_risk_score('Coimbatore')
        self.stdout.write(self.style.SUCCESS("Risk Scores successfully computed."))

        # 7. Execute Surveillance alerts engine
        self.stdout.write(self.style.WARNING("Executing surveillance engine and fever outbreak checks..."))
        run_surveillance_detection()
        
        # Introduce a mixture of statuses for demonstration
        alerts = list(HealthAlert.objects.all())
        self.stdout.write(f"Generated {len(alerts)} surveillance alerts. Applying status mixture...")
        for idx, alert in enumerate(alerts):
            if idx % 3 == 1:
                alert.status = 'ACKNOWLEDGED'
                alert.acknowledged_at = datetime.utcnow()
            elif idx % 3 == 2:
                alert.status = 'RESOLVED'
                alert.resolved_at = datetime.utcnow()
            alert.save()
        self.stdout.write(self.style.SUCCESS("Surveillance alerts successfully processed and status-mixed."))

        # 8. Execute Non-IID heterogeneity analysis
        self.stdout.write(self.style.WARNING("Executing Non-IID heterogeneity analysis..."))
        run_non_iid_analysis()
        self.stdout.write(self.style.SUCCESS("Non-IID divergence metrics successfully calculated."))

        # 9. Generate historical cohort snapshots
        self.stdout.write(self.style.WARNING("Generating cohort snapshots history..."))
        for phc_id in phc_cities.keys():
            for offset_days in [75, 60, 45, 30, 15, 0]:
                snap_date = now - timedelta(days=offset_days)
                create_snapshot_at_date(phc_id, snap_date)
        self.stdout.write(self.style.SUCCESS("Historical cohort snapshots successfully generated."))

        self.stdout.write("="*70)
        self.stdout.write(self.style.SUCCESS("FEDHEALTH AI DEMO DATA SEED COMPLETE!"))
