import logging
from datetime import datetime, timedelta
from api.models import Patient, HealthAlert, PHCRelationship

logger = logging.getLogger(__name__)

# Configurable Surveillance Thresholds
SURVEILLANCE_CONFIG = {
    'MIN_TOTAL_CASES_CURRENT': 10,       # Minimum cases in current period to run assessment
    'MIN_DISEASE_CASES_CURRENT': 3,      # Minimum disease-specific cases to trigger alert
    'MIN_INCIDENCE_CURRENT': 0.05,       # Minimum current disease incidence (5.0%)
    'MIN_PERCENTAGE_INCREASE': 50.0,     # Significant increase over baseline (50.0%)
    'CURRENT_PERIOD_DAYS': 14,           # Current assessment window
    'BASELINE_PERIOD_DAYS': 76,          # Historical baseline window (15 to 90 days ago)
    'MIN_HISTORICAL_CASES': 10           # Minimum historical records to compute baseline
}

def seed_default_relationships():
    """Seed default database-driven neighbor relationships between PHCs if empty."""
    if PHCRelationship.objects.count() == 0:
        relationships = [
            ('PHC_1', 'PHC_2'), ('PHC_1', 'PHC_3'),
            ('PHC_2', 'PHC_1'), ('PHC_2', 'PHC_4'),
            ('PHC_3', 'PHC_1'), ('PHC_3', 'PHC_5'),
            ('PHC_4', 'PHC_2'), ('PHC_4', 'PHC_5'),
            ('PHC_5', 'PHC_3'), ('PHC_5', 'PHC_4'),
        ]
        for src, tgt in relationships:
            PHCRelationship.objects.create(
                source_phc=src,
                target_phc=tgt,
                distance_km=10.0,
                active=True
            )
        logger.info("[Surveillance] Seeded default database PHC relationships")

def run_surveillance_detection():
    """
    Core automated disease surveillance assessment engine.
    Calculates current period incidence, compares with historical baseline,
    detects significant increases, and alerts neighboring PHCs.
    """
    seed_default_relationships()
    
    phc_ids = list(Patient.objects.distinct('phc_id'))
    diseases = [d for d in Patient.objects.distinct('disease_label') if d != 'Healthy']
    
    alerts_created = 0
    alerts_updated = 0
    skipped_phcs = []
    
    now = datetime.utcnow()
    current_start = now - timedelta(days=SURVEILLANCE_CONFIG['CURRENT_PERIOD_DAYS'])
    baseline_start = now - timedelta(days=SURVEILLANCE_CONFIG['CURRENT_PERIOD_DAYS'] + SURVEILLANCE_CONFIG['BASELINE_PERIOD_DAYS'])
    
    for phc_id in phc_ids:
        # 1. Check data sufficiency
        current_total = Patient.objects.filter(phc_id=phc_id, created_at__gte=current_start).count()
        baseline_total = Patient.objects.filter(phc_id=phc_id, created_at__gte=baseline_start, created_at__lt=current_start).count()
        
        if current_total < SURVEILLANCE_CONFIG['MIN_TOTAL_CASES_CURRENT']:
            skipped_phcs.append({
                'phc_id': phc_id,
                'reason': f"Insufficient current data ({current_total} records, requires {SURVEILLANCE_CONFIG['MIN_TOTAL_CASES_CURRENT']})"
            })
            continue
            
        if baseline_total < SURVEILLANCE_CONFIG['MIN_HISTORICAL_CASES']:
            skipped_phcs.append({
                'phc_id': phc_id,
                'reason': f"Insufficient baseline data ({baseline_total} records, requires {SURVEILLANCE_CONFIG['MIN_HISTORICAL_CASES']})"
            })
            continue
            
        # 2. Assess each disease
        for disease in diseases:
            current_cases = Patient.objects.filter(phc_id=phc_id, disease_label=disease, created_at__gte=current_start).count()
            baseline_cases = Patient.objects.filter(phc_id=phc_id, disease_label=disease, created_at__gte=baseline_start, created_at__lt=current_start).count()
            
            current_incidence = current_cases / current_total
            baseline_incidence = baseline_cases / baseline_total
            
            # Avoid division by zero by setting a floor incidence
            if baseline_incidence == 0.0:
                baseline_incidence = 0.005  # 0.5% fallback baseline
                
            relative_increase = ((current_incidence - baseline_incidence) / baseline_incidence) * 100
            
            # Check thresholds
            is_elevated = (
                current_incidence >= SURVEILLANCE_CONFIG['MIN_INCIDENCE_CURRENT'] and
                current_cases >= SURVEILLANCE_CONFIG['MIN_DISEASE_CASES_CURRENT'] and
                relative_increase >= SURVEILLANCE_CONFIG['MIN_PERCENTAGE_INCREASE']
            )
            
            if is_elevated:
                # Severity determination
                if relative_increase >= 150.0:
                    severity = 'CRITICAL'
                elif relative_increase >= 100.0:
                    severity = 'HIGH'
                elif relative_increase >= 50.0:
                    severity = 'MEDIUM'
                else:
                    severity = 'LOW'
                    
                # Find connected recipient PHCs
                neighbors = PHCRelationship.objects.filter(source_phc=phc_id, active=True)
                target_phc_ids = [n.target_phc for n in neighbors]
                
                for target_phc in target_phc_ids:
                    # Formulate human-readable message without emojis
                    msg = (
                        f"{severity} PRIORITY HEALTH ALERT\n\n"
                        f"Elevated disease activity has been detected at a nearby health center.\n\n"
                        f"Source:\n{phc_id}\n\n"
                        f"Disease:\n{disease}\n\n"
                        f"Current incidence:\n{current_incidence * 100:.1f}%\n\n"
                        f"Historical baseline:\n{baseline_incidence * 100:.1f}%\n\n"
                        f"Increase:\n+{relative_increase:.1f}%\n\n"
                        f"Please monitor suspected cases closely and review recent patient records. "
                        f"This is a surveillance alert and does not constitute a clinical diagnosis."
                    )
                    
                    rec_action = f"Review recent patient admissions and monitor suspected cases of {disease} closely."
                    
                    # Prevent duplicates - check if active alert exists
                    existing = HealthAlert.objects.filter(
                        disease=disease,
                        source_phc=phc_id,
                        target_phc=target_phc,
                        status__ne='RESOLVED'
                    ).first()
                    
                    if existing:
                        existing.severity = severity
                        existing.current_incidence = round(current_incidence * 100, 2)
                        existing.baseline_incidence = round(baseline_incidence * 100, 2)
                        existing.change_percentage = round(relative_increase, 1)
                        existing.message = msg
                        existing.created_at = datetime.utcnow()
                        existing.save()
                        alerts_updated += 1
                    else:
                        HealthAlert.objects.create(
                            alert_type='SURVEILLANCE_ALERT',
                            disease=disease,
                            source_phc=phc_id,
                            target_phc=target_phc,
                            severity=severity,
                            current_incidence=round(current_incidence * 100, 2),
                            baseline_incidence=round(baseline_incidence * 100, 2),
                            change_percentage=round(relative_increase, 1),
                            message=msg,
                            recommended_action=rec_action,
                            status='NEW',
                            created_by='system',
                            detection_method='automatic'
                        )
                        alerts_created += 1
                        
    return {
        'status': 'success',
        'alerts_created': alerts_created,
        'alerts_updated': alerts_updated,
        'skipped_phcs': skipped_phcs
    }
