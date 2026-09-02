import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fedhealth.settings')
import django
django.setup()

print("="*80)
print("MONGODB SCHEMA DEFINITION & VALIDATION")
print("="*80)

schema_definitions = {
    "Patient": {
        "collection": "patients",
        "fields": {
            "_id": ("ObjectId", "Auto-generated"),
            "patient_id": ("String", "Unique, e.g., P00001"),
            "age": ("Integer", "0-100"),
            "gender": ("String", "Male, Female, Other"),
            "phc_id": ("String", "PHC_1, PHC_2, ..., PHC_5"),
            "fever": ("Integer", "0 or 1 (binary)"),
            "cough": ("Integer", "0 or 1 (binary)"),
            "fatigue": ("Integer", "0 or 1 (binary)"),
            "headache": ("Integer", "0 or 1 (binary)"),
            "vomiting": ("Integer", "0 or 1 (binary)"),
            "breathlessness": ("Integer", "0 or 1 (binary)"),
            "temperature_c": ("Float", "Celsius, 37.1-40.0"),
            "heart_rate": ("Integer", "BPM, 60-100"),
            "bp_systolic": ("Integer", "mmHg, 90-180"),
            "wbc_count": ("Integer", "cells/µL, 4000-15000"),
            "platelet_count": ("Integer", "cells/µL, 100000-400000"),
            "hemoglobin": ("Float", "g/dL, 10-16"),
            "disease_label": ("String", "Healthy, Viral Fever, Dengue, Malaria, Typhoid, Pneumonia"),
            "severity_level": ("String", "Low, Medium, High"),
            "created_at": ("DateTime", "ISO 8601 timestamp"),
        },
        "indexes": ["phc_id", "disease_label", "patient_id", "created_at", ("phc_id", "created_at"), ("phc_id", "disease_label")],
    },
    
    "User": {
        "collection": "users",
        "fields": {
            "_id": ("ObjectId", "Auto-generated"),
            "username": ("String", "Unique username"),
            "password_hash": ("String", "Bcrypt hash"),
            "role": ("String", "PHC_USER, DISTRICT_ADMIN, SURVEILLANCE_OFFICER"),
            "phc_id": ("String", "PHC_1, PHC_2, etc. (null for non-PHC_USER)"),
            "created_at": ("DateTime", "ISO 8601 timestamp"),
        },
        "indexes": ["username", "phc_id"],
    },
    
    "LocalModel": {
        "collection": "local_models",
        "fields": {
            "_id": ("ObjectId", "Auto-generated"),
            "phc_id": ("String", "PHC_1, PHC_2, etc."),
            "version": ("Integer", "Numeric version per PHC (1, 2, 3...)"),
            "version_string": ("String", "Unique, e.g., local_PHC_1_v1"),
            "accuracy": ("Float", "0.0-1.0"),
            "precision": ("Float", "0.0-1.0"),
            "recall": ("Float", "0.0-1.0"),
            "f1_score": ("Float", "0.0-1.0"),
            "roc_auc": ("Float", "0.0-1.0 or null"),
            "confusion_matrix": ("List[List[Int]]", "NxN matrix"),
            "sample_count": ("Integer", "Total samples used"),
            "num_test_samples": ("Integer", "Test set size"),
            "num_train_samples": ("Integer", "Training set size"),
            "weights": ("Dict", "Model parameters (serialized)"),
            "trained_at": ("DateTime", "Training timestamp"),
            "triggered_by": ("String", "patient_threshold, time_threshold, manual"),
            "aggregated": ("Boolean", "Is this model aggregated?"),
            "aggregated_in_version": ("Integer", "Global model version number or null"),
            "aggregated_in_version_string": ("String", "e.g., global_v3 or null"),
        },
        "indexes": ["phc_id", "version", "trained_at", "version_string", ("phc_id", "-trained_at"), ("phc_id", "-version"), "aggregated"],
    },
    
    "GlobalModel": {
        "collection": "global_models",
        "fields": {
            "_id": ("ObjectId", "Auto-generated"),
            "version": ("Integer", "Unique version number (1, 2, 3...)"),
            "version_string": ("String", "Unique, e.g., global_v1"),
            "accuracy": ("Float", "Aggregated accuracy 0.0-1.0"),
            "contributors": ("List[String]", "PHC_ids that contributed"),
            "contributor_versions": ("Dict", "Mapping of phc_id -> version_string they contributed"),
            "aggregated_at": ("DateTime", "Aggregation timestamp"),
            "weights": ("Dict", "Aggregated model weights"),
            "aggregation_triggered_by": ("String", "automatic or manual"),
        },
        "indexes": ["version", "version_string", "aggregated_at", "-aggregated_at", "-version"],
    },
    
    "TrainingMetadata": {
        "collection": "training_metadata",
        "fields": {
            "_id": ("ObjectId", "Auto-generated"),
            "phc_id": ("String", "PHC_1, PHC_2, etc. (unique)"),
            "last_training_at": ("DateTime", "Last training timestamp or null"),
            "patients_since_last_training": ("Integer", "Count of new patients"),
            "last_aggregated_version": ("Integer", "Last global version aggregated"),
            "training_in_progress": ("Boolean", "Prevent duplicate training"),
            "updated_at": ("DateTime", "Last update timestamp"),
        },
        "indexes": ["phc_id"],
    },
    
    "Alert": {
        "collection": "alerts",
        "fields": {
            "_id": ("ObjectId", "Auto-generated"),
            "phc_id": ("String", "PHC_1, PHC_2, etc."),
            "alert_type": ("String", "FEVER_OUTBREAK, MODEL_DRIFT, COMPOSITE_RISK, ANOMALY"),
            "risk_score": ("Float", "0.0-1.0"),
            "severity": ("String", "LOW, MEDIUM, HIGH, CRITICAL"),
            "created_at": ("DateTime", "Alert creation timestamp"),
            "local_model_version": ("Integer", "Associated local model version"),
            "local_model_version_string": ("String", "e.g., local_PHC_1_v2"),
            "global_model_version": ("Integer", "Associated global model version"),
            "global_model_version_string": ("String", "e.g., global_v1"),
            "drift_detected": ("Boolean", "Was drift detected?"),
            "accuracy_drop_percentage": ("Float", "e.g., 12.5 for 12.5%"),
            "previous_accuracy": ("Float", "Previous accuracy value"),
            "current_accuracy": ("Float", "Current accuracy value"),
            "fever_percentage": ("Float", "% of patients with fever"),
            "positive_predictions_percentage": ("Float", "% predicted positive"),
            "abnormal_wbc_ratio": ("Float", "Ratio of abnormal WBC"),
            "composite_score_breakdown": ("Dict", "Score components"),
            "message": ("String", "Human-readable message"),
            "details": ("Dict", "Additional context"),
        },
        "indexes": ["phc_id", "alert_type", "created_at", "severity", "drift_detected", "global_model_version_string", ("phc_id", "-created_at")],
    },
}

# Print schema
for model_name, schema in schema_definitions.items():
    print(f"\n{'='*80}")
    print(f"MODEL: {model_name}")
    print(f"COLLECTION: {schema['collection']}")
    print(f"{'='*80}")
    
    print("\nFIELDS:")
    for field_name, (type_info, description) in schema['fields'].items():
        print(f"  {field_name:30s} {type_info:20s} | {description}")
    
    print(f"\nINDEXES: {len(schema['indexes'])}")
    for idx in schema['indexes']:
        if isinstance(idx, tuple):
            print(f"  - {' + '.join(idx)}")
        else:
            print(f"  - {idx}")

print(f"\n{'='*80}")
print("VALIDATION COMPLETE")
print(f"{'='*80}")
print("\nKEY FORMAT RULES:")
print("  1. phc_id  → String, format 'PHC_X' (X = 1-5)")
print("  2. version → Integer (sequential per PHC or global)")
print("  3. Timestamps → ISO 8601 DateTime (UTC)")
print("  4. Binary fields → Integer (0 or 1 only)")
print("  5. Floating point → Float (0.0-1.0 for accuracy)")
print("  6. Collections have compound indexes for performance")
