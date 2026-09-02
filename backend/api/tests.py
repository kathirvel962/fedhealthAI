"""
FedHealthAI - Unit Test Suite

Tests core functionality:
- Authentication (register, login)
- Patient submission
- Alerts retrieval
- Dashboard metrics
- Local model metadata
- Health check
"""

import json
from datetime import datetime, timezone
from django.test import TestCase, Client
from api.models import User, Patient, LocalModel, GlobalModel, Alert, PHC, FederatedRound, FederatedClientUpdate, GlobalModelVersion, ModelEvaluationResult, NonIIDAnalysisResult, HealthAlert, PHCRelationship
from rest_framework import status
from api.authentication import hash_password, generate_token


def clear_collections():
    """Clear all MongoDB collections for a clean test state."""
    User.objects.delete()
    Patient.objects.delete()
    LocalModel.objects.delete()
    GlobalModel.objects.delete()
    Alert.objects.delete()
    PHC.objects.delete()
    FederatedRound.objects.delete()
    FederatedClientUpdate.objects.delete()
    GlobalModelVersion.objects.delete()
    ModelEvaluationResult.objects.delete()
    HealthAlert.objects.delete()
    PHCRelationship.objects.delete()


class AuthenticationTests(TestCase):
    """Test authentication endpoints."""
    
    def setUp(self):
        clear_collections()
        self.client = Client()
        self.register_url = '/api/auth/register/'
        self.login_url = '/api/auth/login/'
        
        # Seed PHC for registration
        PHC.objects.create(name='PHC_1', district_id='Coimbatore', city='Pollachi')
    
    def tearDown(self):
        clear_collections()
    
    def test_user_registration(self):
        """Test successful user registration."""
        data = {
            'username': 'test_user',
            'password': 'testpass123',
            'role': 'PHC_USER',
            'phc_id': 'PHC_1'
        }
        response = self.client.post(
            self.register_url,
            data=json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('token', response.json())
        self.assertIn('user', response.json())
    
    def test_user_login(self):
        """Test successful user login."""
        # Register first
        register_data = {
            'username': 'test_user',
            'password': 'testpass123',
            'role': 'PHC_USER',
            'phc_id': 'PHC_1'
        }
        self.client.post(
            self.register_url,
            data=json.dumps(register_data),
            content_type='application/json'
        )
        
        # Login
        login_data = {
            'username': 'test_user',
            'password': 'testpass123'
        }
        response = self.client.post(
            self.login_url,
            data=json.dumps(login_data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('token', response.json())
    
    def test_invalid_login(self):
        """Test login with invalid credentials."""
        login_data = {
            'username': 'nonexistent',
            'password': 'wrongpass'
        }
        response = self.client.post(
            self.login_url,
            data=json.dumps(login_data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class PatientManagementTests(TestCase):
    """Test patient submission and retrieval."""
    
    def setUp(self):
        clear_collections()
        self.client = Client()
        
        # Create test PHC
        PHC.objects.create(name='PHC_1', district_id='Coimbatore', city='Pollachi')
        
        # Create a test PHC user
        self.user = User.objects.create(
            username='phc_user',
            password_hash='hashed_password',
            role='PHC_USER',
            phc_id='PHC_1'
        )
        
        # Get login token
        from api.authentication import generate_token
        self.token = generate_token(str(self.user.id))
    
    def tearDown(self):
        clear_collections()
    
    def test_patient_submission(self):
        """Test patient submission endpoint."""
        data = {
            'age': 35,
            'gender': 'Male',
            'fever': 1,
            'cough': 0,
            'fatigue': 0,
            'headache': 0,
            'vomiting': 0,
            'breathlessness': 0,
            'temperature_c': 37.5,
            'heart_rate': 80,
            'bp_systolic': 120,
            'wbc_count': 7500,
            'platelet_count': 250000,
            'hemoglobin': 14.5,
            'disease_label': 'Viral Fever',
            'severity_level': 'Low'
        }
        response = self.client.post(
            '/api/phc/patient/',
            data=json.dumps(data),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.token}'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('patient_id', response.json())
    
    def test_patient_retrieval(self):
        """Test retrieving patients for a PHC."""
        # Submit a patient first
        Patient.objects.create(
            patient_id='P99999',
            phc_id='PHC_1',
            city='Pollachi',
            age=35,
            gender='Male',
            fever=1,
            cough=0,
            fatigue=0,
            headache=0,
            vomiting=0,
            breathlessness=0,
            temperature_c=37.5,
            heart_rate=80,
            bp_systolic=120,
            wbc_count=7500,
            platelet_count=250000,
            hemoglobin=14.5,
            disease_label='Viral Fever',
            severity_level='Low'
        )
        
        response = self.client.get(
            '/api/phc/patients/',
            HTTP_AUTHORIZATION=f'Bearer {self.token}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('patients', response.json())


class AlertsTests(TestCase):
    """Test alert retrieval."""
    
    def setUp(self):
        clear_collections()
        self.client = Client()
        
        # Create surveillance officer
        self.officer = User.objects.create(
            username='officer_user',
            password_hash='hashed_password',
            role='SURVEILLANCE_OFFICER',
            phc_id=None
        )
        
        from api.authentication import generate_token
        self.officer_token = generate_token(str(self.officer.id))
    
    def tearDown(self):
        clear_collections()
    
    def test_alerts_retrieval(self):
        """Test alerts endpoint."""
        response = self.client.get(
            '/api/surveillance/alerts/',
            HTTP_AUTHORIZATION=f'Bearer {self.officer_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('alerts', response.json())


class DashboardTests(TestCase):
    """Test dashboard endpoints."""
    
    def setUp(self):
        clear_collections()
        self.client = Client()
        
        # Seed PHC
        PHC.objects.create(name='PHC_1', district_id='Coimbatore', city='Pollachi')
        
        # Create PHC user
        self.phc_user = User.objects.create(
            username='phc_user',
            password_hash='hashed_password',
            role='PHC_USER',
            phc_id='PHC_1'
        )
        
        # Create admin
        self.admin = User.objects.create(
            username='admin_user',
            password_hash='hashed_password',
            role='DISTRICT_ADMIN',
            phc_id=None
        )
        
        from api.authentication import generate_token
        self.phc_token = generate_token(str(self.phc_user.id))
        self.admin_token = generate_token(str(self.admin.id))
    
    def tearDown(self):
        clear_collections()
    
    def test_phc_dashboard(self):
        """Test PHC dashboard endpoint."""
        response = self.client.get(
            '/api/dashboards/phc/',
            HTTP_AUTHORIZATION=f'Bearer {self.phc_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        resp_data = response.json()
        self.assertIn('phc_id', resp_data)
        self.assertIn('model', resp_data)
        self.assertIn('risk', resp_data)
    
    def test_district_dashboard(self):
        """Test district dashboard endpoint."""
        response = self.client.get(
            '/api/dashboards/district/',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        resp_data = response.json()
        self.assertIn('global_model', resp_data)
        self.assertIn('phc_breakdown', resp_data)


class LocalModelTests(TestCase):
    """Test local model serialization and storage."""
    
    def setUp(self):
        clear_collections()
        
    def tearDown(self):
        clear_collections()
        
    def test_local_model_metrics(self):
        """Test that local model metrics are stored correctly."""
        lm = LocalModel.objects.create(
            phc_id='PHC_1',
            version=1,
            version_string='local_PHC_1_v1',
            accuracy=0.85,
            precision=0.80,
            recall=0.82,
            f1_score=0.81,
            weights={'model_type': 'xgboost_classifier', 'features': ['fever', 'cough']},
            sample_count=100
        )
        
        self.assertEqual(lm.phc_id, 'PHC_1')
        self.assertEqual(lm.version, 1)
        self.assertEqual(lm.accuracy, 0.85)
        self.assertEqual(lm.sample_count, 100)


class HealthCheckTests(TestCase):
    """Test health check endpoint."""
    
    def setUp(self):
        clear_collections()
        self.client = Client()
        
    def tearDown(self):
        clear_collections()
    
    def test_health_check(self):
        """Test health check endpoint."""
        response = self.client.get('/health/')
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_503_SERVICE_UNAVAILABLE])
        self.assertIn('status', response.json())
        self.assertIn('database', response.json())


class FederatedLearningDataLayerTests(TestCase):
    """Test federated learning data model layer models and API endpoints."""

    def setUp(self):
        clear_collections()
        self.client = Client()

        # Create demo users
        self.admin_user = User.objects.create(
            username='admin',
            password_hash=hash_password('password'),
            role='DISTRICT_ADMIN'
        )
        self.phc1_user = User.objects.create(
            username='phc_1_user',
            password_hash=hash_password('password'),
            role='PHC_USER',
            phc_id='PHC_1'
        )
        self.phc2_user = User.objects.create(
            username='phc_2_user',
            password_hash=hash_password('password'),
            role='PHC_USER',
            phc_id='PHC_2'
        )

        # Login and get tokens
        self.admin_token = generate_token(self.admin_user.id)
        self.phc1_token = generate_token(self.phc1_user.id)
        self.phc2_token = generate_token(self.phc2_user.id)

    def tearDown(self):
        clear_collections()

    def test_round_creation_and_validation(self):
        """Test starting a federated round via API and validating fields."""
        # Non-admin user cannot start round
        response = self.client.post(
            '/api/fl/rounds/',
            data=json.dumps({'round_id': 1, 'participants': ['PHC_1', 'PHC_2']}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.phc1_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Admin starts round successfully
        response = self.client.post(
            '/api/fl/rounds/',
            data=json.dumps({'round_id': 1, 'participants': ['PHC_1', 'PHC_2']}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()['round_id'], 1)
        self.assertEqual(response.json()['status'], 'STARTED')
        self.assertEqual(response.json()['participants'], ['PHC_1', 'PHC_2'])

        # Duplicate round_id fails
        response = self.client.post(
            '/api/fl/rounds/',
            data=json.dumps({'round_id': 1, 'participants': ['PHC_3']}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_client_update_submission_and_phc_participation(self):
        """Test submitting local parameters, validating participation, and active status."""
        # Start a round with PHC_1 as the only participant
        FederatedRound.objects.create(
            round_id=2,
            status='STARTED',
            participants=['PHC_1'],
            started_at=datetime.utcnow()
        )

        update_payload = {
            'round_id': 2,
            'phc_id': 'PHC_2',  # PHC_2 trying to submit (non-participant)
            'sample_count': 120,
            'local_model_version': 1,
            'parameters': {'weights': [0.1, -0.2, 0.5]},
            'metrics': {'accuracy': 0.88}
        }

        # Non-participant submission fails
        response = self.client.post(
            '/api/fl/updates/',
            data=json.dumps(update_payload),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.phc2_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Participant PHC_1 submits successfully
        update_payload['phc_id'] = 'PHC_1'
        response = self.client.post(
            '/api/fl/updates/',
            data=json.dumps(update_payload),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.phc1_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()['phc_id'], 'PHC_1')
        self.assertEqual(response.json()['parameters'], {'weights': [0.1, -0.2, 0.5]})

        # Submitting to an inactive/completed round fails
        inactive_round = FederatedRound.objects.create(
            round_id=3,
            status='COMPLETED',
            participants=['PHC_1'],
            started_at=datetime.utcnow()
        )
        update_payload['round_id'] = 3
        response = self.client.post(
            '/api/fl/updates/',
            data=json.dumps(update_payload),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.phc1_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_global_model_versioning_and_evaluation(self):
        """Test global model version document storage and model evaluations."""
        # Store global version checkpoint
        gmv = GlobalModelVersion.objects.create(
            version=10,
            version_string='global_v10',
            round_id=5,
            accuracy=0.91,
            contributors=['PHC_1', 'PHC_2'],
            parameters={'bias': 0.05, 'weights': [0.2, 0.8]}
        )
        self.assertEqual(gmv.version_string, 'global_v10')
        self.assertEqual(gmv.round_id, 5)

        # Log evaluation result via API
        eval_payload = {
            'model_type': 'GLOBAL',
            'model_version_string': 'global_v10',
            'phc_id': 'PHC_1',
            'accuracy': 0.92,
            'precision': 0.90,
            'recall': 0.91,
            'f1_score': 0.90,
            'confusion_matrix': [[50, 2], [3, 45]],
            'classification_report': {'Dengue': {'f1-score': 0.90, 'precision': 0.91, 'recall': 0.89, 'support': 52}},
            'sample_count': 100
        }
        response = self.client.post(
            '/api/fl/evaluations/',
            data=json.dumps(eval_payload),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.phc1_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()['model_version_string'], 'global_v10')
        self.assertEqual(response.json()['accuracy'], 0.92)

        # Query evaluation results
        response = self.client.get(
            '/api/fl/evaluations/?model_version_string=global_v10',
            HTTP_AUTHORIZATION=f'Bearer {self.phc1_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)

    def test_federated_pipeline_and_fedavg(self):
        """Test the actual federated learning training pipeline and server-side FedAvg parameter aggregation."""
        # Seed patients for PHC_1 and PHC_2 (need at least 10 each to participate)
        for i in range(15):
            Patient.objects.create(
                patient_id=f"P1_TEST_{i}",
                city="Coimbatore",
                phc_id='PHC_1',
                age=25 + i,
                gender='M' if i % 2 == 0 else 'F',
                fever=1 if i % 3 == 0 else 0,
                cough=1 if i % 2 == 0 else 0,
                fatigue=0,
                headache=0,
                vomiting=0,
                breathlessness=0,
                temperature_c=37.5 + (i * 0.1),
                heart_rate=75 + i,
                bp_systolic=120 + i,
                wbc_count=6000 + (i * 100),
                platelet_count=200000 + (i * 1000),
                hemoglobin=14.0 + (i * 0.1),
                disease_label='Healthy' if i % 2 == 0 else 'Viral Fever',
                severity_level='LOW'
            )
            Patient.objects.create(
                patient_id=f"P2_TEST_{i}",
                city="Coimbatore",
                phc_id='PHC_2',
                age=30 + i,
                gender='F' if i % 2 == 0 else 'M',
                fever=1 if i % 2 == 0 else 0,
                cough=1 if i % 3 == 0 else 0,
                fatigue=0,
                headache=0,
                vomiting=0,
                breathlessness=0,
                temperature_c=38.0 + (i * 0.1),
                heart_rate=80 + i,
                bp_systolic=125 + i,
                wbc_count=7000 + (i * 100),
                platelet_count=220000 + (i * 1000),
                hemoglobin=13.5 + (i * 0.1),
                disease_label='Viral Fever' if i % 2 == 0 else 'Healthy',
                severity_level='MEDIUM'
            )

        from api.ml_utils import perform_federated_round, nn_predict, get_latest_global_model
        import numpy as np

        # Run federated round
        round_obj = perform_federated_round(round_id=1, participating_phcs=['PHC_1', 'PHC_2'], epochs=5, lr=0.1)

        # 1. Assert round completed and participants tracked
        self.assertIsNotNone(round_obj)
        self.assertEqual(round_obj.status, 'COMPLETED')
        self.assertEqual(round_obj.round_id, 1)
        self.assertEqual(sorted(round_obj.participants), sorted(['PHC_1', 'PHC_2']))
        self.assertEqual(round_obj.global_model_version, 1)
        self.assertIn('heterogeneity', round_obj.metrics)
        self.assertTrue(0.0 <= round_obj.metrics['heterogeneity'] <= 1.0)

        # 2. Assert client updates are collected in DB
        updates = FederatedClientUpdate.objects.filter(round_id=1)
        self.assertEqual(updates.count(), 2)
        phc_ids_collected = [u.phc_id for u in updates]
        self.assertIn('PHC_1', phc_ids_collected)
        self.assertIn('PHC_2', phc_ids_collected)

        # 3. Assert global model version is created in DB
        gm_version = GlobalModelVersion.objects.filter(version=1).first()
        self.assertIsNotNone(gm_version)
        self.assertEqual(gm_version.round_id, 1)
        self.assertEqual(sorted(gm_version.contributors), sorted(['PHC_1', 'PHC_2']))
        self.assertIn('W1', gm_version.parameters)
        self.assertIn('W2', gm_version.parameters)

        # 4. Assert latest global model can be loaded
        latest_gm = get_latest_global_model()
        self.assertIsNotNone(latest_gm)
        self.assertEqual(latest_gm.version, 1)

        # 5. Assert global model can perform inference
        test_input = np.random.randn(5, 12)  # 5 samples, 12 features
        predictions = nn_predict(test_input, latest_gm.weights)
        self.assertEqual(len(predictions), 5)
        # Class predictions should be in range [0, 5]
        for pred in predictions:
            self.assertTrue(0 <= pred < 6)

    def test_disease_prediction_endpoint_and_validation(self):
        """Test the disease prediction endpoint, input parameter validations, and model outputs."""


        clinical_payload = {
            'clinical_features': {
                'fever': 1,
                'cough': 0,
                'fatigue': 0,
                'headache': 1,
                'vomiting': 0,
                'breathlessness': 0,
                'temperature_c': 38.5,
                'heart_rate': 90,
                'bp_systolic': 120,
                'wbc_count': 8000,
                'platelet_count': 210000,
                'hemoglobin': 14.5
            }
        }

        # 1. Test error returned when no model exists in database
        response = self.client.post(
            '/api/predictions/',
            data=json.dumps(clinical_payload),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.phc1_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('No global model is currently trained/available.', response.json()['details'])

        # Now seed patients and train a global model round
        for i in range(15):
            Patient.objects.create(
                patient_id=f"P1_TEST_{i}",
                city="Coimbatore",
                phc_id='PHC_1',
                age=25 + i,
                gender='M',
                fever=1 if i % 3 == 0 else 0,
                cough=1 if i % 2 == 0 else 0,
                fatigue=0,
                headache=0,
                vomiting=0,
                breathlessness=0,
                temperature_c=37.5,
                heart_rate=80,
                bp_systolic=120,
                wbc_count=7000,
                platelet_count=200000,
                hemoglobin=14.0,
                disease_label='Healthy' if i % 2 == 0 else 'Viral Fever',
                severity_level='LOW'
            )

        from api.ml_utils import perform_federated_round
        perform_federated_round(round_id=1, participating_phcs=['PHC_1'], epochs=1, lr=0.1)

        # 2. Test successful prediction response
        response = self.client.post(
            '/api/predictions/',
            data=json.dumps(clinical_payload),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.phc1_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        res_data = response.json()
        self.assertIn('predicted_disease', res_data)
        self.assertIn('confidence', res_data)
        self.assertIn('class_probabilities', res_data)
        self.assertIn('model_version', res_data)
        self.assertIn('timestamp', res_data)

        # 3. Test missing parameters validation (e.g. fever key removed)
        invalid_payload = {
            'clinical_features': {
                'cough': 0,
                'temperature_c': 38.5,
                'heart_rate': 90
            }
        }
        response = self.client.post(
            '/api/predictions/',
            data=json.dumps(invalid_payload),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.phc1_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Missing required clinical feature', response.json()['details'])

        # 4. Test non-numeric values validation
        invalid_payload = {
            'clinical_features': {
                'fever': 'not-a-number',
                'cough': 0,
                'fatigue': 0,
                'headache': 1,
                'vomiting': 0,
                'breathlessness': 0,
                'temperature_c': 38.5,
                'heart_rate': 90,
                'bp_systolic': 120,
                'wbc_count': 8000,
                'platelet_count': 210000,
                'hemoglobin': 14.5
            }
        }
        response = self.client.post(
            '/api/predictions/',
            data=json.dumps(invalid_payload),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.phc1_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid numeric value for clinical feature', response.json()['details'])

    def test_non_iid_divergence_and_analysis_calculations(self):
        """Test Jensen-Shannon Divergence mathematical behavior and Non-IID analysis services."""
        from api.non_iid_analyzer import jsd, run_non_iid_analysis

        # 1. Test mathematical properties of Jensen-Shannon Divergence (JSD)
        p = [0.2, 0.4, 0.4]
        q = [0.2, 0.4, 0.4]
        self.assertAlmostEqual(jsd(p, q), 0.0)

        # Symmetry property
        p = [0.1, 0.8, 0.1]
        q = [0.3, 0.3, 0.4]
        self.assertAlmostEqual(jsd(p, q), jsd(q, p))

        # Divergence boundaries [0, 1]
        self.assertTrue(0 <= jsd(p, q) <= 1)

        # 2. Test analysis run
        # First seed patients
        Patient.objects.all().delete()
        NonIIDAnalysisResult.objects.all().delete()
        for i in range(10):
            Patient.objects.create(
                patient_id=f"P_NON_IID_{i}",
                city="Coimbatore",
                phc_id='PHC_1',
                age=20 + i * 5,
                gender='Male' if i % 2 == 0 else 'Female',
                fever=1,
                cough=0,
                fatigue=0,
                headache=0,
                vomiting=0,
                breathlessness=0,
                temperature_c=38.0,
                heart_rate=80,
                bp_systolic=120,
                wbc_count=7000,
                platelet_count=200000,
                hemoglobin=14.0,
                disease_label='Dengue' if i % 2 == 0 else 'Malaria',
                severity_level='MEDIUM'
            )

        analysis = run_non_iid_analysis()
        self.assertIsNotNone(analysis)
        self.assertEqual(analysis.analysis_version, 1)

        # Assert metrics structure
        metrics = analysis.phc_metrics['PHC_1']
        self.assertEqual(metrics['sample_count'], 10)
        self.assertIn('disease_distribution', metrics)
        self.assertIn('age_stats', metrics)
        self.assertIn('gender_distribution', metrics)
        self.assertIn('class_imbalance', metrics)
        self.assertIn('missing_value_count', metrics)

        # 3. Test API GET response as District Admin
        response = self.client.get(
            '/api/fl/non-iid/',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['analysis_version'], 1)
        self.assertIn('phc_metrics', response.json())

        # 4. Test API POST response triggers analysis
        response = self.client.post(
            '/api/fl/non-iid/',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()['analysis_version'], 2)


from datetime import timedelta
from api.surveillance_service import run_surveillance_detection

class SurveillanceAlertSystemTests(TestCase):
    """Test suite for the cross-PHC surveillance alert and advisory system."""

    def setUp(self):
        clear_collections()
        self.client = Client()

        # Seed demo users
        self.admin = User.objects.create(
            username='admin_user',
            password_hash=hash_password('password123'),
            role='DISTRICT_ADMIN'
        )
        self.phc1_user = User.objects.create(
            username='phc1_user',
            password_hash=hash_password('password123'),
            role='PHC_USER',
            phc_id='PHC_1'
        )
        self.phc2_user = User.objects.create(
            username='phc2_user',
            password_hash=hash_password('password123'),
            role='PHC_USER',
            phc_id='PHC_2'
        )

        # Generate tokens
        self.admin_token = generate_token(self.admin.id)
        self.phc1_token = generate_token(self.phc1_user.id)
        self.phc2_token = generate_token(self.phc2_user.id)

        # Seed neighbor relationships: PHC_3 is connected to PHC_1. PHC_3 is NOT connected to PHC_2.
        PHCRelationship.objects.create(source_phc='PHC_3', target_phc='PHC_1', distance_km=8.0, active=True)
        PHCRelationship.objects.create(source_phc='PHC_3', target_phc='PHC_2', distance_km=50.0, active=False) # inactive or too far

    def tearDown(self):
        clear_collections()

    def test_normal_disease_activity_no_alert(self):
        """Test that normal disease activity (no increase) does not trigger alerts."""
        now = datetime.utcnow()
        # Seed 10 baseline patients (all Healthy)
        for i in range(10):
            Patient.objects.create(
                patient_id=f"P_B_{i}",
                age=30,
                gender='Male',
                phc_id='PHC_3',
                city='Pollachi',
                fever=0, cough=0, fatigue=0, headache=0, vomiting=0, breathlessness=0,
                temperature_c=36.8, heart_rate=72, bp_systolic=120, wbc_count=6000, platelet_count=200000, hemoglobin=14.0,
                disease_label='Healthy',
                severity_level='Low',
                created_at=now - timedelta(days=20)
            )
        # Seed 10 current patients (all Healthy)
        for i in range(10):
            Patient.objects.create(
                patient_id=f"P_C_{i}",
                age=30,
                gender='Male',
                phc_id='PHC_3',
                city='Pollachi',
                fever=0, cough=0, fatigue=0, headache=0, vomiting=0, breathlessness=0,
                temperature_c=36.8, heart_rate=72, bp_systolic=120, wbc_count=6000, platelet_count=200000, hemoglobin=14.0,
                disease_label='Healthy',
                severity_level='Low',
                created_at=now - timedelta(days=5)
            )

        result = run_surveillance_detection()
        self.assertEqual(result['alerts_created'], 0)
        self.assertEqual(HealthAlert.objects.count(), 0)

    def test_significant_increase_triggers_alert_and_targets_neighbors_only(self):
        """Test that a high relative increase triggers alerts and only notifies neighbor PHCs."""
        now = datetime.utcnow()
        # 1. Seed historical baseline (20 cases, 1 Dengue -> 5% baseline incidence)
        for i in range(19):
            Patient.objects.create(
                patient_id=f"P_B_H_{i}", phc_id='PHC_3', age=30, gender='Male', city='Pollachi',
                fever=0, cough=0, fatigue=0, headache=0, vomiting=0, breathlessness=0,
                temperature_c=36.8, heart_rate=72, bp_systolic=120, wbc_count=6000, platelet_count=200000, hemoglobin=14.0,
                disease_label='Healthy', severity_level='Low', created_at=now - timedelta(days=30)
            )
        Patient.objects.create(
            patient_id="P_B_D_1", phc_id='PHC_3', age=30, gender='Male', city='Pollachi',
            fever=1, cough=0, fatigue=0, headache=0, vomiting=0, breathlessness=0,
            temperature_c=38.9, heart_rate=95, bp_systolic=110, wbc_count=3500, platelet_count=120000, hemoglobin=13.0,
            disease_label='Dengue', severity_level='HIGH', created_at=now - timedelta(days=30)
        )

        # 2. Seed current period (20 cases, 6 Dengue -> 30% current incidence)
        # Increase: +500% (from 5% to 30%)
        for i in range(14):
            Patient.objects.create(
                patient_id=f"P_C_H_{i}", phc_id='PHC_3', age=30, gender='Male', city='Pollachi',
                fever=0, cough=0, fatigue=0, headache=0, vomiting=0, breathlessness=0,
                temperature_c=36.8, heart_rate=72, bp_systolic=120, wbc_count=6000, platelet_count=200000, hemoglobin=14.0,
                disease_label='Healthy', severity_level='Low', created_at=now - timedelta(days=5)
            )
        for i in range(6):
            Patient.objects.create(
                patient_id=f"P_C_D_{i}", phc_id='PHC_3', age=30, gender='Male', city='Pollachi',
                fever=1, cough=0, fatigue=0, headache=0, vomiting=0, breathlessness=0,
                temperature_c=38.9, heart_rate=95, bp_systolic=110, wbc_count=3500, platelet_count=120000, hemoglobin=13.0,
                disease_label='Dengue', severity_level='HIGH', created_at=now - timedelta(days=5)
            )

        result = run_surveillance_detection()
        self.assertEqual(result['alerts_created'], 1)

        # Check neighbor targets
        alerts = list(HealthAlert.objects.all())
        self.assertEqual(len(alerts), 1)
        alert = alerts[0]
        self.assertEqual(alert.target_phc, 'PHC_1')  # Neighbor
        self.assertEqual(alert.disease, 'Dengue')
        self.assertEqual(alert.source_phc, 'PHC_3')
        self.assertEqual(alert.severity, 'CRITICAL')
        self.assertEqual(alert.current_incidence, 30.0)
        self.assertEqual(alert.baseline_incidence, 5.0)
        self.assertEqual(alert.change_percentage, 500.0)
        self.assertNotIn("🚀", alert.message) # No emojis!

        # Check duplicate prevention
        result2 = run_surveillance_detection()
        self.assertEqual(result2['alerts_created'], 0)
        self.assertEqual(result2['alerts_updated'], 1)
        self.assertEqual(HealthAlert.objects.count(), 1)

    def test_insufficient_data_no_alert(self):
        """Test that insufficient data prevents alert generation."""
        now = datetime.utcnow()
        # Seed only 2 cases
        Patient.objects.create(
            patient_id="P_B_1", phc_id='PHC_3', age=30, gender='Male', city='Pollachi',
            fever=1, cough=0, fatigue=0, headache=0, vomiting=0, breathlessness=0,
            temperature_c=38.9, heart_rate=95, bp_systolic=110, wbc_count=3500, platelet_count=120000, hemoglobin=13.0,
            disease_label='Dengue', severity_level='HIGH', created_at=now - timedelta(days=30)
        )
        Patient.objects.create(
            patient_id="P_C_1", phc_id='PHC_3', age=30, gender='Male', city='Pollachi',
            fever=1, cough=0, fatigue=0, headache=0, vomiting=0, breathlessness=0,
            temperature_c=38.9, heart_rate=95, bp_systolic=110, wbc_count=3500, platelet_count=120000, hemoglobin=13.0,
            disease_label='Dengue', severity_level='HIGH', created_at=now - timedelta(days=5)
        )

        result = run_surveillance_detection()
        self.assertEqual(result['alerts_created'], 0)
        self.assertEqual(HealthAlert.objects.count(), 0)

    def test_alert_lifecycle_endpoints(self):
        """Test API visibility, acknowledgment, manual advisories and resolution."""
        # Create a mock alert targetted at PHC_1
        alert = HealthAlert.objects.create(
            alert_type='SURVEILLANCE_ALERT',
            disease='Malaria',
            source_phc='PHC_3',
            target_phc='PHC_1',
            severity='HIGH',
            current_incidence=10.0,
            baseline_incidence=2.0,
            change_percentage=400.0,
            message="Alert message context",
            status='NEW'
        )

        # 1. PHC_1 can view their own alerts
        response = self.client.get(
            '/api/surveillance/my-alerts/',
            HTTP_AUTHORIZATION=f'Bearer {self.phc1_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['count'], 1)

        # 2. PHC_2 cannot view PHC_1's alerts
        response_phc2 = self.client.get(
            '/api/surveillance/my-alerts/',
            HTTP_AUTHORIZATION=f'Bearer {self.phc2_token}'
        )
        self.assertEqual(response_phc2.status_code, status.HTTP_200_OK)
        self.assertEqual(response_phc2.json()['count'], 0) # Returns 0 own alerts

        # 3. PHC_1 can acknowledge their alert
        response_ack = self.client.post(
            f'/api/surveillance/alerts/{alert.id}/acknowledge/',
            HTTP_AUTHORIZATION=f'Bearer {self.phc1_token}'
        )
        self.assertEqual(response_ack.status_code, status.HTTP_200_OK)
        self.assertEqual(response_ack.json()['status'], 'ACKNOWLEDGED')

        # 4. District Admin can send manual advisory targeting PHC_2
        advisory_data = {
            'disease': 'Malaria Prevention',
            'severity': 'MEDIUM',
            'target_phcs': ['PHC_2'],
            'message': 'Please deploy bednets.',
            'recommended_action': 'Distribute information packets.'
        }
        response_adv = self.client.post(
            '/api/surveillance/advisories/',
            data=json.dumps(advisory_data),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(response_adv.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response_adv.json()['count'], 1)

        # Verify PHC_2 now has the advisory alert
        response_phc2_adv = self.client.get(
            '/api/surveillance/my-alerts/',
            HTTP_AUTHORIZATION=f'Bearer {self.phc2_token}'
        )
        self.assertEqual(response_phc2_adv.json()['count'], 1)

        # 5. District Admin can resolve the alerts
        response_resolve = self.client.post(
            f'/api/surveillance/alerts/{alert.id}/resolve/',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(response_resolve.status_code, status.HTTP_200_OK)
        self.assertEqual(response_resolve.json()['status'], 'RESOLVED')

        # Resolved alert should not appear in active own alerts for PHC_1
        response_my_resolved = self.client.get(
            '/api/surveillance/my-alerts/',
            HTTP_AUTHORIZATION=f'Bearer {self.phc1_token}'
        )
        self.assertEqual(response_my_resolved.json()['count'], 0)

    def test_patient_registration_validation(self):
        """Test that PatientSubmitView rejects invalid data boundaries."""
        # 1. Invalid age
        data = {
            'age': 150, 'gender': 'Female', 'temperature_c': 37.0, 'heart_rate': 80,
            'bp_systolic': 120, 'wbc_count': 7000, 'platelet_count': 250000, 'hemoglobin': 14.0,
            'disease_label': 'Viral Fever', 'severity_level': 'Low'
        }
        res = self.client.post('/api/phc/patient/', data=json.dumps(data), content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {self.phc1_token}')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid age", res.json()['error'])

        # 2. Invalid temperature
        data['age'] = 34
        data['temperature_c'] = 25.0
        res = self.client.post('/api/phc/patient/', data=json.dumps(data), content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {self.phc1_token}')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid temperature", res.json()['error'])

        # 3. Invalid negative WBC
        data['temperature_c'] = 37.0
        data['wbc_count'] = -5
        res = self.client.post('/api/phc/patient/', data=json.dumps(data), content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {self.phc1_token}')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid WBC count", res.json()['error'])

        # 4. Invalid disease label
        data['wbc_count'] = 7000
        data['disease_label'] = 'COVID-19'
        res = self.client.post('/api/phc/patient/', data=json.dumps(data), content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {self.phc1_token}')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid disease label", res.json()['error'])

    def test_global_prediction_validation(self):
        """Test that DiseasePredictionView validates clinical range boundaries."""
        # 1. Invalid systolic BP
        data = {
            'clinical_features': {
                'fever': 1, 'cough': 1, 'fatigue': 1, 'headache': 0, 'vomiting': 0, 'breathlessness': 0,
                'temperature_c': 37.0, 'heart_rate': 80, 'bp_systolic': 400, 'wbc_count': 7000,
                'platelet_count': 250000, 'hemoglobin': 14.0
            }
        }
        res = self.client.post('/api/predictions/', data=json.dumps(data), content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {self.phc1_token}')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Systolic BP must be between 50 and 250", res.json()['details'])


from mongoengine.errors import ValidationError

class PHCModelAndAPITests(TestCase):
    """Test suite for PHC geographic validation, email checks, and administrative APIs."""

    def setUp(self):
        clear_collections()
        self.client = Client()

        # Create test users
        self.admin = User.objects.create(
            username='admin_user',
            password_hash=hash_password('password123'),
            role='DISTRICT_ADMIN'
        )
        self.officer = User.objects.create(
            username='officer_user',
            password_hash=hash_password('password123'),
            role='SURVEILLANCE_OFFICER'
        )
        self.phc_user = User.objects.create(
            username='phc_user',
            password_hash=hash_password('password123'),
            role='PHC_USER',
            phc_id='PHC_1'
        )

        # Generate tokens
        self.admin_token = generate_token(self.admin.id)
        self.officer_token = generate_token(self.officer.id)
        self.phc_token = generate_token(self.phc_user.id)

        # Seed initial PHC
        self.phc1 = PHC.objects.create(
            name='PHC_1',
            district_id='Coimbatore',
            city='Pollachi'
        )

    def tearDown(self):
        clear_collections()

    def test_phc_coordinate_bounds(self):
        """Test write-time validation of coordinate boundary ranges."""
        # 1. Valid coordinates
        self.phc1.latitude = 10.9765
        self.phc1.longitude = 77.0012
        self.phc1.save() # should save fine
        
        phc = PHC.objects.get(name='PHC_1')
        self.assertEqual(phc.latitude, 10.9765)
        self.assertEqual(phc.longitude, 77.0012)

        # 2. Invalid latitude above 90
        self.phc1.latitude = 95.0
        with self.assertRaises(ValidationError):
            self.phc1.save()

        # 3. Invalid latitude below -90
        self.phc1.latitude = -95.0
        with self.assertRaises(ValidationError):
            self.phc1.save()

        # Reset latitude
        self.phc1.latitude = 10.0

        # 4. Invalid longitude above 180
        self.phc1.longitude = 185.0
        with self.assertRaises(ValidationError):
            self.phc1.save()

        # 5. Invalid longitude below -180
        self.phc1.longitude = -185.0
        with self.assertRaises(ValidationError):
            self.phc1.save()

    def test_phc_email_validation(self):
        """Test format validation, normalization, and uniqueness of PHC emails."""
        # 1. Valid email format
        self.phc1.email = "  ZAMINUTHUKULI.PHC@tn.gov.in  "
        self.phc1.save()
        
        phc = PHC.objects.get(name='PHC_1')
        self.assertEqual(phc.email, "zaminuthukuli.phc@tn.gov.in")  # normalized to lowercase and trimmed

        # 2. Invalid email format
        self.phc1.email = "invalid-email-address"
        with self.assertRaises(ValidationError):
            self.phc1.save()

        # 3. Null email
        self.phc1.email = None
        self.phc1.save() # should save fine

        # 4. Unique email constraint
        PHC.objects.create(name='PHC_2', district_id='Coimbatore', city='Pollachi', email='unique@tn.gov.in')
        
        self.phc1.email = 'unique@tn.gov.in'
        with self.assertRaises(ValidationError):
            self.phc1.save()

    def test_phc_api_list_authorization(self):
        """Test role-based access control for listing PHCs."""
        # Admin can access
        res = self.client.get('/api/phcs/', HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()['count'], 1) # PHC_1

        # Surveillance officer can access
        res = self.client.get('/api/phcs/', HTTP_AUTHORIZATION=f'Bearer {self.officer_token}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # PHC user is denied (403)
        res = self.client.get('/api/phcs/', HTTP_AUTHORIZATION=f'Bearer {self.phc_token}')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_phc_api_update_authorization(self):
        """Test role-based access control for updating PHC config."""
        update_data = {
            'phc_name': 'Zamin Uthukuli Primary Health Center',
            'city': 'Pollachi City',
            'district': 'Coimbatore',
            'latitude': 10.9765,
            'longitude': 77.0012,
            'email': 'zaminuthukuli.phc@tn.gov.in'
        }

        # Admin can update
        res = self.client.put('/api/phcs/PHC_1/', data=json.dumps(update_data), content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()['phc']['phc_name'], 'Zamin Uthukuli Primary Health Center')

        # Surveillance officer is denied (403)
        res = self.client.put('/api/phcs/PHC_1/', data=json.dumps(update_data), content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {self.officer_token}')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # PHC user is denied (403)
        res = self.client.put('/api/phcs/PHC_1/', data=json.dumps(update_data), content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {self.phc_token}')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_phc_api_update_validation(self):
        """Test that update API performs validations and rejects invalid data."""
        # 1. Invalid latitude
        update_data = {'latitude': 150.0}
        res = self.client.put('/api/phcs/PHC_1/', data=json.dumps(update_data), content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Validation failed", res.json()['error'])

        # 2. Invalid email
        update_data = {'email': 'invalid_email'}
        res = self.client.put('/api/phcs/PHC_1/', data=json.dumps(update_data), content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Validation failed", res.json()['error'])


