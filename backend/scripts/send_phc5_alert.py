#!/usr/bin/env python
"""
Script to send a surveillance email alert directly to PHC_5 (Kuniamuthur PHC).
Email recipient: phc.5fed@gmail.com
"""
import os
import sys
import django
from datetime import datetime

# Setup Django Environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fedhealth.settings')
django.setup()

from api.models import PHC, NotificationLog
from api.email_service import send_phc_alert_email

def send_alert_to_phc5():
    target_id = 'PHC_5'
    phc = PHC.objects.filter(name=target_id).first()
    
    if not phc:
        print(f"[-] Error: PHC '{target_id}' not found in database.")
        return False

    recipient_email = phc.email or 'phc.5fed@gmail.com'
    recipient_name = phc.phc_name or "Kuniamuthur Primary Health Center"
    source_name = "Vellalore Primary Health Center (PHC_4)"
    disease = "Dengue"
    severity = "HIGH"
    risk_score = "88.0"
    alert_time = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')
    
    alert_message = (
        "Surveillance signal: An uptick in fever and suspected Dengue cases has been "
        "identified in the adjoining Vellalore cluster (8.1 km from Kuniamuthur). "
        "Medical Officers at Kuniamuthur PHC are advised to monitor patient triage vital logs "
        "and maintain platelet test inventory."
    )

    print(f"\n=======================================================")
    print(f"SENDING SURVEILLANCE ALERT EMAIL TO {target_id}")
    print(f"=======================================================")
    print(f"Target PHC:        {recipient_name} ({target_id})")
    print(f"Recipient Email:   {recipient_email}")
    print(f"Source PHC:        {source_name} (PHC_4)")
    print(f"Disease:           {disease}")
    print(f"Severity:          {severity}")
    print(f"Risk Score:        {risk_score}/100")
    print(f"Timestamp:         {alert_time}\n")

    success, error = send_phc_alert_email(
        recipient_email=recipient_email,
        recipient_phc_name=recipient_name,
        source_phc_name=source_name,
        disease=disease,
        severity=severity,
        risk_score=risk_score,
        alert_message=alert_message,
        alert_time=alert_time
    )

    # Log in database
    log = NotificationLog.objects.create(
        alert_id=f"MANUAL_PHC5_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        recipient_phc_id=target_id,
        recipient_email=recipient_email,
        status='SENT' if success else 'FAILED',
        notification_type='manual',
        error_message=error,
        sent_at=datetime.utcnow()
    )

    if success:
        print(f"[+] SUCCESS: Surveillance alert email sent to {recipient_email} for {target_id}!")
        print(f"[+] NotificationLog ID: {log.id}")
        return True
    else:
        print(f"[-] FAILED: Delivery error: {error}")
        print(f"[-] NotificationLog ID: {log.id}")
        return False

if __name__ == '__main__':
    send_alert_to_phc5()
