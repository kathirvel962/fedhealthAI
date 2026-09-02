from rest_framework import serializers
from api.models import User, GlobalModel, FederatedRound, FederatedClientUpdate, GlobalModelVersion, ModelEvaluationResult

class UserSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    role = serializers.CharField()
    phc_id = serializers.CharField(required=False)
    password = serializers.CharField(write_only=True)

class PatientDataSerializer(serializers.Serializer):
    # Demographics
    age = serializers.IntegerField()
    gender = serializers.CharField()
    
    # Symptoms (binary 0/1)
    fever = serializers.IntegerField()
    cough = serializers.IntegerField()
    fatigue = serializers.IntegerField()
    headache = serializers.IntegerField()
    vomiting = serializers.IntegerField()
    breathlessness = serializers.IntegerField()
    
    # Vital Signs
    temperature_c = serializers.FloatField()
    heart_rate = serializers.IntegerField()
    bp_systolic = serializers.IntegerField()
    
    # Lab Values
    wbc_count = serializers.IntegerField()
    platelet_count = serializers.IntegerField()
    hemoglobin = serializers.FloatField()
    
    # Diagnosis
    disease_label = serializers.CharField()
    severity_level = serializers.CharField()

class ModelUpdateSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    phc_id = serializers.CharField()
    model_weights = serializers.JSONField()
    accuracy = serializers.FloatField()
    num_samples = serializers.IntegerField()
    timestamp = serializers.DateTimeField()

class GlobalModelSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    aggregated_weights = serializers.JSONField()
    aggregated_accuracy = serializers.FloatField()
    num_contributors = serializers.IntegerField()
    total_samples = serializers.IntegerField()
    timestamp = serializers.DateTimeField()
class SurveillanceAlertSerializer(serializers.Serializer):
    alert_id = serializers.CharField(read_only=True)
    alert_type = serializers.CharField()
    phc_id = serializers.CharField()
    severity = serializers.CharField()
    message = serializers.CharField()
    timestamp = serializers.DateTimeField()

class ZoneRiskSerializer(serializers.Serializer):
    phc_id = serializers.CharField()
    zone_name = serializers.CharField()
    risk_score = serializers.FloatField()
    total_patients = serializers.IntegerField()
    fever_cases = serializers.IntegerField()
    color_code = serializers.CharField()

class TemporalTrendSerializer(serializers.Serializer):
    period = serializers.CharField()
    cases_7day = serializers.IntegerField()
    cases_30day = serializers.IntegerField()
    growth_percentage = serializers.FloatField()
    trend_direction = serializers.CharField()

class FederatedModelStatusSerializer(serializers.Serializer):
    global_accuracy = serializers.FloatField()
    participating_phcs = serializers.IntegerField()
    total_samples = serializers.IntegerField()
    last_aggregation = serializers.DateTimeField()
    model_type = serializers.CharField()
    encryption_enabled = serializers.BooleanField()

class DiseaseClusterSerializer(serializers.Serializer):
    cluster_id = serializers.CharField(read_only=True)
    zone = serializers.CharField()
    disease = serializers.CharField()
    case_count = serializers.IntegerField()
    alert_status = serializers.CharField()

class AntibioticResistanceSerializer(serializers.Serializer):
    resistance_metric = serializers.FloatField()
    increase_percentage = serializers.FloatField()
    top_resistant_pathogens = serializers.ListField(child=serializers.CharField())
    last_updated = serializers.DateTimeField()


class FederatedRoundSerializer(serializers.Serializer):
    round_id = serializers.IntegerField()
    status = serializers.CharField()
    started_at = serializers.DateTimeField(read_only=True)
    completed_at = serializers.DateTimeField(read_only=True, allow_null=True)
    participants = serializers.ListField(child=serializers.CharField())
    global_model_version = serializers.IntegerField(required=False, allow_null=True)
    metrics = serializers.JSONField(required=False)
    sample_count = serializers.IntegerField(required=False)


class FederatedClientUpdateSerializer(serializers.Serializer):
    round_id = serializers.IntegerField()
    phc_id = serializers.CharField()
    sample_count = serializers.IntegerField()
    local_model_version = serializers.IntegerField()
    parameters = serializers.JSONField()
    metrics = serializers.JSONField(required=False)
    created_at = serializers.DateTimeField(read_only=True)


class GlobalModelVersionSerializer(serializers.Serializer):
    version = serializers.IntegerField()
    version_string = serializers.CharField()
    round_id = serializers.IntegerField()
    accuracy = serializers.FloatField()
    precision = serializers.FloatField()
    recall = serializers.FloatField()
    f1_score = serializers.FloatField()
    contributors = serializers.ListField(child=serializers.CharField())
    contributor_versions = serializers.JSONField()
    parameters = serializers.JSONField()
    created_at = serializers.DateTimeField(read_only=True)


class ModelEvaluationResultSerializer(serializers.Serializer):
    model_type = serializers.CharField()
    model_version_string = serializers.CharField()
    phc_id = serializers.CharField()
    evaluated_at = serializers.DateTimeField(read_only=True)
    accuracy = serializers.FloatField()
    precision = serializers.FloatField()
    recall = serializers.FloatField()
    f1_score = serializers.FloatField()
    roc_auc = serializers.FloatField(required=False, allow_null=True)
    confusion_matrix = serializers.ListField(child=serializers.ListField(child=serializers.IntegerField()))
    classification_report = serializers.JSONField()
    sample_count = serializers.IntegerField()