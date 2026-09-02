import json
import re
from mongoengine import Document, StringField, IntField, FloatField, ListField, DictField, DateTimeField, BooleanField, ReferenceField
from mongoengine.errors import ValidationError
from datetime import datetime

# ============================================
# STRUCTURED MONGODB SCHEMA FOR FEDERATED SYSTEM
# ============================================

class User(Document):
    """User accounts with role-based access control"""
    username = StringField(required=True, unique=True)
    password_hash = StringField(required=True)
    role = StringField(
        required=True,
        choices=['PHC_USER', 'DISTRICT_ADMIN', 'SURVEILLANCE_OFFICER'],
        default='PHC_USER'
    )
    phc_id = StringField()  # Nullable, only for PHC_USER
    created_at = DateTimeField(default=datetime.utcnow)

    meta = {
        'collection': 'users',
        'indexes': ['username', 'phc_id']
    }
    
    @property
    def is_authenticated(self):
        return True
    
    @property
    def is_active(self):
        return True
    
    @property
    def is_staff(self):
        return self.role in ['DISTRICT_ADMIN']
    
    @property
    def is_superuser(self):
        return self.role == 'DISTRICT_ADMIN'
    
    def get_username(self):
        return self.username


class PHC(Document):
    """Primary Health Centers - organizational unit with city hierarchy"""
    name = StringField(required=True)
    district_id = StringField(required=True)
    city = StringField(required=True)  # City name (e.g., Pollachi, Thondamuthur, Kinathukadavu)
    
    # Geographic surveillance and contact details
    phc_name = StringField(default=None, null=True)
    latitude = FloatField(default=None, null=True)
    longitude = FloatField(default=None, null=True)
    email = StringField(default=None, null=True)
    
    created_at = DateTimeField(default=datetime.utcnow)
    updated_at = DateTimeField(default=datetime.utcnow)

    meta = {
        'collection': 'phcs',
        'indexes': ['district_id', 'name', 'city', ('city', 'district_id')]
    }

    def clean(self):
        # Latitude range: -90 to 90
        if self.latitude is not None:
            try:
                lat = float(self.latitude)
            except (ValueError, TypeError):
                raise ValidationError("Latitude must be a numeric value.")
            if not (-90.0 <= lat <= 90.0):
                raise ValidationError("Latitude must be between -90 and 90.")
            self.latitude = lat

        # Longitude range: -180 to 180
        if self.longitude is not None:
            try:
                lon = float(self.longitude)
            except (ValueError, TypeError):
                raise ValidationError("Longitude must be a numeric value.")
            if not (-180.0 <= lon <= 180.0):
                raise ValidationError("Longitude must be between -180 and 180.")
            self.longitude = lon

        # Email format and uniqueness check
        if self.email is not None:
            if not isinstance(self.email, str):
                raise ValidationError("Email must be a string.")
            normalized_email = self.email.strip().lower()
            if normalized_email == "":
                self.email = None
            else:
                self.email = normalized_email
                email_regex = r"(^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$)"
                if not re.match(email_regex, self.email):
                    raise ValidationError("Invalid email address format.")
                # Ensure unique email (excluding self)
                existing = PHC.objects(email=self.email, name__ne=self.name).first()
                if existing:
                    raise ValidationError("Email address must be unique across all PHCs.")

    def save(self, *args, **kwargs):
        self.clean()
        self.updated_at = datetime.utcnow()
        return super(PHC, self).save(*args, **kwargs)


class Patient(Document):
    """Patient records from ABDM synthetic dataset with city hierarchy"""
    patient_id = StringField(required=True, unique=True)  # e.g., P00001
    age = IntField(required=True)  # 0-100
    gender = StringField(required=True)  # Male, Female, Other
    phc_id = StringField(required=True)  # PHC_1, PHC_2, ..., PHC_5
    city = StringField(required=True)  # City name (derived from phc_id)
    
    # Clinical Symptoms (binary: 0 or 1)
    fever = IntField(required=True, default=0)
    cough = IntField(required=True, default=0)
    fatigue = IntField(required=True, default=0)
    headache = IntField(required=True, default=0)
    vomiting = IntField(required=True, default=0)
    breathlessness = IntField(required=True, default=0)
    
    # Vital Signs (continuous)
    temperature_c = FloatField(required=True)  # Celsius, e.g., 37.1-40.0
    heart_rate = IntField(required=True)  # BPM, e.g., 60-100
    bp_systolic = IntField(required=True)  # mmHg, e.g., 90-180
    
    # Lab Values (continuous)
    wbc_count = IntField(required=True)  # cells/µL, e.g., 4000-15000
    platelet_count = IntField(required=True)  # cells/µL, e.g., 100000-400000
    hemoglobin = FloatField(required=True)  # g/dL, e.g., 10-16
    
    # Diagnosis Outcome
    disease_label = StringField(required=True)  # e.g., Healthy, Viral Fever, Dengue, Malaria, Typhoid, Pneumonia
    severity_level = StringField(required=True)  # Low, Medium, High
    
    created_at = DateTimeField(default=datetime.utcnow)

    meta = {
        'collection': 'patients',
        'indexes': [
            'phc_id', 
            'city',
            'disease_label',
            'patient_id',
            'created_at', 
            ('phc_id', 'created_at'),
            ('city', 'created_at'),
            ('phc_id', 'disease_label'),
            ('city', 'disease_label'),
            'disease_label'
        ]
    }


class TrainingMetadata(Document):
    """Track federated training cycles for each PHC"""
    phc_id = StringField(required=True, unique=True)
    last_training_at = DateTimeField()
    patients_since_last_training = IntField(default=0)
    last_aggregated_version = IntField(default=0)
    training_in_progress = BooleanField(default=False)  # HACKATHON FIX: Prevent duplicate training
    updated_at = DateTimeField(default=datetime.utcnow)
    
    meta = {
        'collection': 'training_metadata',
        'indexes': ['phc_id']
    }


class LocalModel(Document):
    """Local federated models trained at each PHC"""
    phc_id = StringField(required=True)
    version = IntField(required=True)  # Numeric version per PHC (1, 2, 3...)
    version_string = StringField(required=True, unique=True)  # e.g., "local_PHC_1_v1"
    accuracy = FloatField(required=True)
    precision = FloatField(default=0.0)
    recall = FloatField(default=0.0)
    f1_score = FloatField(default=0.0)
    roc_auc = FloatField(default=None)
    confusion_matrix = ListField(default=[])
    sample_count = IntField(default=0)
    num_test_samples = IntField(default=0)
    num_train_samples = IntField(default=0)
    weights = DictField(required=True)
    trained_at = DateTimeField(default=datetime.utcnow)
    triggered_by = StringField(default='unknown')  # 'patient_threshold' or 'time_threshold' or 'manual'
    aggregated = BooleanField(default=False)
    aggregated_in_version = IntField(default=None)
    aggregated_in_version_string = StringField(default=None)  # e.g., "global_v3"

    meta = {
        'collection': 'local_models',
        'indexes': [
            'phc_id', 'version', 'trained_at', 'version_string',
            ('phc_id', '-trained_at'),
            ('phc_id', '-version'),
            'aggregated'
        ]
    }


class GlobalModel(Document):
    """
    Global model placeholder for future federated averaging (FedAvg).
    Currently, the system runs local training only, and no parameters/weights
    are aggregated. When FedAvg is implemented, this document will store
    the actual aggregated global model weights.
    """
    version = IntField(required=True, unique=True)
    version_string = StringField(required=True, unique=True)  # e.g., "global_v1", "global_v2"
    accuracy = FloatField(required=True)
    contributors = ListField(StringField())  # List of phc_ids that contributed
    contributor_versions = DictField(default={})  # Map of phc_id -> local_version_string they contributed
    aggregated_at = DateTimeField(default=datetime.utcnow)
    weights = DictField(required=True)
    aggregation_triggered_by = StringField(default='unknown')  # 'automatic' or 'manual'

    meta = {
        'collection': 'global_models',
        'indexes': [
            'version',
            'version_string',
            'aggregated_at',
            '-aggregated_at',
            '-version'
        ]
    }



class RiskScore(Document):
    """City and district level risk scores computed from PHC data"""
    phc_id = StringField()  # For PHC-level scores
    city = StringField()  # For city-level scores
    district_id = StringField(required=True)
    
    # Risk Score Components
    phc_risk_score = FloatField(default=0.0)  # 0-1 scale
    city_risk_score = FloatField(default=0.0)  # 0-1 scale
    district_risk_score = FloatField(default=0.0)  # 0-1 scale
    
    # Risk Calculation Details
    high_severity_percentage = FloatField(default=0.0)  # % of high severity cases
    outbreak_flag_percentage = FloatField(default=0.0)  # % flagged as outbreak risk
    disease_prevalence_percentage = FloatField(default=0.0)  # % with diagnosed diseases
    
    # Aggregation Details
    patient_count = IntField(default=0)
    evaluation_period = StringField(default='daily')  # daily, weekly, monthly
    
    computed_at = DateTimeField(default=datetime.utcnow)
    updated_at = DateTimeField(default=datetime.utcnow)

    meta = {
        'collection': 'risk_scores',
        'indexes': [
            'phc_id',
            'city',
            'district_id',
            'computed_at',
            'updated_at',
            ('city', 'computed_at'),
            ('district_id', 'computed_at'),
            ('district_id', 'updated_at')
        ]
    }


class Alert(Document):
    """Disease surveillance alerts and ML innovation insights"""
    phc_id = StringField(required=True)
    alert_type = StringField(
        required=True,
        choices=['FEVER_OUTBREAK', 'MODEL_DRIFT', 'COMPOSITE_RISK', 'ANOMALY'],
        default='FEVER_OUTBREAK'
    )
    risk_score = FloatField(required=True)
    severity = StringField(
        required=True,
        choices=['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default='MEDIUM'
    )
    created_at = DateTimeField(default=datetime.utcnow)
    local_model_version = IntField(default=0)
    local_model_version_string = StringField(default=None)  # e.g., "local_PHC_1_v2"
    global_model_version = IntField(default=0)
    global_model_version_string = StringField(default=None)  # e.g., "global_v1"
    
    # Drift Detection Fields
    drift_detected = BooleanField(default=False)
    accuracy_drop_percentage = FloatField(default=None)  # e.g., 12.5 for 12.5% drop
    previous_accuracy = FloatField(default=None)
    current_accuracy = FloatField(default=None)
    
    # Composite Risk Score Fields
    fever_percentage = FloatField(default=None)
    positive_predictions_percentage = FloatField(default=None)
    abnormal_wbc_ratio = FloatField(default=None)
    composite_score_breakdown = DictField(default={})  # {fever: 0.15, predictions: 0.12, wbc: 0.08}
    
    # Metadata
    message = StringField(default=None)
    details = DictField(default={})

    meta = {
        'collection': 'alerts',
        'indexes': [
            'phc_id',
            'alert_type',
            'created_at',
            'severity',
            'drift_detected',
            'global_model_version_string',
            ('phc_id', '-created_at'),
            ('alert_type', '-created_at'),
            ('severity', '-created_at')
        ]
    }


class HealthAlert(Document):
    """District-wide health surveillance alerts and District Admin advisories."""
    alert_type = StringField(required=True, choices=['SURVEILLANCE_ALERT', 'DISTRICT_ADVISORY'], default='SURVEILLANCE_ALERT')
    disease = StringField(default=None)
    source_phc = StringField(default=None) # PHC that triggered the alert (e.g. PHC_3)
    target_phc = StringField(required=True) # Recipient PHC (e.g. PHC_1)
    severity = StringField(required=True, choices=['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default='MEDIUM')
    current_incidence = FloatField(default=None) # e.g. 8.4
    baseline_incidence = FloatField(default=None) # e.g. 3.1
    change_percentage = FloatField(default=None) # e.g. 171.0
    message = StringField(required=True)
    recommended_action = StringField(default=None)
    created_at = DateTimeField(default=datetime.utcnow)
    acknowledged_at = DateTimeField(default=None)
    resolved_at = DateTimeField(default=None)
    status = StringField(required=True, choices=['NEW', 'ACKNOWLEDGED', 'RESOLVED'], default='NEW')
    created_by = StringField(default='system') # 'system' or username of District Admin
    detection_method = StringField(default='automatic') # 'automatic' or 'manual'

    meta = {
        'collection': 'health_alerts',
        'indexes': [
            'alert_type',
            'disease',
            'source_phc',
            'target_phc',
            'severity',
            'status',
            'created_at',
            ('target_phc', 'status', '-created_at'),
            ('disease', 'source_phc', 'target_phc', 'status')
        ]
    }


class PHCRelationship(Document):
    """Database-driven neighbor relationship configuration between PHCs."""
    source_phc = StringField(required=True) # e.g. 'PHC_1'
    target_phc = StringField(required=True) # e.g. 'PHC_2'
    distance_km = FloatField(default=10.0)  # distance in km
    active = BooleanField(default=True)

    meta = {
        'collection': 'phc_relationships',
        'indexes': [
            ('source_phc', 'target_phc'),
            'source_phc',
            'active'
        ]
    }


class CohortSnapshot(Document):
    """Historical snapshots of patient cohort metrics for trend analysis"""
    phc_id = StringField(required=True)
    snapshot_date = DateTimeField(default=datetime.utcnow)
    
    # Demographics
    total_patients = IntField(required=True)
    average_age = FloatField(required=True)
    male_percentage = FloatField(default=0.0)
    female_percentage = FloatField(default=0.0)
    
    # Symptoms (percentage of cohort)
    fever_percentage = FloatField(required=True)
    cough_percentage = FloatField(required=True)
    fatigue_percentage = FloatField(required=True)
    headache_percentage = FloatField(required=True)
    vomiting_percentage = FloatField(required=True)
    breathlessness_percentage = FloatField(required=True)
    rash_percentage = FloatField(default=0.0)
    
    # Vital Signs (averaged)
    average_temperature_c = FloatField(default=0.0)
    average_heart_rate = FloatField(default=0.0)
    average_bp_systolic = FloatField(default=0.0)
    
    # Lab Values (averaged)
    average_wbc_count = FloatField(required=True)
    average_platelet_count = FloatField(default=0.0)
    average_hemoglobin = FloatField(default=0.0)
    
    # Disease Distribution
    disease_distribution = DictField(default={})  # {disease_label: count, ...}
    high_severity_percentage = FloatField(default=0.0)
    
    created_at = DateTimeField(default=datetime.utcnow)

    meta = {
        'collection': 'cohort_snapshots',
        'indexes': [
            'phc_id',
            'snapshot_date',
            'created_at',
            ('phc_id', '-snapshot_date'),
            ('phc_id', '-created_at')
        ]
    }


# ============================================
# COMPATIBILITY WRAPPER
# ============================================

def get_phc_collection(phc_id):
    """
    Backward compatibility wrapper.
    Returns Patient class filtered by phc_id.
    """
    class PHCPatientWrapper:
        class ObjectsManager:
            def __init__(self, phc_id):
                self.phc_id = phc_id
            
            def all(self):
                return Patient.objects.filter(phc_id=self.phc_id)
            
            def create(self, **kwargs):
                kwargs['phc_id'] = self.phc_id
                return Patient.objects.create(**kwargs)
            
            def filter(self, **kwargs):
                kwargs['phc_id'] = self.phc_id
                return Patient.objects.filter(**kwargs)
        
        objects = ObjectsManager(phc_id)
    
    return PHCPatientWrapper


class FederatedRound(Document):
    """Tracks each federated learning training round."""
    round_id = IntField(required=True, unique=True)
    status = StringField(required=True, choices=['STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'], default='STARTED')
    started_at = DateTimeField(default=datetime.utcnow)
    completed_at = DateTimeField(default=None)
    participants = ListField(StringField())  # List of PHC IDs, e.g. ['PHC_1', 'PHC_2']
    global_model_version = IntField(default=None)  # GlobalModelVersion version generated
    metrics = DictField(default=dict)
    sample_count = IntField(default=0)  # Combined count across all participants

    meta = {
        'collection': 'federated_rounds',
        'indexes': [
            'round_id',
            'status',
            '-started_at'
        ]
    }


class FederatedClientUpdate(Document):
    """Local model update parameters submitted by a PHC client for a federated round."""
    round_id = IntField(required=True)
    phc_id = StringField(required=True)
    sample_count = IntField(required=True)
    local_model_version = IntField(required=True)
    parameters = DictField(required=True)  # Key-value weights dictionary
    metrics = DictField(default=dict)      # Local evaluation metrics
    created_at = DateTimeField(default=datetime.utcnow)

    meta = {
        'collection': 'federated_client_updates',
        'indexes': [
            'round_id',
            'phc_id',
            '-created_at',
            ('round_id', 'phc_id')
        ]
    }


class GlobalModelVersion(Document):
    """Archived/versioned snapshot of the global model parameters and metrics."""
    version = IntField(required=True, unique=True)
    version_string = StringField(required=True, unique=True)  # e.g., "global_v1"
    round_id = IntField(required=True)
    accuracy = FloatField(required=True)
    precision = FloatField(default=0.0)
    recall = FloatField(default=0.0)
    f1_score = FloatField(default=0.0)
    contributors = ListField(StringField())  # PHC IDs that participated
    contributor_versions = DictField(default={})  # phc_id -> version string
    parameters = DictField(required=True)  # Global parameter weights
    created_at = DateTimeField(default=datetime.utcnow)

    meta = {
        'collection': 'global_model_versions',
        'indexes': [
            'version',
            'version_string',
            'round_id',
            '-created_at'
        ]
    }


class ModelEvaluationResult(Document):
    """Validation/test set metrics for local or global models evaluated at a PHC."""
    model_type = StringField(required=True, choices=['LOCAL', 'GLOBAL'])
    model_version_string = StringField(required=True)  # e.g. local_PHC_1_v1 or global_v1
    phc_id = StringField(required=True)  # PHC where evaluation was run
    evaluated_at = DateTimeField(default=datetime.utcnow)
    accuracy = FloatField(required=True)
    precision = FloatField(default=0.0)
    recall = FloatField(default=0.0)
    f1_score = FloatField(default=0.0)
    roc_auc = FloatField(default=None)
    confusion_matrix = ListField(default=[])
    classification_report = DictField(default=dict)
    sample_count = IntField(required=True)

    meta = {
        'collection': 'model_evaluation_results',
        'indexes': [
            'model_type',
            'model_version_string',
            'phc_id',
            '-evaluated_at'
        ]
    }


class NonIIDAnalysisResult(Document):
    """Stores quantitative analysis of Non-IID statistical heterogeneity across PHCs."""
    analysis_version = IntField(required=True, unique=True)
    created_at = DateTimeField(default=datetime.utcnow)
    phc_metrics = DictField(default=dict)
    global_divergences = DictField(default=dict)
    pairwise_divergences = DictField(default=dict)

    meta = {
        'collection': 'non_iid_analysis_results',
        'indexes': [
            'analysis_version',
            '-created_at'
        ]
    }


class NotificationLog(Document):
    """Tracks sent notifications to prevent duplicate EmailJS alerts"""
    alert_id = StringField(required=True)
    recipient_phc_id = StringField(required=True)
    recipient_email = StringField(required=True)
    sent_at = DateTimeField(default=datetime.utcnow)
    status = StringField(required=True, choices=['SENT', 'FAILED', 'PENDING'], default='PENDING')
    notification_type = StringField(default='automatic')  # 'automatic' or 'manual'
    error_message = StringField(default=None)

    meta = {
        'collection': 'notification_logs',
        'indexes': [
            ('alert_id', 'recipient_phc_id'),
            'status',
            'sent_at'
        ]
    }

