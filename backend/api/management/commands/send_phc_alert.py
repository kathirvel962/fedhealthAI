import logging
from datetime import datetime
from django.core.management.base import BaseCommand
from api.models import PHC, NotificationLog, HealthAlert
from api.email_service import send_phc_alert_email

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Send a disease surveillance email alert to a specific PHC (default: PHC_3)'

    def add_arguments(self, parser):
        parser.add_argument('--phc', type=str, default='PHC_3', help='Target PHC ID (e.g. PHC_3, PHC_1)')
        parser.add_argument('--source', type=str, default='PHC_1', help='Source PHC triggering alert (default: PHC_1)')
        parser.add_argument('--disease', type=str, default='Dengue', help='Identified disease (default: Dengue)')
        parser.add_argument('--severity', type=str, default='HIGH', choices=['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], help='Alert severity')
        parser.add_argument('--risk', type=str, default='85.0', help='Calculated risk score (0-100)')
        parser.add_argument('--message', type=str, default=None, help='Custom surveillance summary message')

    def handle(self, *args, **options):
        target_phc_id = options['phc'].strip().upper()
        source_phc_id = options['source'].strip().upper()
        disease = options['disease']
        severity = options['severity']
        risk_score = options['risk']
        
        # 1. Fetch Target PHC
        target_phc = PHC.objects.filter(name=target_phc_id).first()
        if not target_phc:
            self.stderr.write(self.style.ERROR(f"Error: Target PHC '{target_phc_id}' not found in database."))
            return

        if not target_phc.email:
            self.stderr.write(self.style.ERROR(f"Error: Target PHC '{target_phc_id}' does not have an email configured."))
            return

        # 2. Fetch Source PHC
        source_phc = PHC.objects.filter(name=source_phc_id).first()
        source_name = source_phc.phc_name if source_phc else f"Primary Health Center ({source_phc_id})"
        target_name = target_phc.phc_name or target_phc_id

        # 3. Formulate Alert Message
        custom_message = options['message'] or (
            f"Automated surveillance metrics detected an elevated {disease} incidence pattern "
            f"originating from {source_name}. Target risk score calculated at {risk_score}/100. "
            f"Surveillance officers recommend reviewing recent admissions and verifying rapid test stock."
        )

        alert_time = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')

        self.stdout.write(f"\n=======================================================")
        self.stdout.write(f"DISPATCHING SURVEILLANCE EMAIL TO {target_phc_id}")
        self.stdout.write(f"=======================================================")
        self.stdout.write(f"Target PHC:     {target_name} ({target_phc_id})")
        self.stdout.write(f"Recipient Email:{target_phc.email}")
        self.stdout.write(f"Source PHC:     {source_name} ({source_phc_id})")
        self.stdout.write(f"Disease:        {disease}")
        self.stdout.write(f"Severity:       {severity}")
        self.stdout.write(f"Risk Score:     {risk_score}/100")
        self.stdout.write(f"Time:           {alert_time}\n")

        # 4. Dispatch Email via email_service
        success, error_msg = send_phc_alert_email(
            recipient_email=target_phc.email,
            recipient_phc_name=target_name,
            source_phc_name=source_name,
            disease=disease,
            severity=severity,
            risk_score=risk_score,
            alert_message=custom_message,
            alert_time=alert_time
        )

        # 5. Log Notification in Database
        log = NotificationLog.objects.create(
            alert_id=f"MANUAL_DISPATCH_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            recipient_phc_id=target_phc_id,
            recipient_email=target_phc.email,
            status='SENT' if success else 'FAILED',
            notification_type='manual',
            error_message=error_msg,
            sent_at=datetime.utcnow()
        )

        if success:
            self.stdout.write(self.style.SUCCESS(
                f"[SUCCESS] Email successfully delivered to {target_phc.email} for {target_phc_id}!\n"
                f"NotificationLog ID: {log.id}"
            ))
        else:
            self.stderr.write(self.style.ERROR(
                f"[FAILED] Could not deliver email to {target_phc.email}: {error_msg}\n"
                f"NotificationLog ID: {log.id}"
            ))
