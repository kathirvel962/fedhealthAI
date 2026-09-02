import numpy as np
from datetime import datetime
import logging
from sklearn.preprocessing import StandardScaler, LabelEncoder
from api.models import Patient, PHC, NonIIDAnalysisResult

logger = logging.getLogger(__name__)

def kld(p, q):
    """Compute Kullback-Leibler divergence between two probability distributions P and Q."""
    p = np.array(p, dtype=float)
    q = np.array(q, dtype=float)
    
    if p.sum() > 0: 
        p = p / p.sum()
    if q.sum() > 0: 
        q = q / q.sum()
        
    mask = p > 0
    if not np.any(mask):
        return 0.0
    return np.sum(p[mask] * np.log2(p[mask] / (q[mask] + 1e-15)))

def jsd(p, q):
    """Compute Jensen-Shannon divergence between two distributions P and Q."""
    p = np.array(p, dtype=float)
    q = np.array(q, dtype=float)
    
    if p.sum() > 0: 
        p = p / p.sum()
    if q.sum() > 0: 
        q = q / q.sum()
    
    m = 0.5 * (p + q)
    return float(0.5 * kld(p, m) + 0.5 * kld(q, m))

def run_non_iid_analysis():
    """
    Calculate statistical distributions, imbalance, missing values, and Jensen-Shannon
    divergence across all PHCs. Stores results in NonIIDAnalysisResult collection.
    """
    try:
        # Discover PHCs
        phcs = PHC.objects.all()
        phc_ids = [p.name for p in phcs] if phcs else ['PHC_1', 'PHC_2', 'PHC_3', 'PHC_4', 'PHC_5']
        
        classes = ['Dengue', 'Healthy', 'Malaria', 'Pneumonia', 'Typhoid', 'Viral Fever']
        
        # 1. Gather global stats to compute divergences against population baseline
        global_patients = list(Patient.objects.all())
        if not global_patients:
            logger.warning("No patients in DB to analyze statistical heterogeneity.")
            return None
            
        global_counts = {c: 0 for c in classes}
        for p in global_patients:
            if p.disease_label in global_counts:
                global_counts[p.disease_label] += 1
                
        global_total = len(global_patients)
        global_dist = [global_counts[c] / global_total for c in classes]

        phc_metrics = {}
        phc_class_vectors = {}  # Store distribution vectors for JSD calculations
        
        for phc_id in phc_ids:
            patients = list(Patient.objects.filter(phc_id=phc_id))
            count = len(patients)
            if count == 0:
                continue
                
            # Class distribution
            disease_counts = {c: 0 for c in classes}
            for p in patients:
                if p.disease_label in disease_counts:
                    disease_counts[p.disease_label] += 1
            
            disease_dist = {c: disease_counts[c] / count for c in classes}
            phc_class_vectors[phc_id] = [disease_dist[c] for c in classes]
            
            # Age distribution
            ages = [p.age for p in patients]
            age_bins = {"0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81+": 0}
            for age in ages:
                if age <= 20: age_bins["0-20"] += 1
                elif age <= 40: age_bins["21-40"] += 1
                elif age <= 60: age_bins["41-60"] += 1
                elif age <= 80: age_bins["61-80"] += 1
                else: age_bins["81+"] += 1
                
            age_dist = {k: v / count for k, v in age_bins.items()}
            age_stats = {
                "mean": float(np.mean(ages)),
                "std": float(np.std(ages)),
                "min": int(np.min(ages)),
                "max": int(np.max(ages)),
                "bins": age_dist
            }
            
            # Gender distribution
            genders = [p.gender for p in patients]
            gender_counts = {"Male": genders.count("Male") + genders.count("M"), "Female": genders.count("Female") + genders.count("F")}
            gender_total = sum(gender_counts.values()) or 1
            gender_dist = {k: v / gender_total for k, v in gender_counts.items()}
            
            # Continuous feature statistics
            feature_columns = ['temperature_c', 'heart_rate', 'bp_systolic', 'wbc_count', 'platelet_count', 'hemoglobin']
            feature_stats = {}
            for col in feature_columns:
                vals = [float(getattr(p, col)) for p in patients if getattr(p, col) is not None]
                if vals:
                    feature_stats[col] = {
                        "mean": float(np.mean(vals)),
                        "std": float(np.std(vals))
                    }
                else:
                    feature_stats[col] = {"mean": 0.0, "std": 0.0}
                    
            # Class imbalance (Entropy & max/min ratio)
            probs = np.array(list(disease_dist.values()))
            probs = probs[probs > 0]
            entropy = -float(np.sum(probs * np.log2(probs)))
            
            counts_list = list(disease_counts.values())
            max_c = max(counts_list)
            min_c = min(counts_list) if min(counts_list) > 0 else 1
            imbalance_ratio = float(max_c / min_c)
            
            # Missing values (Strict validation check)
            missing_count = 0
            all_cols = ['age', 'gender', 'temperature_c', 'heart_rate', 'bp_systolic', 'wbc_count', 'platelet_count', 'hemoglobin', 'disease_label']
            for p in patients:
                for col in all_cols:
                    if getattr(p, col, None) is None:
                        missing_count += 1
                        break
            
            phc_metrics[phc_id] = {
                "sample_count": count,
                "disease_distribution": disease_dist,
                "age_stats": age_stats,
                "gender_distribution": gender_dist,
                "feature_stats": feature_stats,
                "class_imbalance": {
                    "entropy": entropy,
                    "imbalance_ratio": imbalance_ratio
                },
                "missing_value_count": missing_count
            }

        # 2. Compute Divergences
        global_divergences = {}
        pairwise_divergences = {}
        
        for phc_id, vec in phc_class_vectors.items():
            # JSD against district population average distribution
            global_divergences[phc_id] = float(jsd(vec, global_dist))
            
            # Pairwise JSD against other PHCs
            pairwise_divergences[phc_id] = {}
            for other_id, other_vec in phc_class_vectors.items():
                pairwise_divergences[phc_id][other_id] = float(jsd(vec, other_vec))
                
        # Save results
        latest = NonIIDAnalysisResult.objects.order_by('-analysis_version').first()
        next_ver = (latest.analysis_version + 1) if latest else 1
        
        result = NonIIDAnalysisResult.objects.create(
            analysis_version=next_ver,
            phc_metrics=phc_metrics,
            global_divergences=global_divergences,
            pairwise_divergences=pairwise_divergences,
            created_at=datetime.utcnow()
        )
        logger.info(f"Successfully computed Non-IID analysis version #{next_ver}.")
        return result
    except Exception as e:
        logger.error(f"Error in running Non-IID analysis: {str(e)}")
        return None
