"""
FedHealthAI Backend URL Configuration - Refactored for MVP

Essential endpoints only:
- Authentication (register, login)
- Patient management (submit, list)
- Federated learning (aggregation)
- Surveillance (alerts)
- Dashboards (PHC, District, Officer)
- Health check
- API Documentation (Swagger/ReDoc)
"""

from django.urls import path
from api import views

urlpatterns = [
    # API Documentation (Swagger disabled - using drf_yasg requires pkg_resources)
    
    # Health Check
    path('health/', views.HealthCheckView.as_view(), name='health-check'),
    
    # Authentication
    path('api/auth/register/', views.RegisterView.as_view(), name='register'),
    path('api/auth/login/', views.LoginView.as_view(), name='login'),
    
    # Patient Management
    path('api/phc/patient/', views.PatientSubmitView.as_view(), name='patient-submit'),
    path('api/phc/patients/', views.PHCPatientsView.as_view(), name='phc-patients'),
    
    # PHC Management / Configuration
    path('api/phcs/', views.PHCListView.as_view(), name='phc-list'),
    path('api/phcs/<str:phc_id>/', views.PHCUpdateView.as_view(), name='phc-update'),
    
    # Surveillance
    path('api/surveillance/alerts/', views.SurveillanceAlertsView.as_view(), name='surveillance-alerts'),
    path('api/surveillance/my-alerts/', views.PHCActiveAlertsView.as_view(), name='phc-active-alerts'),
    path('api/surveillance/alerts/<str:alert_id>/', views.HealthAlertDetailView.as_view(), name='health-alert-detail'),
    path('api/surveillance/alerts/<str:alert_id>/acknowledge/', views.HealthAlertAcknowledgeView.as_view(), name='health-alert-acknowledge'),
    path('api/surveillance/alerts/<str:alert_id>/resolve/', views.HealthAlertResolveView.as_view(), name='health-alert-resolve'),
    path('api/surveillance/district-alerts/', views.DistrictAlertsListView.as_view(), name='district-alerts-list'),
    path('api/surveillance/advisories/', views.DistrictAdminAdvisoryView.as_view(), name='district-admin-advisory'),
    path('api/surveillance/detect/', views.TriggerSurveillanceDetectionView.as_view(), name='trigger-surveillance-detection'),
    path('api/surveillance/notify/', views.PHCNotificationView.as_view(), name='phc-notification-request'),
    path('api/surveillance/notify/confirm/', views.PHCNotificationConfirmView.as_view(), name='phc-notification-confirm'),
    path('api/surveillance/direct-send/', views.DirectPHCAlertView.as_view(), name='direct-phc-alert'),
    
    # Dashboards
    path('api/dashboards/phc/', views.PHCDashboardMetricsView.as_view(), name='phc-dashboard'),
    path('api/dashboards/district/', views.DistrictDashboardMetricsView.as_view(), name='district-dashboard'),
    path('api/dashboards/surveillance/', views.SurveillanceDashboardMetricsView.as_view(), name='surveillance-dashboard'),
    
    # Federated Learning Data Model Layer
    path('api/fl/rounds/', views.FederatedRoundView.as_view(), name='fl-rounds'),
    path('api/fl/updates/', views.FederatedClientUpdateView.as_view(), name='fl-updates'),
    path('api/fl/global-models/', views.GlobalModelVersionView.as_view(), name='fl-global-models'),
    path('api/fl/evaluations/', views.ModelEvaluationResultView.as_view(), name='fl-evaluations'),
    
    # Historical Data
    path('api/cohort/history/', views.CohortHistoryView.as_view(), name='cohort-history'),
    
    # Disease Prediction Layer
    path('api/predictions/', views.DiseasePredictionView.as_view(), name='disease-prediction'),

    # Non-IID Heterogeneity Analysis Layer
    path('api/fl/non-iid/', views.NonIIDAnalysisView.as_view(), name='fl-non-iid'),
]
