"""
Django management command for periodic federated training cycle.

Usage:
    python manage.py federated_training_cycle [--aggressive]

Options:
    --aggressive: Train all PHCs regardless of thresholds (once per 24h max)
"""

from django.core.management.base import BaseCommand
from api.models import Patient, LocalModel
from api.ml_utils import (
    should_trigger_local_training,
    train_federated_model,
    get_latest_global_model
)
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Run federated training cycle for all PHCs with proper versioning'

    def add_arguments(self, parser):
        parser.add_argument(
            '--aggressive',
            action='store_true',
            help='Train all PHCs with sufficient data',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting federated training cycle...'))
        self.stdout.write("="*70)
        
        from api.models import PHC
        phcs = PHC.objects.all()
        if phcs:
            phc_ids = [phc.name for phc in phcs]
        else:
            phc_ids = ['PHC_1', 'PHC_2', 'PHC_3', 'PHC_4', 'PHC_5']
        trained_phcs = []
        
        # PHASE 1: LOCAL TRAINING
        self.stdout.write(self.style.WARNING('\n[PHASE 1] LOCAL TRAINING'))
        self.stdout.write("-"*70)
        
        for phc_id in phc_ids:
            should_train, trigger_reason = should_trigger_local_training(phc_id)
            patient_count = Patient.objects.filter(phc_id=phc_id).count()
            
            self.stdout.write(f"\n{phc_id}:")
            self.stdout.write(f"  • Patients: {patient_count}")
            self.stdout.write(f"  • Should train: {should_train} ({trigger_reason})")
            
            if should_train:
                self.stdout.write(self.style.WARNING(f"  → Training..."))
                result = train_federated_model(phc_id, trigger_reason=trigger_reason)
                
                if result.get('error'):
                    self.stdout.write(self.style.ERROR(f"    ✗ Error: {result['error']}"))
                else:
                    self.stdout.write(self.style.SUCCESS(
                        f"    ✓ {result['version_string']} (Accuracy: {result['accuracy']:.4f})"
                    ))
                    trained_phcs.append({
                        'phc_id': phc_id,
                        'version_string': result['version_string'],
                        'accuracy': result['accuracy'],
                        'ml_insights': result.get('ml_insights', {})
                    })
                    
                    # Show ML insights
                    ml_insights = result.get('ml_insights', {})
                    if ml_insights:
                        self.stdout.write(self.style.WARNING("  📊 ML Innovation Metrics:"))
                        
                        # Drift detection
                        drift = ml_insights.get('drift_detection', {})
                        if drift and not drift.get('error'):
                            if drift.get('drift_detected'):
                                self.stdout.write(
                                    self.style.ERROR(
                                        f"    ⚠️  MODEL DRIFT: {drift.get('accuracy_drop_percentage', 0):.1f}% accuracy drop"
                                    )
                                )
                                self.stdout.write(
                                    f"       Previous: {drift.get('previous_accuracy', 0):.4f} → Current: {drift.get('current_accuracy', 0):.4f}"
                                )
                            else:
                                self.stdout.write(
                                    self.style.SUCCESS("    ✓ No model drift detected")
                                )
                        
                        # Risk score
                        risk = ml_insights.get('composite_risk_score', {})
                        if risk and not risk.get('error'):
                            severity = risk.get('severity', 'UNKNOWN')
                            severity_style = {
                                'HIGH': self.style.ERROR,
                                'MEDIUM': self.style.WARNING,
                                'LOW': self.style.SUCCESS,
                            }.get(severity, self.style.WARNING)
                            
                            self.stdout.write(
                                severity_style(
                                    f"    🔴 RISK SCORE: {risk.get('risk_score', 0):.1f}/100 [{severity}]"
                                )
                            )
                            self.stdout.write(
                                f"       Fever: {risk.get('fever_percentage', 0):.1f}% | "
                                f"Predictions: {risk.get('positive_predictions_percentage', 0):.1f}% | "
                                f"WBC Abnormal: {risk.get('abnormal_wbc_ratio', 0):.1f}%"
                            )
        
        # PHASE 2: GLOBAL AGGREGATION (Enabled)
        self.stdout.write(self.style.WARNING('\n[PHASE 2] GLOBAL AGGREGATION (Enabled)'))
        self.stdout.write("-"*70)
        
        from api.models import FederatedRound
        from api.ml_utils import perform_federated_round
        
        latest_round = FederatedRound.objects.order_by('-round_id').first()
        next_round_id = (latest_round.round_id + 1) if latest_round else 1
        
        participating_phcs = []
        for phc_id in phc_ids:
            if Patient.objects.filter(phc_id=phc_id).count() >= 10:
                participating_phcs.append(phc_id)
                
        if participating_phcs:
            self.stdout.write(self.style.WARNING(f"Triggering Federated Round #{next_round_id} with participants: {participating_phcs}"))
            round_obj = perform_federated_round(next_round_id, participating_phcs)
            if round_obj and round_obj.status == 'COMPLETED':
                self.stdout.write(self.style.SUCCESS(f"  ✓ Federated Round completed successfully!"))
                self.stdout.write(f"  • Global Model Version: global_v{round_obj.global_model_version}")
                self.stdout.write(f"  • Accuracy: {round_obj.metrics.get('accuracy', 0.0):.4f}")
                self.stdout.write(f"  • Total Samples: {round_obj.sample_count}")
                aggregation_result = {
                    'version_string': f"global_v{round_obj.global_model_version}",
                    'accuracy': round_obj.metrics.get('accuracy', 0.0),
                    'contributors': round_obj.participants
                }
            else:
                self.stdout.write(self.style.ERROR("  ✗ Federated aggregation failed or no models aggregated."))
                aggregation_result = None
        else:
            self.stdout.write(self.style.WARNING("No PHCs have sufficient data (>= 10 samples) to participate in federated aggregation."))
            aggregation_result = None
        
        # SUMMARY
        latest_global = get_latest_global_model()
        
        self.stdout.write("\n" + "="*70)
        self.stdout.write(self.style.SUCCESS("[SUMMARY]"))
        self.stdout.write("-"*70)
        self.stdout.write(f"Local models trained: {len(trained_phcs)}")
        if trained_phcs:
            for item in trained_phcs:
                self.stdout.write(f"  • {item['phc_id']}: {item['version_string']}")
        
        if aggregation_result:
            self.stdout.write(f"\nGlobal model created: {aggregation_result['version_string']}")
            self.stdout.write(f"  • Accuracy: {aggregation_result['accuracy']:.4f}")
            self.stdout.write(f"  • Contributors: {len(aggregation_result['contributors'])}")
        else:
            if latest_global:
                self.stdout.write(f"Latest global model: {latest_global.version_string}")
                self.stdout.write(f"  • Accuracy: {latest_global.accuracy:.4f}")
                self.stdout.write(f"  • Contributors: {len(latest_global.contributors)}")
        
        # ML Innovation Summary
        self.stdout.write(self.style.WARNING("\n[ML INNOVATION METRICS]"))
        self.stdout.write("-"*70)
        
        phcs_with_drift = [item for item in trained_phcs if item['ml_insights'].get('drift_detection', {}).get('drift_detected')]
        if phcs_with_drift:
            self.stdout.write(self.style.ERROR(f"PHCs with Model Drift: {len(phcs_with_drift)}"))
            for item in phcs_with_drift:
                drift = item['ml_insights'].get('drift_detection', {})
                self.stdout.write(
                    f"  • {item['phc_id']}: {drift.get('accuracy_drop_percentage', 0):.1f}% drop"
                )
        else:
            self.stdout.write(self.style.SUCCESS("✓ No model drift detected in any PHC"))
        
        phcs_with_high_risk = [item for item in trained_phcs if item['ml_insights'].get('composite_risk_score', {}).get('severity') == 'HIGH']
        if phcs_with_high_risk:
            self.stdout.write(self.style.ERROR(f"\nPHCs with HIGH Risk Score: {len(phcs_with_high_risk)}"))
            for item in phcs_with_high_risk:
                risk = item['ml_insights'].get('composite_risk_score', {})
                self.stdout.write(
                    f"  • {item['phc_id']}: {risk.get('risk_score', 0):.1f}/100"
                )
        
        self.stdout.write("\n" + "="*70)
