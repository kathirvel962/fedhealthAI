import jwt
import threading
from datetime import datetime, timedelta
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.permissions import BasePermission
import bcrypt
from api.models import User

SECRET_KEY = settings.SECRET_KEY

# Thread-safe MongoEngine initialization
_mongo_init_lock = threading.Lock()

def _ensure_mongo_thread_init():
    """Ensure MongoEngine is properly initialized for current thread"""
    with _mongo_init_lock:
        import mongoengine
        try:
            # Initialize thread locals if not already done
            from mongoengine.context_managers import thread_locals
            if not hasattr(thread_locals, 'no_dereferencing_class'):
                thread_locals.no_dereferencing_class = ''
        except:
            pass

def hash_password(password):
    """Hash password using bcrypt with secure salt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, hashed):
    """Verify password against bcrypt hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def generate_token(user_id):
    """Generate JWT token with 30-day expiration"""
    payload = {
        'user_id': str(user_id),
        'exp': datetime.utcnow() + timedelta(days=30),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

class JWTAuthentication(BaseAuthentication):
    """JWT-based authentication for API endpoints"""
    def authenticate(self, request):
        _ensure_mongo_thread_init()
        
        auth_header = request.META.get('HTTP_AUTHORIZATION')
        
        if not auth_header:
            return None
        
        try:
            prefix, token = auth_header.split()
            if prefix.lower() != 'bearer':
                raise AuthenticationFailed('Invalid token prefix. Use "Bearer <token>"')
        except ValueError:
            raise AuthenticationFailed('Invalid authorization header format')
        
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            try:
                user = User.objects.get(id=payload['user_id'])
            except User.DoesNotExist:
                raise AuthenticationFailed('User not found')
            return (user, None)
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token has expired. Please login again.')
        except jwt.InvalidTokenError:
            raise AuthenticationFailed('Invalid token')


# ============================================
# ROLE-BASED PERMISSION CLASSES
# ============================================

class IsPHCUser(BasePermission):
    """
    Permission class: Only PHC users can access
    Used for endpoints that are PHC-exclusive
    """
    message = "Only PHC users can access this endpoint"
    
    def has_permission(self, request, view):
        return request.user and request.user.role == 'PHC_USER'


class IsDistrictAdmin(BasePermission):
    """
    Permission class: Only district admins can access
    Used for admin dashboard and metrics endpoints
    """
    message = "Only district administrators can access this endpoint"
    
    def has_permission(self, request, view):
        return request.user and request.user.role == 'DISTRICT_ADMIN'


class IsSurveillanceOfficer(BasePermission):
    """
    Permission class: Only surveillance officers can access
    Used for alert and surveillance endpoints
    """
    message = "Only surveillance officers can access this endpoint"
    
    def has_permission(self, request, view):
        return request.user and request.user.role == 'SURVEILLANCE_OFFICER'


class IsAdminOrOfficer(BasePermission):
    """
    Permission class: District admin OR surveillance officer
    Used for endpoints that both roles can access (read-only metrics)
    """
    message = "Only administrators and surveillance officers can access this endpoint"
    
    def has_permission(self, request, view):
        return request.user and request.user.role in ['DISTRICT_ADMIN', 'SURVEILLANCE_OFFICER']


class IsPHCOwner(BasePermission):
    """
    Permission class: PHC users can only access their own PHC's data
    District admins can access all PHCs' data (aggregated)
    
    Requires: view to implement get_phc_id(request) method
    """
    message = "You can only access your own PHC's data"
    
    def has_permission(self, request, view):
        # All authenticated users have basic permission
        return request.user is not None
    
    def has_object_permission(self, request, view, obj):
        # PHC users can only access their own PHC
        if request.user.role == 'PHC_USER':
            return request.user.phc_id == obj.phc_id
        # District admins and surveillance officers can access all (via aggregated views)
        return request.user.role in ['DISTRICT_ADMIN', 'SURVEILLANCE_OFFICER']


class CanAccessPatientData(BasePermission):
    """
    Strict permission: Controls who can access raw patient data
    - PHC_USER: Only own PHC's patients
    - DISTRICT_ADMIN: Aggregated metrics only (via AdminStatsView)
    - SURVEILLANCE_OFFICER: Alerts only, never raw patient data
    """
    message = "You do not have permission to access this patient data"
    
    def has_permission(self, request, view):
        # Only PHC users can access raw patient data
        if request.method in ['GET', 'POST']:
            return request.user and request.user.role == 'PHC_USER'
        return False
    
    def has_object_permission(self, request, view, obj):
        # Patient must belong to PHC user's PHC
        if request.user.role == 'PHC_USER':
            return request.user.phc_id == obj.phc_id
        return False

