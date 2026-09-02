#!/usr/bin/env python
"""
City-Level Risk Calculation Module

Implements risk scoring at PHC, City, and District levels without
modifying baseline ML training algorithms.

Risk Formula:
    PHC Risk = (High Severity % × 0.4) + (Outbreak Flag % × 0.3) + (Disease Prevalence % × 0.3)
    City Risk = Weighted average of PHC risks (weight by patient count)
    District Risk = Weighted average of City risks
"""

import logging
from datetime import datetime, timedelta
from api.models import Patient, RiskScore, PHC

logger = logging.getLogger(__name__)

DISTRICT_ID = 'Coimbatore'


def calculate_phc_risk_score(phc_id, time_window_days=7):
    """
    Calculate PHC-level risk score using composite formula.
    
    Risk = (High Severity % × 0.4) + (Outbreak Flag % × 0.3) + (Disease Prevalence % × 0.3)
    
    Args:
        phc_id: PHC identifier (e.g., 'PHC_1')
        time_window_days: Look back period (default 7 days)
        
    Returns:
        dict: Risk score breakdown
    """
    try:
        # Get city from PHC collection
        phc_obj = PHC.objects.filter(name=phc_id).first()
        city = phc_obj.city if phc_obj else 'Unknown'
        
        # Get time window
        cutoff_date = datetime.utcnow() - timedelta(days=time_window_days)
        
        # Get patients from PHC in time window
        patients = Patient.objects.filter(
            phc_id=phc_id,
            created_at__gte=cutoff_date
        )
        
        total_patients = patients.count()
        
        if total_patients == 0:
            return {
                'phc_id': phc_id,
                'city': city,
                'phc_risk_score': 0.0,
                'high_severity_percentage': 0.0,
                'outbreak_flag_percentage': 0.0,
                'disease_prevalence_percentage': 0.0,
                'patient_count': 0,
                'note': 'Insufficient data'
            }
        
        # Calculate component percentages
        
        # 1. High Severity Percentage
        high_severity_count = patients.filter(severity_level='High').count()
        high_severity_pct = (high_severity_count / total_patients) * 100
        
        # 2. Outbreak Flag Percentage (disease cases)
        disease_count = patients.filter(disease_label__ne='Healthy').count()
        outbreak_flag_pct = (disease_count / total_patients) * 100
        
        # 3. Disease Prevalence Percentage
        disease_prevalence_pct = (disease_count / total_patients) * 100
        
        # Calculate composite risk score
        phc_risk_score = (
            (high_severity_pct / 100) * 0.4 +
            (outbreak_flag_pct / 100) * 0.3 +
            (disease_prevalence_pct / 100) * 0.3
        ) * 100
        
        # Normalize to 0-100 range
        phc_risk_score = min(phc_risk_score, 100.0)
        
        # city is already fetched above
        
        # Store in database
        risk_record = RiskScore.objects(
            phc_id=phc_id,
            district_id=DISTRICT_ID,
            evaluation_period='daily'
        ).first()
        
        if risk_record:
            risk_record.phc_risk_score = phc_risk_score
            risk_record.high_severity_percentage = high_severity_pct
            risk_record.outbreak_flag_percentage = outbreak_flag_pct
            risk_record.disease_prevalence_percentage = disease_prevalence_pct
            risk_record.patient_count = total_patients
            risk_record.updated_at = datetime.utcnow()
            risk_record.save()
        else:
            RiskScore.objects.create(
                phc_id=phc_id,
                city=city,
                district_id=DISTRICT_ID,
                phc_risk_score=phc_risk_score,
                high_severity_percentage=high_severity_pct,
                outbreak_flag_percentage=outbreak_flag_pct,
                disease_prevalence_percentage=disease_prevalence_pct,
                patient_count=total_patients,
                evaluation_period='daily'
            )
        
        return {
            'phc_id': phc_id,
            'city': city,
            'phc_risk_score': round(phc_risk_score, 4),
            'high_severity_percentage': round(high_severity_pct, 2),
            'outbreak_flag_percentage': round(outbreak_flag_pct, 2),
            'disease_prevalence_percentage': round(disease_prevalence_pct, 2),
            'patient_count': total_patients,
            'calculated_at': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error calculating PHC risk for {phc_id}: {str(e)}")
        return {'error': str(e), 'phc_id': phc_id}


def calculate_city_risk_score(city, time_window_days=7):
    """
    Calculate city-level risk as weighted average of PHC risks.
    
    City Risk = Weighted average of PHC risks (weight by patient count)
    
    Args:
        city: City name (e.g., 'Pollachi')
        time_window_days: Look back period
        
    Returns:
        dict: City risk score breakdown
    """
    try:
        # Get all PHCs in this city dynamically from database
        phcs_in_city = PHC.objects.filter(city=city)
        phc_ids = [phc.name for phc in phcs_in_city]
        
        if not phc_ids:
            return {
                'city': city,
                'city_risk_score': 0.0,
                'num_phcs': 0,
                'note': 'City not found'
            }
        
        # Calculate PHC risk scores
        phc_risks = []
        total_patients = 0
        
        for phc_id in phc_ids:
            phc_data = calculate_phc_risk_score(phc_id, time_window_days)
            if 'error' not in phc_data:
                phc_risks.append(phc_data)
                total_patients += phc_data['patient_count']
        
        if not phc_risks or total_patients == 0:
            return {
                'city': city,
                'city_risk_score': 0.0,
                'num_phcs': len(phc_ids),
                'phc_data': phc_risks,
                'note': 'Insufficient patient data'
            }
        
        # Weighted average by patient count
        city_risk_score = 0.0
        for phc_data in phc_risks:
            weight = phc_data['patient_count'] / total_patients
            city_risk_score += phc_data['phc_risk_score'] * weight
        
        city_risk_score = min(city_risk_score, 100.0)
        
        # Store in database
        risk_record = RiskScore.objects(
            city=city,
            district_id=DISTRICT_ID,
            phc_id=None,
            evaluation_period='daily'
        ).first()
        
        if risk_record:
            risk_record.city_risk_score = city_risk_score
            risk_record.patient_count = total_patients
            risk_record.updated_at = datetime.utcnow()
            risk_record.save()
        else:
            RiskScore.objects.create(
                city=city,
                district_id=DISTRICT_ID,
                city_risk_score=city_risk_score,
                patient_count=total_patients,
                evaluation_period='daily'
            )
        
        return {
            'city': city,
            'city_risk_score': round(city_risk_score, 4),
            'num_phcs': len(phc_ids),
            'total_patients': total_patients,
            'phc_breakdown': phc_risks,
            'calculated_at': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error calculating city risk for {city}: {str(e)}")
        return {'error': str(e), 'city': city}


def calculate_district_risk_score(district_id, time_window_days=7):
    """
    Calculate district-level risk as weighted average of city risks.
    
    District Risk = Weighted average of City risks
    
    Args:
        district_id: District identifier
        time_window_days: Look back period
        
    Returns:
        dict: District risk score breakdown
    """
    try:
        # Get all cities dynamically from database
        cities = PHC.objects.distinct('city')
        
        # Calculate city risk scores
        city_risks = []
        total_patients = 0
        
        for city in cities:
            city_data = calculate_city_risk_score(city, time_window_days)
            if 'error' not in city_data:
                city_risks.append(city_data)
                total_patients += city_data['total_patients']
        
        if not city_risks or total_patients == 0:
            return {
                'district_id': district_id,
                'district_risk_score': 0.0,
                'num_cities': len(cities),
                'note': 'Insufficient data'
            }
        
        # Weighted average by patient count
        district_risk_score = 0.0
        for city_data in city_risks:
            weight = city_data['total_patients'] / total_patients
            district_risk_score += city_data['city_risk_score'] * weight
        
        district_risk_score = min(district_risk_score, 100.0)
        
        # Store in database
        risk_record = RiskScore.objects(
            district_id=district_id,
            phc_id=None,
            city=None,
            evaluation_period='daily'
        ).first()
        
        if risk_record:
            risk_record.district_risk_score = district_risk_score
            risk_record.patient_count = total_patients
            risk_record.updated_at = datetime.utcnow()
            risk_record.save()
        else:
            RiskScore.objects.create(
                district_id=district_id,
                district_risk_score=district_risk_score,
                patient_count=total_patients,
                evaluation_period='daily'
            )
        
        return {
            'district_id': district_id,
            'district_risk_score': round(district_risk_score, 4),
            'num_cities': len(cities),
            'total_patients': total_patients,
            'city_breakdown': city_risks,
            'calculated_at': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error calculating district risk: {str(e)}")
        return {'error': str(e), 'district_id': district_id}


def get_risk_severity_level(risk_score):
    """
    Convert risk score to severity level.
    
    Args:
        risk_score: Risk score 0-100
        
    Returns:
        str: 'LOW', 'MEDIUM', 'HIGH', or 'CRITICAL'
    """
    if risk_score < 25.0:
        return 'LOW'
    elif risk_score < 50.0:
        return 'MEDIUM'
    elif risk_score < 75.0:
        return 'HIGH'
    else:
        return 'CRITICAL'
