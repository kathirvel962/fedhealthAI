import os
import django
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fedhealth.settings')

if not django.apps.apps.ready:
    django.setup()

def application(environ, start_response):
    from django.core.wsgi import get_wsgi_application
    return get_wsgi_application()(environ, start_response)
