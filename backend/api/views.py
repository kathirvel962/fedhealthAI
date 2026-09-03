"""
FedHealthAI Backend API Views - Refactored for MVP Polish

Provides:
- Authentication (Register, Login)
- Patient Management (Submit, List)
- Federated Learning (Training trigger, Model aggregation)
- Surveillance Dashboards (PHC, District, Officer)
- Health Check

All endpoints enforce strict privacy-first data isolation.
"""

import logging
import math
from datetime import datetime, timedelta
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from api.models import (
    User, LocalModel, GlobalModel, Patient, PHC, Alert, CohortSnapshot,
    FederatedRound, FederatedClientUpdate, GlobalModelVersion, ModelEvaluationResult,
    NonIIDAnalysisResult, RiskScore, NotificationLog, PHCRelationship, HealthAlert
)
from api.serializers import (
    FederatedRoundSerializer,
    FederatedClientUpdateSerializer,
    GlobalModelVersionSerializer,
    ModelEvaluationResultSerializer
)
from api.authentication import (
    hash_password, verify_password, generate_token, JWTAuthentication
)
from api.ml_utils import (
    train_federated_model,
    should_trigger_local_training, increment_patient_count,
    get_latest_global_model, get_latest_local_model,
    handle_patient_creation
)

# Configure logging
logger = logging.getLogger(__name__)

# ============================================
# SURVEILLANCE GEOGRAPHIC HELPERS
# ============================================

def calculate_haversine_distance(lat1, lon1, lat2, lon2):
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return None
    R = 6371.0  # Earth's radius in km
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

def get_nearby_phcs(source_phc, radius_km=30.0):
    if not source_phc.latitude or not source_phc.longitude:
        return []
        
    nearby = []
    other_phcs = PHC.objects.filter(name__ne=source_phc.name)
    for other in other_phcs:
        if other.latitude and other.longitude:
            dist = calculate_haversine_distance(
                source_phc.latitude, source_phc.longitude,
                other.latitude, other.longitude
            )
            if dist is not None and dist <= radius_km:
                nearby.append({
                    'phc_id': other.name,
                    'phc_name': other.phc_name,
                    'email': other.email,
                    'distance_km': round(dist, 1)
                })
    return sorted(nearby, key=lambda x: x['distance_km'])

def get_dominant_disease(phc_id, lookback_days=14):
    cutoff_date = datetime.utcnow() - timedelta(days=lookback_days)
    patients = Patient.objects.filter(phc_id=phc_id, created_at__gte=cutoff_date, disease_label__ne='Healthy')
    if not patients:
        patients = Patient.objects.filter(phc_id=phc_id, disease_label__ne='Healthy')
    
    counts = {}
    for p in patients:
        counts[p.disease_label] = counts.get(p.disease_label, 0) + 1
        
    if not counts:
        return "None"
        
    return max(counts, key=counts.get)

def get_recent_change_percentage(phc_id, disease):
    now = datetime.utcnow()
    current_start = now - timedelta(days=14)
    baseline_start = now - timedelta(days=90)
    
    current_total = Patient.objects.filter(phc_id=phc_id, created_at__gte=current_start).count()
    baseline_total = Patient.objects.filter(phc_id=phc_id, created_at__gte=baseline_start, created_at__lt=current_start).count()
    
    if current_total == 0 or baseline_total == 0:
        return 0.0
        
    current_cases = Patient.objects.filter(phc_id=phc_id, disease_label=disease, created_at__gte=current_start).count()
    baseline_cases = Patient.objects.filter(phc_id=phc_id, disease_label=disease, created_at__gte=baseline_start, created_at__lt=current_start).count()
    
    current_incidence = current_cases / current_total
    baseline_incidence = baseline_cases / baseline_total
    
    if baseline_incidence == 0:
        return 0.0
        
    return round(((current_incidence - baseline_incidence) / baseline_incidence) * 100, 1)



# ============================================
# STANDARDIZED ERROR RESPONSE HELPER
# ============================================

def error_response(error_msg, details="", status_code=status.HTTP_400_BAD_REQUEST):
    """
    Standardized API error response format.
    
    Args:
        error_msg (str): Short error message
        details (str): Detailed explanation (optional)
        status_code (int): HTTP status code
        
    Returns:
        tuple: (Response, status_code)
    """
    response_data = {"error": error_msg}
    if details:
        response_data["details"] = details
    return Response(response_data, status=status_code), status_code


# ============================================
# PRIVACY-FIRST HELPER FUNCTIONS
# ============================================

def get_phc_aggregated_metrics(phc_id):
    """
    Get aggregated metrics for a PHC WITHOUT exposing patient-level data.
    
    Privacy guarantee: No raw patient records are accessed.
    
    Args:
        phc_id (str): PHC identifier
        
    Returns:
        dict: Aggregated model metrics (no patient data)
    """
    try:
        latest_model = LocalModel.objects.filter(phc_id=phc_id).order_by('-version').first()
        
        if not latest_model:
            return {
                'phc_id': phc_id,
                'total_patients': 0,
                'model_version': None,
                'model_accuracy': 0.0,
                'last_updated': None
            }
        
        return {
            'phc_id': phc_id,
            'total_patients': latest_model.sample_count,
            'model_version': latest_model.version_string,
            'model_accuracy': float(latest_model.accuracy),
            'model_metrics': {
                'precision': float(latest_model.precision),
                'recall': float(latest_model.recall),
                'f1_score': float(latest_model.f1_score),
            },
            'last_updated': latest_model.trained_at.isoformat() if latest_model.trained_at else None
        }
    except Exception as e:
        logger.error(f"Error getting metrics for {phc_id}: {str(e)}")
        return {
            'phc_id': phc_id,
            'error': "Unable to retrieve metrics",
            'total_patients': 0
        }


def validate_phc_access(user, requested_phc_id):
    """
    Enforce: PHC users can ONLY access their own PHC data.
    
    Returns:
        tuple: (is_allowed: bool, reason: str)
    """
    if user.role == 'PHC_USER':
        if user.phc_id != requested_phc_id:
            return False, f"Access denied: You can only access your assigned PHC"
    return True, "Access granted"


# ============================================
# AUTHENTICATION ENDPOINTS
# ============================================

class RegisterView(APIView):
    """Register a new user with role and PHC assignment."""
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            username = request.data.get('username')
            password = request.data.get('password')
            name = request.data.get('name', '')
            role = request.data.get('role', 'PHC_USER')
            phc_id = request.data.get('phc_id')

            # Validation
            if not username or not password:
                return Response({
                    'error': 'Username and password are required'
                }, status=status.HTTP_400_BAD_REQUEST)

            if not username.strip() or not password.strip():
                return Response({
                    'error': 'Username and password cannot be empty'
                }, status=status.HTTP_400_BAD_REQUEST)

            valid_roles = ['PHC_USER', 'DISTRICT_ADMIN', 'SURVEILLANCE_OFFICER']
            if role not in valid_roles:
                return Response({
                    'error': f'Invalid role. Must be one of: {", ".join(valid_roles)}'
                }, status=status.HTTP_400_BAD_REQUEST)

            if role == 'PHC_USER' and not phc_id:
                return Response({
                    'error': 'PHC selection is required for PHC User role'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Check if username already exists
            if User.objects(username=username).first():
                return Response({
                    'error': 'Username already exists'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Create user
            user = User.objects.create(
                username=username,
                password_hash=hash_password(password),
                role=role,
                phc_id=phc_id
            )

            # Generate token for immediate login
            token = generate_token(str(user.id))

            logger.info(f"User registered: {username} ({role})")

            return Response({
                'message': 'User registered successfully',
                'token': token,
                'user': {
                    'id': str(user.id),
                    'username': username,
                    'role': role
                }
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Registration error: {str(e)}", exc_info=True)
            return Response({
                'error': 'Registration failed due to an internal server error.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LoginView(APIView):
    """Authenticate user and return JWT token."""
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            username = request.data.get('username')
            password = request.data.get('password')

            if not username or not password:
                return Response({
                    'error': 'Username and password are required'
                }, status=status.HTTP_401_UNAUTHORIZED)

            user = User.objects.get(username=username)

            if not verify_password(password, user.password_hash):
                logger.warning(f"Failed login attempt: {username}")
                return Response({
                    'error': 'Invalid username or password'
                }, status=status.HTTP_401_UNAUTHORIZED)

            token = generate_token(str(user.id))
            logger.info(f"User logged in: {username}")

            return Response({
                'token': token,
                'user': {
                    'id': str(user.id),
                    'username': user.username,
                    'role': user.role,
                    'phc_id': user.phc_id
                }
            }, status=status.HTTP_200_OK)

        except User.DoesNotExist:
            logger.warning(f"Login attempt with non-existent user")
            return Response({
                'error': 'Invalid username or password'
            }, status=status.HTTP_401_UNAUTHORIZED)

        except Exception as e:
            logger.error(f"Login error: {str(e)}", exc_info=True)
            return Response({
                'error': 'Login failed due to an internal server error.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================
# PATIENT MANAGEMENT ENDPOINTS
# ============================================

class PatientSubmitView(APIView):
    """Submit a patient record from PHC and trigger training if needed."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            if request.user.role != 'PHC_USER':
                return Response({
                    'error': 'Only PHC users can submit patients'
                }, status=status.HTTP_403_FORBIDDEN)

            phc_id = request.user.phc_id
            
            phc_obj = PHC.objects.filter(name=phc_id).first()
            city = phc_obj.city if phc_obj else 'Unknown'
            
            # Validate required fields (18-column schema)
            required_fields = [
                'age', 'temperature_c', 'heart_rate', 'bp_systolic',
                'wbc_count', 'platelet_count', 'hemoglobin', 'disease_label'
            ]
            missing_fields = [f for f in required_fields if f not in request.data or request.data.get(f) == '']
            if missing_fields:
                return Response({
                    'error': f'Missing required fields: {", ".join(missing_fields)}'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate input formats and clinical ranges
            try:
                age = int(request.data.get('age'))
                if age < 0 or age > 120:
                    return Response({'error': 'Invalid age. Age must be between 0 and 120.'}, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                return Response({'error': 'Age must be a valid integer.'}, status=status.HTTP_400_BAD_REQUEST)

            gender = request.data.get('gender', 'Unknown')
            if gender not in ['Male', 'Female', 'Other', 'Unknown']:
                return Response({'error': 'Invalid gender. Must be Male, Female, Other, or Unknown.'}, status=status.HTTP_400_BAD_REQUEST)

            # Symptoms validation (0 or 1)
            for symptom in ['fever', 'cough', 'fatigue', 'headache', 'vomiting', 'breathlessness']:
                val = request.data.get(symptom)
                if val is not None:
                    try:
                        val_int = int(val)
                        if val_int not in [0, 1]:
                            return Response({'error': f'{symptom} symptom must be 0 or 1.'}, status=status.HTTP_400_BAD_REQUEST)
                    except (ValueError, TypeError):
                        return Response({'error': f'{symptom} symptom must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

            # Vital signs validation
            try:
                temp = float(request.data.get('temperature_c'))
                if temp < 30.0 or temp > 45.0:
                    return Response({'error': 'Invalid temperature. Must be between 30.0 and 45.0 Celsius.'}, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                return Response({'error': 'Temperature must be a valid float.'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                hr = int(request.data.get('heart_rate'))
                if hr < 30 or hr > 250:
                    return Response({'error': 'Invalid heart rate. Must be between 30 and 250 BPM.'}, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                return Response({'error': 'Heart rate must be a valid integer.'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                bp = int(request.data.get('bp_systolic'))
                if bp < 50 or bp > 250:
                    return Response({'error': 'Invalid systolic blood pressure. Must be between 50 and 250 mmHg.'}, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                return Response({'error': 'Blood pressure must be a valid integer.'}, status=status.HTTP_400_BAD_REQUEST)

            # Lab values validation (must be non-negative)
            try:
                wbc = int(request.data.get('wbc_count'))
                if wbc < 0 or wbc > 100000:
                    return Response({'error': 'Invalid WBC count. Must be between 0 and 100,000 cells/µL.'}, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                return Response({'error': 'WBC count must be a valid integer.'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                platelet = int(request.data.get('platelet_count'))
                if platelet < 0 or platelet > 1000000:
                    return Response({'error': 'Invalid platelet count. Must be between 0 and 1,000,000 cells/µL.'}, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                return Response({'error': 'Platelet count must be a valid integer.'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                hb = float(request.data.get('hemoglobin'))
                if hb < 0.0 or hb > 25.0:
                    return Response({'error': 'Invalid hemoglobin level. Must be between 0.0 and 25.0 g/dL.'}, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                return Response({'error': 'Hemoglobin must be a valid float.'}, status=status.HTTP_400_BAD_REQUEST)

            # Labels validation
            disease_label = request.data.get('disease_label')
            valid_diseases = ['Dengue', 'Healthy', 'Malaria', 'Pneumonia', 'Typhoid', 'Viral Fever']
            if disease_label not in valid_diseases:
                return Response({'error': f'Invalid disease label. Must be one of: {", ".join(valid_diseases)}'}, status=status.HTTP_400_BAD_REQUEST)

            severity_level = request.data.get('severity_level', 'Low')
            if severity_level not in ['Low', 'Medium', 'High']:
                return Response({'error': 'Invalid severity level. Must be Low, Medium, or High.'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Generate unique patient_id
            patient_count = Patient.objects.count() + 1
            patient_id = f"P{patient_count:05d}"
            
            # Create patient record with 18 columns
            patient = Patient.objects.create(
                patient_id=patient_id,
                phc_id=phc_id,
                city=city,
                # Demographics
                age=int(request.data.get('age')),
                gender=request.data.get('gender', 'Unknown'),
                # Symptoms (binary 0/1)
                fever=int(request.data.get('fever', 0)),
                cough=int(request.data.get('cough', 0)),
                fatigue=int(request.data.get('fatigue', 0)),
                headache=int(request.data.get('headache', 0)),
                vomiting=int(request.data.get('vomiting', 0)),
                breathlessness=int(request.data.get('breathlessness', 0)),
                # Vital Signs
                temperature_c=float(request.data.get('temperature_c')),
                heart_rate=int(request.data.get('heart_rate')),
                bp_systolic=int(request.data.get('bp_systolic')),
                # Lab Values
                wbc_count=int(request.data.get('wbc_count')),
                platelet_count=int(request.data.get('platelet_count')),
                hemoglobin=float(request.data.get('hemoglobin')),
                # Diagnosis
                disease_label=request.data.get('disease_label'),
                severity_level=request.data.get('severity_level', 'Low')
            )
            
            logger.info(f"Patient submitted for {phc_id}: {patient.disease_label}")
            
            # Create cohort snapshot for historical tracking
            self._create_cohort_snapshot(phc_id)
            
            # Check training trigger via post-patient-creation pipeline
            training_result = handle_patient_creation(phc_id)
            
            return Response({
                'message': 'Patient recorded successfully',
                'patient_id': str(patient.id),
                'training': training_result
            }, status=status.HTTP_201_CREATED)

        except ValueError as e:
            logger.error(f"Validation error: {str(e)}", exc_info=True)
            return Response({
                'error': 'Invalid data format provided.'
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"Patient submission error: {str(e)}", exc_info=True)
            return Response({
                'error': 'Patient submission failed due to an internal server error.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _create_cohort_snapshot(self, phc_id):
        """Create a cohort snapshot for historical tracking after patient submission."""
        try:
            patients = Patient.objects.filter(phc_id=phc_id)
            if not patients:
                return
            
            patients_list = list(patients)
            total = len(patients_list)
            
            # Calculate demographics
            ages = [p.age for p in patients_list if p.age]
            avg_age = sum(ages) / len(ages) if ages else 0
            males = sum(1 for p in patients_list if p.gender == 'Male')
            females = sum(1 for p in patients_list if p.gender == 'Female')
            male_pct = (males / total * 100) if total > 0 else 0
            female_pct = (females / total * 100) if total > 0 else 0
            
            # Calculate symptoms
            fever_count = sum(1 for p in patients_list if p.fever == 1)
            cough_count = sum(1 for p in patients_list if p.cough == 1)
            fatigue_count = sum(1 for p in patients_list if p.fatigue == 1)
            headache_count = sum(1 for p in patients_list if p.headache == 1)
            vomiting_count = sum(1 for p in patients_list if p.vomiting == 1)
            breathlessness_count = sum(1 for p in patients_list if p.breathlessness == 1)
            
            # Calculate vital signs
            temps = [p.temperature_c for p in patients_list if p.temperature_c]
            avg_temp = sum(temps) / len(temps) if temps else 0
            hrs = [p.heart_rate for p in patients_list if p.heart_rate]
            avg_hr = sum(hrs) / len(hrs) if hrs else 0
            bps = [p.bp_systolic for p in patients_list if p.bp_systolic]
            avg_bp = sum(bps) / len(bps) if bps else 0
            
            # Calculate lab values
            wbcs = [p.wbc_count for p in patients_list if p.wbc_count]
            avg_wbc = sum(wbcs) / len(wbcs) if wbcs else 0
            platelets = [p.platelet_count for p in patients_list if p.platelet_count]
            avg_platelet = sum(platelets) / len(platelets) if platelets else 0
            hbs = [p.hemoglobin for p in patients_list if p.hemoglobin]
            avg_hb = sum(hbs) / len(hbs) if hbs else 0
            
            # Calculate disease distribution
            disease_dist = {}
            for p in patients_list:
                disease = p.disease_label or 'Unknown'
                disease_dist[disease] = disease_dist.get(disease, 0) + 1
            
            # Calculate severity
            high_severity = sum(1 for p in patients_list if p.severity_level in ['High', 'Critical'])
            high_severity_pct = (high_severity / total * 100) if total > 0 else 0
            
            # Create snapshot
            snapshot = CohortSnapshot.objects.create(
                phc_id=phc_id,
                total_patients=total,
                average_age=round(avg_age, 2),
                male_percentage=round(male_pct, 2),
                female_percentage=round(female_pct, 2),
                fever_percentage=round((fever_count / total * 100), 2),
                cough_percentage=round((cough_count / total * 100), 2),
                fatigue_percentage=round((fatigue_count / total * 100), 2),
                headache_percentage=round((headache_count / total * 100), 2),
                vomiting_percentage=round((vomiting_count / total * 100), 2),
                breathlessness_percentage=round((breathlessness_count / total * 100), 2),
                average_temperature_c=round(avg_temp, 2),
                average_heart_rate=round(avg_hr, 2),
                average_bp_systolic=round(avg_bp, 2),
                average_wbc_count=round(avg_wbc, 0),
                average_platelet_count=round(avg_platelet, 0),
                average_hemoglobin=round(avg_hb, 2),
                disease_distribution=disease_dist,
                high_severity_percentage=round(high_severity_pct, 2),
                snapshot_date=datetime.now()
            )
            logger.info(f"Created cohort snapshot for {phc_id}: {total} patients")
        except Exception as e:
            logger.error(f"Failed to create cohort snapshot: {str(e)}", exc_info=True)


class PHCPatientsView(APIView):
    """Retrieve all patients for the authenticated PHC user."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            if request.user.role != 'PHC_USER':
                return error_response(
                    "Only PHC users can view records",
                    status_code=status.HTTP_403_FORBIDDEN
                )[0]

            phc_id = request.user.phc_id
            
            # Verify access
            is_allowed, reason = validate_phc_access(request.user, phc_id)
            if not is_allowed:
                return error_response(reason, status_code=status.HTTP_403_FORBIDDEN)[0]
            
            patients = Patient.objects.filter(phc_id=phc_id).order_by('-created_at')
            
            data = [{
                'id': str(p.id),
                'age': p.age,
                'gender': p.gender,
                'fever': p.fever,
                'cough': p.cough,
                'fatigue': p.fatigue,
                'headache': p.headache,
                'vomiting': p.vomiting,
                'breathlessness': p.breathlessness,
                'temperature_c': p.temperature_c,
                'heart_rate': p.heart_rate,
                'bp_systolic': p.bp_systolic,
                'wbc_count': p.wbc_count,
                'platelet_count': p.platelet_count,
                'hemoglobin': p.hemoglobin,
                'disease_label': p.disease_label,
                'severity_level': p.severity_level,
                'created_at': p.created_at.isoformat()
            } for p in patients]
            
            logger.info(f"Retrieved {len(data)} patients for {phc_id}")

            return Response({
                'count': len(data),
                'patients': data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error retrieving patients: {str(e)}")
            return error_response(
                "Failed to retrieve patients",
                "An internal error occurred while retrieving patient records.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]


# Model aggregation endpoints are disabled in this version.


class SurveillanceAlertsView(APIView):
    """Retrieve surveillance alerts (District Admin & Surveillance Officer)."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            if request.user.role not in ['DISTRICT_ADMIN', 'SURVEILLANCE_OFFICER']:
                return error_response(
                    "Access denied",
                    status_code=status.HTTP_403_FORBIDDEN
                )[0]

            # Get alerts from last 30 days
            thirty_days_ago = datetime.utcnow() - timedelta(days=30)
            alerts = Alert.objects.filter(
                created_at__gte=thirty_days_ago
            ).order_by('-created_at')[:100]
            
            alert_data = [{
                'id': str(a.id),
                'phc_id': a.phc_id,
                'alert_type': a.alert_type,
                'risk_score': round(float(a.risk_score), 2) if a.risk_score else 0,
                'severity': a.severity,
                'created_at': a.created_at.isoformat(),
                'message': a.message
            } for a in alerts]
            
            logger.info(f"Retrieved {len(alert_data)} alerts")

            return Response({
                'total_alerts': len(alert_data),
                'alerts': alert_data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error retrieving alerts: {str(e)}")
            return error_response(
                "Failed to retrieve alerts",
                "An internal error occurred while retrieving alerts.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]


# ============================================
# DASHBOARD ENDPOINTS
# ============================================

class PHCDashboardMetricsView(APIView):
    """PHC Dashboard: Local model metrics, drift status, risk scores."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            if request.user.role != 'PHC_USER':
                return error_response(
                    "Only PHC users can access their dashboard",
                    status_code=status.HTTP_403_FORBIDDEN
                )[0]
            
            phc_id = request.user.phc_id
            
            # Get latest local model
            latest_model = LocalModel.objects.filter(phc_id=phc_id).order_by('-trained_at').first()
            
            model_accuracy = 0.0
            model_version = None
            drift_detected = False
            accuracy_drop_pct = 0.0
            
            if latest_model:
                model_accuracy = float(latest_model.accuracy) if latest_model.accuracy else 0.0
                model_version = latest_model.version_string
                
                # Check for drift (>10% accuracy drop)
                accuracy_drop_pct = 0.0
                if latest_model.version > 1:
                    previous_model = LocalModel.objects.filter(
                        phc_id=phc_id,
                        version=latest_model.version - 1
                    ).first()
                    
                    if previous_model and previous_model.accuracy:
                        accuracy_drop = float(previous_model.accuracy) - model_accuracy
                        accuracy_drop_pct = (accuracy_drop / float(previous_model.accuracy)) * 100
                        accuracy_drop_pct = max(0.0, accuracy_drop_pct)
                        drift_detected = accuracy_drop_pct > 10.0
            
            # Get patient count
            patient_count = Patient.objects.filter(phc_id=phc_id).count()
            
            # Get latest risk score
            latest_alert = Alert.objects.filter(phc_id=phc_id).order_by('-created_at').first()
            risk_score = float(latest_alert.risk_score) if latest_alert else 0.0
            alert_severity = latest_alert.severity if latest_alert else 'UNKNOWN'
            
            # Get alert history
            alerts_7_days = Alert.objects.filter(
                phc_id=phc_id,
                created_at__gte=datetime.utcnow() - timedelta(days=7)
            ).order_by('created_at')
            
            alert_history = [{
                'date': a.created_at.isoformat(),
                'risk_score': round(float(a.risk_score), 2),
                'severity': a.severity
            } for a in alerts_7_days]
            
            logger.info(f"PHC Dashboard accessed for {phc_id}")

            # Get active health alerts for this target PHC
            from api.models import HealthAlert
            active_health_alerts = HealthAlert.objects.filter(
                target_phc=phc_id,
                status__ne='RESOLVED'
            ).order_by('-created_at')
            
            serialized_health_alerts = [{
                'id': str(a.id),
                'alert_type': a.alert_type,
                'disease': a.disease,
                'source_phc': a.source_phc,
                'target_phc': a.target_phc,
                'severity': a.severity,
                'current_incidence': a.current_incidence,
                'baseline_incidence': a.baseline_incidence,
                'change_percentage': a.change_percentage,
                'message': a.message,
                'recommended_action': a.recommended_action,
                'created_at': a.created_at.isoformat(),
                'status': a.status,
                'created_by': a.created_by,
                'detection_method': a.detection_method
            } for a in active_health_alerts]

            return Response({
                'phc_id': phc_id,
                'model': {
                    'version': model_version,
                    'accuracy': round(model_accuracy, 4),
                    'last_trained': latest_model.trained_at.isoformat() if latest_model else None
                },
                'drift': {
                    'detected': drift_detected,
                    'accuracy_drop_percentage': round(accuracy_drop_pct, 2),
                    'warning': 'Model accuracy dropped >10%' if drift_detected else None
                },
                'risk': {
                    'latest_score': round(risk_score, 2),
                    'severity': alert_severity
                },
                'patients': {'total': patient_count},
                'alerts_7_days': alert_history,
                'health_alerts': serialized_health_alerts,
                'active_alert_count': len(serialized_health_alerts),
                'last_updated': datetime.utcnow().isoformat()
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"PHC dashboard error: {str(e)}")
            return error_response(
                "Failed to load PHC dashboard",
                "An internal error occurred while generating dashboard metrics.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]


class DistrictDashboardMetricsView(APIView):
    """District Dashboard: Global model, aggregation, PHC metrics."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            if request.user.role not in ['DISTRICT_ADMIN', 'SURVEILLANCE_OFFICER']:
                return error_response(
                    "Access denied",
                    status_code=status.HTTP_403_FORBIDDEN
                )[0]
            
            # Get global model
            latest_global = GlobalModel.objects.order_by('-version').first()
            
            global_accuracy = 0.0
            contributors = []
            
            if latest_global:
                global_accuracy = float(latest_global.accuracy) if latest_global.accuracy else 0.0
                contributors = latest_global.contributors or []
            
            # Get latest Non-IID analysis JSD scores
            latest_non_iid = NonIIDAnalysisResult.objects.order_by('-analysis_version').first()
            global_divs = latest_non_iid.global_divergences if latest_non_iid else {}

            # Get latest federated round status
            latest_round = FederatedRound.objects.order_by('-round_id').first()
            round_status = None
            if latest_round:
                updates = FederatedClientUpdate.objects.filter(round_id=latest_round.round_id)
                update_status = {u.phc_id: 'received' for u in updates}
                round_status = {
                    'round_id': latest_round.round_id,
                    'status': latest_round.status,
                    'participants': latest_round.participants,
                    'updates_received': update_status,
                    'created_at': latest_round.started_at.isoformat() if latest_round.started_at else None,
                    'completed_at': latest_round.completed_at.isoformat() if latest_round.completed_at else None,
                    'global_model_version': latest_round.global_model_version
                }

            # Get all PHCs dynamically from database
            phc_ids = set([phc.name for phc in PHC.objects.all()])
            if not phc_ids:
                phc_ids = set([u.phc_id for u in User.objects.filter(role='PHC_USER') if u.phc_id])
            
            phc_metrics = []
            high_risk_phcs = []
            
            for phc_id in phc_ids:
                latest_local = LocalModel.objects.filter(phc_id=phc_id).order_by('-trained_at').first()
                latest_alert = Alert.objects.filter(phc_id=phc_id, alert_type='COMPOSITE_RISK').order_by('-created_at').first()
                patient_count = Patient.objects.filter(phc_id=phc_id).count()
                
                risk_score = float(latest_alert.risk_score) if latest_alert else 0.0
                severity = latest_alert.severity if latest_alert else 'UNKNOWN'

                # Calculate performance drift
                drift_pct = 0.0
                if latest_local and latest_local.version > 1:
                    previous_local = LocalModel.objects.filter(
                        phc_id=phc_id,
                        version=latest_local.version - 1
                    ).first()
                    if previous_local and previous_local.accuracy:
                        accuracy_drop = float(previous_local.accuracy) - float(latest_local.accuracy)
                        drift_pct = (accuracy_drop / float(previous_local.accuracy)) * 100
                        drift_pct = max(0.0, drift_pct)

                # Get JSD from Non-IID analysis
                jsd_value = global_divs.get(phc_id, 0.0)
                
                phc_data = {
                    'phc_id': phc_id,
                    'local_model_version': latest_local.version_string if latest_local else 'Not trained',
                    'local_model_accuracy': round(float(latest_local.accuracy), 4) if latest_local else 0.0,
                    'risk_score': round(risk_score, 2),
                    'severity': severity,
                    'patients': patient_count,
                    'performance_drift': round(drift_pct, 2),
                    'data_heterogeneity': round(jsd_value, 4)
                }
                
                phc_metrics.append(phc_data)
                
                if severity in ['HIGH', 'CRITICAL']:
                    high_risk_phcs.append(phc_data)
            
            logger.info(f"District Dashboard accessed, {len(phc_metrics)} PHCs")
            
            # Calculate average risk score across all PHCs (capped at 100)
            if phc_metrics:
                avg_risk = sum([p['risk_score'] for p in phc_metrics]) / len(phc_metrics)
                avg_risk = min(avg_risk, 100.0)  # Cap at 100%
            else:
                avg_risk = 0.0

            return Response({
                'global_model': {
                    'version': latest_global.version if latest_global else 0,
                    'version_string': latest_global.version_string if latest_global else 'N/A',
                    'accuracy': round(global_accuracy, 4),
                    'precision': round(float(latest_global.precision), 4) if latest_global and hasattr(latest_global, 'precision') and latest_global.precision is not None else 0.0,
                    'recall': round(float(latest_global.recall), 4) if latest_global and hasattr(latest_global, 'recall') and latest_global.recall is not None else 0.0,
                    'f1_score': round(float(latest_global.f1_score), 4) if latest_global and hasattr(latest_global, 'f1_score') and latest_global.f1_score is not None else 0.0,
                    'contributors': contributors,
                    'total_contributors': len(contributors),
                    'aggregation_round': latest_global.version if latest_global else 0
                },
                'latest_round': round_status,
                'average_phc_risk_score': round(avg_risk, 4),
                'phc_breakdown': phc_metrics,
                'high_risk_phcs': high_risk_phcs,
                'last_updated': datetime.utcnow().isoformat()
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"District dashboard error: {str(e)}")
            return error_response(
                "Failed to load district dashboard",
                "An internal error occurred while generating dashboard metrics.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]

class SurveillanceDashboardMetricsView(APIView):
    """Surveillance Dashboard: Outbreak trends, alerts, heatmap."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            if request.user.role != 'SURVEILLANCE_OFFICER':
                return error_response(
                    "Only surveillance officers can access this",
                    status_code=status.HTTP_403_FORBIDDEN
                )[0]
            
            # Get alerts from last 30 days
            thirty_days_ago = datetime.utcnow() - timedelta(days=30)
            recent_alerts = Alert.objects.filter(
                created_at__gte=thirty_days_ago
            ).order_by('created_at')
            
            # Outbreak trend (daily aggregation)
            trend_data = {}
            for alert in recent_alerts:
                date_key = alert.created_at.strftime('%Y-%m-%d')
                if date_key not in trend_data:
                    trend_data[date_key] = {'count': 0, 'high': 0, 'critical': 0}
                
                trend_data[date_key]['count'] += 1
                if alert.severity == 'CRITICAL':
                    trend_data[date_key]['critical'] += 1
                elif alert.severity == 'HIGH':
                    trend_data[date_key]['high'] += 1
            
            outbreak_trend = [{
                'date': date,
                'alert_count': data['count'],
                'high_severity': data['high'],
                'critical_severity': data['critical']
            } for date, data in sorted(trend_data.items())]
            
            # Alert history
            alert_history = []
            for a in recent_alerts.order_by('-created_at')[:100]:
                phc_obj = PHC.objects.filter(name=a.phc_id).first()
                phc_name = phc_obj.phc_name if phc_obj else a.phc_id
                
                dom_disease = get_dominant_disease(a.phc_id)
                nearby_list = get_nearby_phcs(phc_obj) if phc_obj else []
                
                notifs = []
                for n in nearby_list:
                    log = NotificationLog.objects.filter(
                        alert_id=str(a.id), 
                        recipient_phc_id=n['phc_id']
                    ).order_by('-sent_at').first()
                    
                    if log:
                        if log.status == 'SENT':
                            status_text = f"Notified"
                        elif log.status == 'FAILED':
                            status_text = "Notification failed"
                        else:
                            status_text = "Notification pending"
                        raw_status = log.status
                    else:
                        status_text = "Not notified"
                        raw_status = "NONE"
                        
                    notifs.append({
                        'recipient_phc_id': n['phc_id'],
                        'recipient_phc_name': n['phc_name'],
                        'recipient_email': n['email'],
                        'status_text': status_text,
                        'status': raw_status
                    })
                
                alert_history.append({
                    'id': str(a.id),
                    'phc_id': a.phc_id,
                    'phc_name': phc_name,
                    'type': a.alert_type,
                    'severity': a.severity,
                    'risk_score': round(float(a.risk_score), 2),
                    'created_at': a.created_at.isoformat(),
                    'primary_disease': dom_disease,
                    'nearby_phcs': nearby_list,
                    'notifications': notifs,
                    'message': a.message
                })
            
            # Heatmap (PHC-based)
            heatmap_data = {}
            phc_ids = set([u.phc_id for u in User.objects.filter(role='PHC_USER') if u.phc_id])
            
            for phc_id in phc_ids:
                phc_alerts = Alert.objects.filter(phc_id=phc_id, created_at__gte=thirty_days_ago)
                
                if phc_alerts.count() > 0:
                    avg_risk = sum(float(a.risk_score) for a in phc_alerts) / len(phc_alerts)
                    
                    # Count severity distribution
                    severity_dist = {
                        'CRITICAL': sum(1 for a in phc_alerts if a.severity == 'CRITICAL'),
                        'HIGH': sum(1 for a in phc_alerts if a.severity == 'HIGH'),
                        'MEDIUM': sum(1 for a in phc_alerts if a.severity == 'MEDIUM'),
                        'LOW': sum(1 for a in phc_alerts if a.severity == 'LOW'),
                    }
                    
                    # Determine highest severity
                    highest_severity = 'LOW'
                    if severity_dist['CRITICAL'] > 0:
                        highest_severity = 'CRITICAL'
                    elif severity_dist['HIGH'] > 0:
                        highest_severity = 'HIGH'
                    elif severity_dist['MEDIUM'] > 0:
                        highest_severity = 'MEDIUM'
                    
                    heatmap_data[phc_id] = {
                        'alert_count': phc_alerts.count(),
                        'avg_risk_score': round(avg_risk, 2),
                        'severity_distribution': severity_dist,
                        'highest_severity': highest_severity
                    }
            
            # Summary calculation
            critical_alerts = sum(1 for a in recent_alerts if a.severity == 'CRITICAL')
            high_alerts = sum(1 for a in recent_alerts if a.severity == 'HIGH')
            if recent_alerts:
                avg_risk = sum(float(a.risk_score) for a in recent_alerts) / len(list(recent_alerts))
                avg_risk = min(avg_risk, 100.0)  # Cap at 100%
            else:
                avg_risk = 0.0
            
            logger.info(f"Surveillance Dashboard accessed, {len(recent_alerts)} alerts")

            # Get all PHCs dynamically from database
            phcs = PHC.objects.all()
            phc_list = []
            
            def get_risk_severity_level(score):
                if score is None:
                    return None
                if score < 25.0:
                    return 'LOW'
                elif score < 50.0:
                    return 'MEDIUM'
                elif score < 75.0:
                    return 'HIGH'
                else:
                    return 'CRITICAL'
            
            for phc in phcs:
                risk_record = RiskScore.objects.filter(phc_id=phc.name, evaluation_period='daily').order_by('-updated_at').first()
                active_alerts = HealthAlert.objects.filter(target_phc=phc.name, status__ne='RESOLVED').order_by('-created_at')
                
                # Dynamic coordinate-based nearby list
                nearby_list = get_nearby_phcs(phc, radius_km=30.0)
                dominant_disease = get_dominant_disease(phc.name)
                recent_change = get_recent_change_percentage(phc.name, dominant_disease)
                patient_count = Patient.objects.filter(phc_id=phc.name).count()
                
                latest_alert_obj = active_alerts.first()
                
                risk_val = None
                risk_level = None
                if risk_record and risk_record.phc_risk_score is not None:
                    risk_val = round(float(risk_record.phc_risk_score), 2)
                    risk_level = get_risk_severity_level(risk_val)
                    
                phc_list.append({
                    'phc_id': phc.name,
                    'phc_name': phc.phc_name,
                    'city': phc.city,
                    'district': phc.district_id,
                    'latitude': phc.latitude,
                    'longitude': phc.longitude,
                    'email': phc.email,
                    'risk_score': risk_val,
                    'risk_level': risk_level,
                    'active_alert_count': active_alerts.count(),
                    'latest_alert': latest_alert_obj.message if latest_alert_obj else None,
                    'updated_at': (max(phc.updated_at, risk_record.updated_at) if risk_record else phc.updated_at).isoformat(),
                    'nearby_phcs': nearby_list,
                    'dominant_disease': dominant_disease,
                    'recent_change_percentage': recent_change,
                    'patient_count': patient_count
                })

            return Response({
                'summary': {
                    'total_alerts': len(list(recent_alerts)),
                    'critical_alerts': critical_alerts,
                    'high_alerts': high_alerts,
                    'average_risk_score': round(avg_risk, 2),
                    'affected_phcs': len(heatmap_data),
                    'active_critical': sum(1 for p in phc_list if p['risk_level'] == 'CRITICAL'),
                    'high_risk_phcs': sum(1 for p in phc_list if p['risk_level'] == 'HIGH'),
                    'nearby_alerts': HealthAlert.objects.filter(status__ne='RESOLVED').count()
                },
                'outbreak_trend': outbreak_trend,
                'alert_history': alert_history,
                'heatmap': heatmap_data,
                'phcs': phc_list,
                'last_updated': datetime.utcnow().isoformat()
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Surveillance dashboard error: {str(e)}", exc_info=True)
            return error_response(
                "Failed to load surveillance dashboard",
                "An internal error occurred while generating dashboard metrics.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]


class PHCNotificationView(APIView):
    """Request params for EmailJS notification to a nearby PHC"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            alert_id = request.data.get('alert_id')
            recipient_phc_id = request.data.get('recipient_phc_id')
            notification_type = request.data.get('notification_type', 'manual')

            if not alert_id or not recipient_phc_id:
                return Response({'error': 'alert_id and recipient_phc_id are required'}, status=status.HTTP_400_BAD_REQUEST)

            # Find alert
            alert = Alert.objects.filter(id=alert_id).first()
            if not alert:
                return Response({'error': 'Alert not found'}, status=status.HTTP_404_NOT_FOUND)

            # Find recipient PHC
            recipient = PHC.objects.filter(name=recipient_phc_id).first()
            if not recipient:
                return Response({'error': 'Recipient PHC not found'}, status=status.HTTP_404_NOT_FOUND)

            if not recipient.email:
                return Response({'error': 'Recipient PHC does not have a configured email address'}, status=status.HTTP_400_BAD_REQUEST)

            # Find source PHC
            source_phc = PHC.objects.filter(name=alert.phc_id).first()
            source_name = source_phc.phc_name if source_phc else alert.phc_id

            # Idempotency check: check if already SENT to this recipient
            existing_sent = NotificationLog.objects.filter(
                alert_id=alert_id,
                recipient_phc_id=recipient_phc_id,
                status='SENT'
            ).first()

            if existing_sent:
                return Response({
                    'status': 'already_sent',
                    'message': 'This alert has already been successfully notified to the recipient PHC.'
                }, status=status.HTTP_200_OK)

            # Retrieve or create a PENDING/FAILED log to retry
            log = NotificationLog.objects.filter(
                alert_id=alert_id,
                recipient_phc_id=recipient_phc_id,
                status='PENDING'
            ).first()

            if not log:
                log = NotificationLog.objects.create(
                    alert_id=alert_id,
                    recipient_phc_id=recipient_phc_id,
                    recipient_email=recipient.email,
                    status='PENDING',
                    notification_type=notification_type
                )

            # Compute parameters
            primary_disease = get_dominant_disease(alert.phc_id)
            alert_msg = alert.message or f"Elevated disease risk detected at {source_name}"
            alert_time_str = alert.created_at.strftime('%Y-%m-%d %H:%M:%S UTC')
            
            # Send email directly from backend using Django mail configuration
            from api.email_service import send_phc_alert_email
            email_sent, email_err = send_phc_alert_email(
                recipient_email=recipient.email,
                recipient_phc_name=recipient.phc_name or recipient.name,
                source_phc_name=source_name,
                disease=primary_disease,
                severity=alert.severity,
                risk_score=f"{alert.risk_score:.1f}",
                alert_message=alert_msg,
                alert_time=alert_time_str
            )

            if email_sent:
                log.status = 'SENT'
                log.sent_at = datetime.utcnow()
                log.error_message = None
                log.save()
                return Response({
                    'status': 'sent',
                    'log_id': str(log.id),
                    'message': f"Surveillance alert email successfully delivered to {recipient.email}"
                }, status=status.HTTP_200_OK)
            else:
                log.status = 'FAILED'
                log.error_message = email_err
                log.save()
                
                email_params = {
                    'to_email': recipient.email,
                    'phc_id': recipient.name,
                    'phc_name': recipient.phc_name or recipient.name,
                    'source_phc_id': alert.phc_id,
                    'source_phc_name': source_name,
                    'severity': alert.severity,
                    'risk_score': f"{alert.risk_score:.1f}",
                    'disease': primary_disease,
                    'alert_message': alert_msg,
                    'alert_time': alert_time_str
                }
                return Response({
                    'status': 'pending',
                    'log_id': str(log.id),
                    'error': email_err,
                    'email_params': email_params
                }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error initiating PHC notification: {str(e)}", exc_info=True)
            return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PHCNotificationConfirmView(APIView):
    """Confirm/update the status of an EmailJS notification log"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            log_id = request.data.get('log_id')
            outcome = request.data.get('status')  # 'SENT' or 'FAILED'
            error_message = request.data.get('error_message')

            if not log_id or not outcome:
                return Response({'error': 'log_id and status are required'}, status=status.HTTP_400_BAD_REQUEST)

            if outcome not in ['SENT', 'FAILED']:
                return Response({'error': 'Status must be SENT or FAILED'}, status=status.HTTP_400_BAD_REQUEST)

            log = NotificationLog.objects.filter(id=log_id).first()
            if not log:
                return Response({'error': 'Notification log not found'}, status=status.HTTP_404_NOT_FOUND)

            log.status = outcome
            if outcome == 'FAILED':
                log.error_message = error_message
            log.sent_at = datetime.utcnow()
            log.save()

            return Response({
                'status': 'updated',
                'log_id': str(log.id),
                'log_status': log.status
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error confirming PHC notification: {str(e)}", exc_info=True)
            return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DirectPHCAlertView(APIView):
    """Directly dispatch an alert notification email to a target PHC (e.g. PHC_3)"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            target_phc_id = request.data.get('target_phc_id', 'PHC_3').strip().upper()
            source_phc_id = request.data.get('source_phc_id', 'PHC_1').strip().upper()
            disease = request.data.get('disease', 'Dengue')
            severity = request.data.get('severity', 'HIGH')
            risk_score = request.data.get('risk_score', '85.0')
            custom_message = request.data.get('message')

            target_phc = PHC.objects.filter(name=target_phc_id).first()
            if not target_phc:
                return Response({'error': f"Target PHC '{target_phc_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

            if not target_phc.email:
                return Response({'error': f"Target PHC '{target_phc_id}' has no email configured."}, status=status.HTTP_400_BAD_REQUEST)

            source_phc = PHC.objects.filter(name=source_phc_id).first()
            source_name = source_phc.phc_name if source_phc else f"Primary Health Center ({source_phc_id})"
            target_name = target_phc.phc_name or target_phc_id

            alert_msg = custom_message or (
                f"Surveillance alert: Elevated risk and cases of {disease} observed in neighboring PHC zones. "
                f"Please review admission logs, triage vitals, and ensure adequate diagnostic supplies."
            )
            alert_time_str = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')

            from api.email_service import send_phc_alert_email
            email_sent, email_err = send_phc_alert_email(
                recipient_email=target_phc.email,
                recipient_phc_name=target_name,
                source_phc_name=source_name,
                disease=disease,
                severity=severity,
                risk_score=str(risk_score),
                alert_message=alert_msg,
                alert_time=alert_time_str
            )

            log = NotificationLog.objects.create(
                alert_id=f"DIRECT_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                recipient_phc_id=target_phc_id,
                recipient_email=target_phc.email,
                status='SENT' if email_sent else 'FAILED',
                notification_type='manual',
                error_message=email_err,
                sent_at=datetime.utcnow()
            )

            if email_sent:
                return Response({
                    'status': 'sent',
                    'log_id': str(log.id),
                    'recipient_email': target_phc.email,
                    'message': f"Alert email successfully dispatched to {target_name} ({target_phc.email})"
                }, status=status.HTTP_200_OK)
            else:
                email_params = {
                    'to_email': target_phc.email,
                    'phc_id': target_phc_id,
                    'phc_name': target_name,
                    'source_phc_id': source_phc_id,
                    'source_phc_name': source_name,
                    'severity': severity,
                    'risk_score': str(risk_score),
                    'disease': disease,
                    'alert_message': alert_msg,
                    'alert_time': alert_time_str
                }
                return Response({
                    'status': 'pending',
                    'log_id': str(log.id),
                    'error': email_err,
                    'email_params': email_params
                }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error dispatching direct PHC alert: {str(e)}", exc_info=True)
            return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================
# HEALTH CHECK ENDPOINT (NEW)
# ============================================

class HealthCheckView(APIView):
    """System health check endpoint - verifies MongoDB and ML collections."""
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            # Verify MongoDB connection
            db_status = "connected"
            ml_status = "operational"
            
            try:
                # Ping database
                User.objects.first()
            except Exception as e:
                db_status = "disconnected"
                logger.warning(f"Database connection check failed: {str(e)}")
            
            # Verify local_models collection
            try:
                LocalModel.objects.count()
            except Exception as e:
                ml_status = "degraded"
                logger.warning(f"Local models collection check failed: {str(e)}")
            
            # Verify global_models collection
            try:
                GlobalModel.objects.count()
            except Exception as e:
                ml_status = "degraded"
                logger.warning(f"Global models collection check failed: {str(e)}")
            
            # Determine overall status
            is_healthy = db_status == "connected" and ml_status == "operational"
            overall_status = "healthy" if is_healthy else "degraded"
            http_status = status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE
            
            logger.info(f"Health check: {overall_status} (db={db_status}, ml={ml_status})")

            return Response({
                'status': overall_status,
                'database': db_status,
                'ml_engine': ml_status,
                'timestamp': datetime.utcnow().isoformat(),
                'version': '1.0.0'
            }, status=http_status)

        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            return Response({
                'status': 'unhealthy',
                'error': 'System health check failed due to an internal error.',
                'timestamp': datetime.utcnow().isoformat()
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class CohortHistoryView(APIView):
    """Retrieve historical cohort snapshots for trend analysis"""
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        """Get historical cohort snapshots for the user's PHC"""
        try:
            user = request.user
            phc_id = user.phc_id if user.role == 'PHC_USER' else request.query_params.get('phc_id')
            
            if not phc_id:
                return Response({
                    'error': 'PHC ID is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Fetch historical snapshots (last 30 days, ordered by date)
            snapshots = CohortSnapshot.objects(phc_id=phc_id).order_by('-snapshot_date')[:30]
            
            if not snapshots:
                # Create initial snapshot from current patients
                patients = Patient.objects(phc_id=phc_id)
                if patients:
                    snapshot = self._create_snapshot_from_patients(phc_id, patients)
                    snapshots = [snapshot]
                else:
                    snapshots = []
            
            return Response({
                'phc_id': phc_id,
                'snapshots': [self._serialize_snapshot(s) for s in snapshots]
            }, status=status.HTTP_200_OK)
        
        except Exception as e:
            logger.error(f"Error retrieving cohort history: {str(e)}")
            return Response({
                'error': 'Failed to retrieve history due to an internal server error.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _create_snapshot_from_patients(self, phc_id, patients):
        """Generate a cohort snapshot from patient data"""
        try:
            patient_list = list(patients)
            if not patient_list:
                return None
            
            # Calculate metrics
            total = len(patient_list)
            fever_count = sum(1 for p in patient_list if p.fever)
            cough_count = sum(1 for p in patient_list if p.cough)
            fatigue_count = sum(1 for p in patient_list if p.fatigue)
            headache_count = sum(1 for p in patient_list if p.headache)
            vomiting_count = sum(1 for p in patient_list if p.vomiting)
            breathlessness_count = sum(1 for p in patient_list if p.breathlessness)
            male_count = sum(1 for p in patient_list if p.gender == 'Male')
            high_severity_count = sum(1 for p in patient_list if p.severity_level == 'High')
            
            # Create snapshot
            snapshot = CohortSnapshot.objects.create(
                phc_id=phc_id,
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
                disease_distribution=self._calculate_disease_distribution(patient_list)
            )
            return snapshot
        except Exception as e:
            logger.error(f"Error creating snapshot: {str(e)}")
            return None
    
    def _calculate_disease_distribution(self, patients):
        """Calculate disease distribution from patients"""
        distribution = {}
        for p in patients:
            label = p.disease_label or 'Unknown'
            distribution[label] = distribution.get(label, 0) + 1
        return distribution
    
    def _serialize_snapshot(self, snapshot):
        """Convert snapshot to dictionary"""
        return {
            'snapshot_date': snapshot.snapshot_date.isoformat() if snapshot.snapshot_date else None,
            'total_patients': snapshot.total_patients,
            'average_age': float(snapshot.average_age),
            'fever_percentage': float(snapshot.fever_percentage),
            'cough_percentage': float(snapshot.cough_percentage),
            'fatigue_percentage': float(snapshot.fatigue_percentage),
            'headache_percentage': float(snapshot.headache_percentage),
            'vomiting_percentage': float(snapshot.vomiting_percentage),
            'breathlessness_percentage': float(snapshot.breathlessness_percentage),
            'average_wbc_count': float(snapshot.average_wbc_count),
            'average_temperature_c': float(snapshot.average_temperature_c),
            'average_heart_rate': float(snapshot.average_heart_rate),
            'average_bp_systolic': float(snapshot.average_bp_systolic),
            'average_platelet_count': float(snapshot.average_platelet_count),
            'average_hemoglobin': float(snapshot.average_hemoglobin),
            'high_severity_percentage': float(snapshot.high_severity_percentage),
            'disease_distribution': snapshot.disease_distribution or {}
        }


class FederatedRoundView(APIView):
    """View to list or create federated rounds."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            status_filter = request.query_params.get('status')
            if status_filter:
                rounds = FederatedRound.objects.filter(status=status_filter).order_by('-started_at')
            else:
                rounds = FederatedRound.objects.order_by('-started_at')
            serializer = FederatedRoundSerializer(rounds, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error listing federated rounds: {str(e)}")
            return error_response(
                "Failed to list federated rounds",
                "An internal error occurred while listing federated rounds.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]

    def post(self, request):
        try:
            if request.user.role != 'DISTRICT_ADMIN':
                return error_response(
                    "Access denied",
                    "Only district administrators can start a federated round.",
                    status_code=status.HTTP_403_FORBIDDEN
                )[0]

            round_id = request.data.get('round_id')
            participants = request.data.get('participants', [])

            if not round_id:
                return error_response(
                    "Missing parameter",
                    "round_id is required.",
                    status_code=status.HTTP_400_BAD_REQUEST
                )[0]

            # Check if round already exists
            if FederatedRound.objects.filter(round_id=round_id).first():
                return error_response(
                    "Invalid round_id",
                    "A round with this ID already exists.",
                    status_code=status.HTTP_400_BAD_REQUEST
                )[0]

            federated_round = FederatedRound.objects.create(
                round_id=int(round_id),
                status='STARTED',
                participants=participants,
                started_at=datetime.utcnow()
            )
            serializer = FederatedRoundSerializer(federated_round)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Error starting federated round: {str(e)}")
            return error_response(
                "Failed to start federated round",
                "An internal error occurred while starting the federated round.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]


class FederatedClientUpdateView(APIView):
    """View to list or submit federated client updates."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            round_id = request.query_params.get('round_id')
            phc_id = request.query_params.get('phc_id')
            
            query = {}
            if round_id:
                query['round_id'] = int(round_id)
            if phc_id:
                # Standard validation check: PHC users can only see their own updates
                if request.user.role == 'PHC_USER' and request.user.phc_id != phc_id:
                    return error_response(
                        "Access denied",
                        "You can only view model updates from your own PHC.",
                        status_code=status.HTTP_403_FORBIDDEN
                    )[0]
                query['phc_id'] = phc_id
            elif request.user.role == 'PHC_USER':
                query['phc_id'] = request.user.phc_id

            updates = FederatedClientUpdate.objects.filter(**query).order_by('-created_at')
            serializer = FederatedClientUpdateSerializer(updates, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error listing client updates: {str(e)}")
            return error_response(
                "Failed to list client updates",
                "An internal error occurred while listing client updates.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]

    def post(self, request):
        try:
            round_id = request.data.get('round_id')
            phc_id = request.data.get('phc_id')
            sample_count = request.data.get('sample_count')
            local_model_version = request.data.get('local_model_version')
            parameters = request.data.get('parameters')
            metrics = request.data.get('metrics', {})

            # Validation checks
            if round_id is None or not phc_id or sample_count is None or local_model_version is None or parameters is None:
                return error_response(
                    "Missing parameters",
                    "round_id, phc_id, sample_count, local_model_version, and parameters are required.",
                    status_code=status.HTTP_400_BAD_REQUEST
                )[0]

            # Enforce: PHC user can only submit for their own PHC
            if request.user.role == 'PHC_USER' and request.user.phc_id != phc_id:
                return error_response(
                    "Access denied",
                    "You can only submit model updates for your own PHC.",
                    status_code=status.HTTP_403_FORBIDDEN
                )[0]

            # Validate active round and participation
            federated_round = FederatedRound.objects.filter(round_id=int(round_id)).first()
            if not federated_round:
                return error_response(
                    "Invalid round",
                    "The specified federated round does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND
                )[0]

            if federated_round.status not in ['STARTED', 'IN_PROGRESS']:
                return error_response(
                    "Inactive round",
                    "This federated round is no longer active.",
                    status_code=status.HTTP_400_BAD_REQUEST
                )[0]

            if federated_round.participants and phc_id not in federated_round.participants:
                return error_response(
                    "Non-participant",
                    "This PHC is not a participant in the current federated round.",
                    status_code=status.HTTP_400_BAD_REQUEST
                )[0]

            # Create or update submission
            update = FederatedClientUpdate.objects.filter(round_id=int(round_id), phc_id=phc_id).first()
            if update:
                update.sample_count = int(sample_count)
                update.local_model_version = int(local_model_version)
                update.parameters = parameters
                update.metrics = metrics
                update.created_at = datetime.utcnow()
                update.save()
            else:
                update = FederatedClientUpdate.objects.create(
                    round_id=int(round_id),
                    phc_id=phc_id,
                    sample_count=int(sample_count),
                    local_model_version=int(local_model_version),
                    parameters=parameters,
                    metrics=metrics,
                    created_at=datetime.utcnow()
                )

            serializer = FederatedClientUpdateSerializer(update)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Error submitting client update: {str(e)}")
            return error_response(
                "Failed to submit update",
                "An internal error occurred while submitting client update.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]


class GlobalModelVersionView(APIView):
    """View to list or retrieve global model versions."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            version = request.query_params.get('version')
            if version:
                models = GlobalModelVersion.objects.filter(version=int(version))
            else:
                models = GlobalModelVersion.objects.order_by('-version')
            serializer = GlobalModelVersionSerializer(models, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error listing global model versions: {str(e)}")
            return error_response(
                "Failed to list global model versions",
                "An internal error occurred while listing global model versions.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]


class ModelEvaluationResultView(APIView):
    """View to retrieve or log model evaluation results."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            model_version = request.query_params.get('model_version_string')
            phc_id = request.query_params.get('phc_id')
            
            query = {}
            if model_version:
                query['model_version_string'] = model_version
            if phc_id:
                if request.user.role == 'PHC_USER' and request.user.phc_id != phc_id:
                    return error_response(
                        "Access denied",
                        "You can only view evaluation results from your own PHC.",
                        status_code=status.HTTP_403_FORBIDDEN
                    )[0]
                query['phc_id'] = phc_id
            elif request.user.role == 'PHC_USER':
                query['phc_id'] = request.user.phc_id

            results = ModelEvaluationResult.objects.filter(**query).order_by('-evaluated_at')
            serializer = ModelEvaluationResultSerializer(results, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error listing evaluation results: {str(e)}")
            return error_response(
                "Failed to list evaluation results",
                "An internal error occurred while listing evaluation results.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]

    def post(self, request):
        try:
            model_type = request.data.get('model_type')
            model_version_string = request.data.get('model_version_string')
            phc_id = request.data.get('phc_id')
            accuracy = request.data.get('accuracy')
            precision = request.data.get('precision', 0.0)
            recall = request.data.get('recall', 0.0)
            f1_score = request.data.get('f1_score', 0.0)
            roc_auc = request.data.get('roc_auc')
            confusion_matrix = request.data.get('confusion_matrix', [])
            classification_report = request.data.get('classification_report', {})
            sample_count = request.data.get('sample_count')

            if not model_type or not model_version_string or not phc_id or accuracy is None or sample_count is None:
                return error_response(
                    "Missing parameters",
                    "model_type, model_version_string, phc_id, accuracy, and sample_count are required.",
                    status_code=status.HTTP_400_BAD_REQUEST
                )[0]

            if request.user.role == 'PHC_USER' and request.user.phc_id != phc_id:
                return error_response(
                    "Access denied",
                    "You can only submit evaluation results for your own PHC.",
                    status_code=status.HTTP_403_FORBIDDEN
                )[0]

            result = ModelEvaluationResult.objects.create(
                model_type=model_type,
                model_version_string=model_version_string,
                phc_id=phc_id,
                accuracy=float(accuracy),
                precision=float(precision),
                recall=float(recall),
                f1_score=float(f1_score),
                roc_auc=float(roc_auc) if roc_auc is not None else None,
                confusion_matrix=confusion_matrix,
                classification_report=classification_report,
                sample_count=int(sample_count),
                evaluated_at=datetime.utcnow()
            )
            serializer = ModelEvaluationResultSerializer(result)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Error creating evaluation result: {str(e)}")
            return error_response(
                "Failed to log evaluation result",
                "An internal error occurred while logging the evaluation result.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]


class DiseasePredictionView(APIView):
    """API endpoint to obtain disease prediction from the global model."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            if request.user.role not in ['PHC_USER', 'DISTRICT_ADMIN', 'SURVEILLANCE_OFFICER']:
                return error_response(
                    "Access denied",
                    "Unauthorized to run prediction models.",
                    status_code=status.HTTP_403_FORBIDDEN
                )[0]

            clinical_features = request.data.get('clinical_features')
            model_version = request.data.get('model_version')

            if not clinical_features:
                return error_response(
                    "Missing parameter",
                    "clinical_features object is required.",
                    status_code=status.HTTP_400_BAD_REQUEST
                )[0]

            # Validate input types and ranges
            required_features = [
                'fever', 'cough', 'fatigue', 'headache', 'vomiting', 'breathlessness',
                'temperature_c', 'heart_rate', 'bp_systolic', 'wbc_count', 'platelet_count', 'hemoglobin'
            ]
            for f in required_features:
                if f not in clinical_features:
                    return error_response(
                        "Validation error",
                        f"Missing required clinical feature: {f}",
                        status_code=status.HTTP_400_BAD_REQUEST
                    )[0]
                try:
                    float(clinical_features[f])
                except (ValueError, TypeError):
                    return error_response(
                        "Validation error",
                        f"Invalid numeric value for clinical feature: {f}",
                        status_code=status.HTTP_400_BAD_REQUEST
                    )[0]

            # Validate range values
            try:
                temp = float(clinical_features.get('temperature_c'))
                if temp < 30.0 or temp > 45.0:
                    return error_response("Validation error", "Temperature must be between 30.0 and 45.0 Celsius.", status_code=status.HTTP_400_BAD_REQUEST)[0]
                
                hr = int(float(clinical_features.get('heart_rate')))
                if hr < 30 or hr > 250:
                    return error_response("Validation error", "Heart rate must be between 30 and 250 BPM.", status_code=status.HTTP_400_BAD_REQUEST)[0]
                
                bp = int(float(clinical_features.get('bp_systolic')))
                if bp < 50 or bp > 250:
                    return error_response("Validation error", "Systolic BP must be between 50 and 250 mmHg.", status_code=status.HTTP_400_BAD_REQUEST)[0]

                wbc = int(float(clinical_features.get('wbc_count')))
                if wbc < 0 or wbc > 100000:
                    return error_response("Validation error", "WBC count must be between 0 and 100,000 cells/µL.", status_code=status.HTTP_400_BAD_REQUEST)[0]

                platelet = int(float(clinical_features.get('platelet_count')))
                if platelet < 0 or platelet > 1000000:
                    return error_response("Validation error", "Platelet count must be between 0 and 1,000,000 cells/µL.", status_code=status.HTTP_400_BAD_REQUEST)[0]

                hb = float(clinical_features.get('hemoglobin'))
                if hb < 0.0 or hb > 25.0:
                    return error_response("Validation error", "Hemoglobin must be between 0.0 and 25.0 g/dL.", status_code=status.HTTP_400_BAD_REQUEST)[0]
            except (ValueError, TypeError) as e:
                return error_response("Validation error", "Invalid format for numeric values.", status_code=status.HTTP_400_BAD_REQUEST)[0]

            from api.ml_utils import predict_disease_global
            result = predict_disease_global(clinical_features, global_model_version=model_version)

            if "error" in result:
                return error_response(
                    "Prediction failed",
                    result["error"],
                    status_code=status.HTTP_400_BAD_REQUEST
                )[0]

            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error executing prediction layer: {str(e)}")
            return error_response(
                "Prediction failed",
                "An internal error occurred while running the disease prediction model.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]


class NonIIDAnalysisView(APIView):
    """API endpoint to run or fetch Non-IID heterogeneity analysis results."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            if request.user.role not in ['DISTRICT_ADMIN', 'SURVEILLANCE_OFFICER']:
                return error_response(
                    "Access denied",
                    "Only district administrators or surveillance officers can view statistical heterogeneity analyses.",
                    status_code=status.HTTP_403_FORBIDDEN
                )[0]

            latest = NonIIDAnalysisResult.objects.order_by('-analysis_version').first()
            if not latest:
                from api.non_iid_analyzer import run_non_iid_analysis
                latest = run_non_iid_analysis()
                if not latest:
                    return error_response(
                        "No data available",
                        "Cannot compute statistics because the patient database is empty.",
                        status_code=status.HTTP_404_NOT_FOUND
                    )[0]

            return Response({
                "analysis_version": latest.analysis_version,
                "created_at": latest.created_at.isoformat(),
                "phc_metrics": latest.phc_metrics,
                "global_divergences": latest.global_divergences,
                "pairwise_divergences": latest.pairwise_divergences
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error fetching Non-IID analysis: {str(e)}")
            return error_response(
                "Analysis failed",
                "An internal error occurred while fetching statistical heterogeneity analysis.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]

    def post(self, request):
        try:
            if request.user.role != 'DISTRICT_ADMIN':
                return error_response(
                    "Access denied",
                    "Only district administrators can trigger a Non-IID analysis.",
                    status_code=status.HTTP_403_FORBIDDEN
                )[0]

            from api.non_iid_analyzer import run_non_iid_analysis
            latest = run_non_iid_analysis()
            if not latest:
                return error_response(
                    "Analysis failed",
                    "Cannot run analysis because the patient database is empty.",
                    status_code=status.HTTP_400_BAD_REQUEST
                )[0]

            return Response({
                "message": "Non-IID analysis completed successfully.",
                "analysis_version": latest.analysis_version
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Error triggering Non-IID analysis: {str(e)}")
            return error_response(
                "Analysis failed",
                "An internal error occurred while computing statistical heterogeneity analysis.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]


from api.models import HealthAlert, PHCRelationship

class PHCActiveAlertsView(APIView):
    """Retrieve active (non-resolved) health alerts for the logged-in PHC."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            if request.user.role != 'PHC_USER':
                return error_response(
                    "Only PHC users can access their alerts.",
                    status_code=status.HTTP_403_FORBIDDEN
                )[0]

            phc_id = request.user.phc_id
            alerts = HealthAlert.objects.filter(
                target_phc=phc_id,
                status__ne='RESOLVED'
            ).order_by('-created_at')

            serialized = [{
                'id': str(a.id),
                'alert_type': a.alert_type,
                'disease': a.disease,
                'source_phc': a.source_phc,
                'target_phc': a.target_phc,
                'severity': a.severity,
                'current_incidence': a.current_incidence,
                'baseline_incidence': a.baseline_incidence,
                'change_percentage': a.change_percentage,
                'message': a.message,
                'recommended_action': a.recommended_action,
                'created_at': a.created_at.isoformat(),
                'status': a.status,
                'created_by': a.created_by,
                'detection_method': a.detection_method
            } for a in alerts]

            return Response({
                'alerts': serialized,
                'count': len(serialized)
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error retrieving active alerts: {str(e)}")
            return error_response(
                "Retrieval failed",
                "An internal error occurred while retrieving alerts.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]

class HealthAlertDetailView(APIView):
    """Retrieve details of a single health alert."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, alert_id):
        try:
            try:
                alert = HealthAlert.objects.get(id=alert_id)
            except (HealthAlert.DoesNotExist, Exception):
                return error_response(
                    "Alert not found",
                    status_code=status.HTTP_404_NOT_FOUND
                )[0]

            # Role check - PHC can only see their own alerts
            if request.user.role == 'PHC_USER' and alert.target_phc != request.user.phc_id:
                return error_response(
                    "Access denied",
                    status_code=status.HTTP_403_FORBIDDEN
                )[0]

            serialized = {
                'id': str(alert.id),
                'alert_type': alert.alert_type,
                'disease': alert.disease,
                'source_phc': alert.source_phc,
                'target_phc': alert.target_phc,
                'severity': alert.severity,
                'current_incidence': alert.current_incidence,
                'baseline_incidence': alert.baseline_incidence,
                'change_percentage': alert.change_percentage,
                'message': alert.message,
                'recommended_action': alert.recommended_action,
                'created_at': alert.created_at.isoformat(),
                'acknowledged_at': alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
                'resolved_at': alert.resolved_at.isoformat() if alert.resolved_at else None,
                'status': alert.status,
                'created_by': alert.created_by,
                'detection_method': alert.detection_method
            }

            return Response(serialized, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error retrieving alert detail: {str(e)}")
            return error_response(
                "Retrieval failed",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]

class HealthAlertAcknowledgeView(APIView):
    """Acknowledge an active health alert."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, alert_id):
        try:
            try:
                alert = HealthAlert.objects.get(id=alert_id)
            except (HealthAlert.DoesNotExist, Exception):
                return error_response(
                    "Alert not found",
                    status_code=status.HTTP_404_NOT_FOUND
                )[0]

            # Only target PHC can acknowledge
            if request.user.role == 'PHC_USER' and alert.target_phc != request.user.phc_id:
                return error_response(
                    "Access denied",
                    status_code=status.HTTP_403_FORBIDDEN
                )[0]

            alert.status = 'ACKNOWLEDGED'
            alert.acknowledged_at = datetime.utcnow()
            alert.save()

            return Response({
                'message': 'Alert acknowledged successfully.',
                'status': 'ACKNOWLEDGED'
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error acknowledging alert: {str(e)}")
            return error_response(
                "Acknowledgment failed",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]

class HealthAlertResolveView(APIView):
    """Resolve an active health alert."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, alert_id):
        try:
            if request.user.role not in ['DISTRICT_ADMIN', 'SURVEILLANCE_OFFICER']:
                return error_response(
                    "Access denied",
                    status_code=status.HTTP_403_FORBIDDEN
                )[0]

            try:
                alert = HealthAlert.objects.get(id=alert_id)
            except (HealthAlert.DoesNotExist, Exception):
                return error_response(
                    "Alert not found",
                    status_code=status.HTTP_404_NOT_FOUND
                )[0]

            alert.status = 'RESOLVED'
            alert.resolved_at = datetime.utcnow()
            alert.save()

            return Response({
                'message': 'Alert resolved successfully.',
                'status': 'RESOLVED'
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error resolving alert: {str(e)}")
            return error_response(
                "Resolution failed",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]

class DistrictAlertsListView(APIView):
    """Retrieve all health alerts (active and resolved) across all PHCs."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            if request.user.role not in ['DISTRICT_ADMIN', 'SURVEILLANCE_OFFICER']:
                return error_response(
                    "Access denied",
                    status_code=status.HTTP_403_FORBIDDEN
                )[0]

            alerts = HealthAlert.objects.all().order_by('-created_at')
            serialized = [{
                'id': str(a.id),
                'alert_type': a.alert_type,
                'disease': a.disease,
                'source_phc': a.source_phc,
                'target_phc': a.target_phc,
                'severity': a.severity,
                'current_incidence': a.current_incidence,
                'baseline_incidence': a.baseline_incidence,
                'change_percentage': a.change_percentage,
                'message': a.message,
                'recommended_action': a.recommended_action,
                'created_at': a.created_at.isoformat(),
                'acknowledged_at': a.acknowledged_at.isoformat() if a.acknowledged_at else None,
                'resolved_at': a.resolved_at.isoformat() if a.resolved_at else None,
                'status': a.status,
                'created_by': a.created_by,
                'detection_method': a.detection_method
            } for a in alerts]

            return Response({
                'alerts': serialized,
                'count': len(serialized)
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error retrieving district alerts: {str(e)}")
            return error_response(
                "Retrieval failed",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]

class DistrictAdminAdvisoryView(APIView):
    """Create manual health advisories from District Admin."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            if request.user.role not in ['DISTRICT_ADMIN', 'SURVEILLANCE_OFFICER']:
                return error_response(
                    "Access denied",
                    status_code=status.HTTP_403_FORBIDDEN
                )[0]

            disease = request.data.get('disease')
            severity = request.data.get('severity', 'MEDIUM')
            target_phcs = request.data.get('target_phcs', [])
            message = request.data.get('message')
            recommended_action = request.data.get('recommended_action', '')

            if not disease or not message or not target_phcs:
                return error_response(
                    "Missing parameters",
                    "disease, message, and target_phcs list are required.",
                    status_code=status.HTTP_400_BAD_REQUEST
                )[0]

            created_count = 0
            for phc_id in target_phcs:
                advisory_msg = (
                    f"DISTRICT ADMIN ADVISORY\n\n"
                    f"Topic:\n{disease}\n\n"
                    f"Message:\n{message}\n\n"
                    f"Recommended Action:\n{recommended_action or 'N/A'}"
                )
                
                HealthAlert.objects.create(
                    alert_type='DISTRICT_ADVISORY',
                    disease=disease,
                    source_phc=None,
                    target_phc=phc_id,
                    severity=severity,
                    message=advisory_msg,
                    recommended_action=recommended_action,
                    status='NEW',
                    created_by=request.user.username,
                    detection_method='manual'
                )
                created_count += 1

            return Response({
                'message': f'Manual advisory sent to {created_count} PHC(s).',
                'count': created_count
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Error creating advisory: {str(e)}")
            return error_response(
                "Advisory creation failed",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]

class TriggerSurveillanceDetectionView(APIView):
    """Trigger automated disease surveillance assessment cycle."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            if request.user.role not in ['DISTRICT_ADMIN', 'SURVEILLANCE_OFFICER']:
                return error_response(
                    "Access denied",
                    status_code=status.HTTP_403_FORBIDDEN
                )[0]

            from api.surveillance_service import run_surveillance_detection
            result = run_surveillance_detection()
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error triggering detection cycle: {str(e)}")
            return error_response(
                "Trigger failed",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )[0]


class PHCListView(APIView):
    """Retrieve all PHC configurations."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            if request.user.role not in ['DISTRICT_ADMIN', 'SURVEILLANCE_OFFICER']:
                return error_response(
                    "Access denied",
                    status_code=status.HTTP_403_FORBIDDEN
                )[0]

            phcs = PHC.objects.all().order_by('name')
            serialized = [{
                'phc_id': p.name,
                'phc_name': p.phc_name,
                'city': p.city,
                'district': p.district_id,
                'latitude': p.latitude,
                'longitude': p.longitude,
                'email': p.email,
                'updated_at': p.updated_at.isoformat()
            } for p in phcs]

            return Response({'phcs': serialized, 'count': len(serialized)}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error listing PHCs: {str(e)}")
            return error_response("Failed to list PHCs", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)[0]


class PHCUpdateView(APIView):
    """API for authorized administrators to update PHC configuration."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def put(self, request, phc_id):
        from mongoengine.errors import ValidationError
        try:
            # Authorization check: only DISTRICT_ADMIN is authorized to edit PHC settings
            if request.user.role != 'DISTRICT_ADMIN':
                return error_response(
                    "Only district administrators can edit PHC configurations.",
                    status_code=status.HTTP_403_FORBIDDEN
                )[0]

            phc = PHC.objects.filter(name=phc_id).first()
            if not phc:
                return error_response(
                    f"PHC with id '{phc_id}' not found.",
                    status_code=status.HTTP_404_NOT_FOUND
                )[0]

            # Allowed update fields
            phc_name = request.data.get('phc_name')
            city = request.data.get('city')
            district = request.data.get('district') # maps to district_id
            latitude = request.data.get('latitude')
            longitude = request.data.get('longitude')
            email = request.data.get('email')

            # We can handle empty values as None / null when empty strings are passed
            if phc_name is not None:
                phc.phc_name = phc_name.strip() if phc_name.strip() != "" else None
            if city is not None:
                if city.strip() == "":
                    return error_response("City cannot be empty.")[0]
                phc.city = city.strip()
            if district is not None:
                if district.strip() == "":
                    return error_response("District cannot be empty.")[0]
                phc.district_id = district.strip()

            if latitude is not None:
                if latitude == "" or latitude is None:
                    phc.latitude = None
                else:
                    try:
                        phc.latitude = float(latitude)
                    except (ValueError, TypeError):
                        return error_response("Latitude must be a numeric value.")[0]

            if longitude is not None:
                if longitude == "" or longitude is None:
                    phc.longitude = None
                else:
                    try:
                        phc.longitude = float(longitude)
                    except (ValueError, TypeError):
                        return error_response("Longitude must be a numeric value.")[0]

            if email is not None:
                if email.strip() == "":
                    phc.email = None
                else:
                    phc.email = email.strip()

            # Save and run write-time validation (via clean())
            try:
                phc.save()
            except ValidationError as ve:
                return error_response("Validation failed", details=str(ve))[0]

            return Response({
                'status': 'success',
                'phc': {
                    'phc_id': phc.name,
                    'phc_name': phc.phc_name,
                    'city': phc.city,
                    'district': phc.district_id,
                    'latitude': phc.latitude,
                    'longitude': phc.longitude,
                    'email': phc.email,
                    'updated_at': phc.updated_at.isoformat()
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error updating PHC {phc_id}: {str(e)}")
            return error_response("Failed to update PHC settings", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)[0]


