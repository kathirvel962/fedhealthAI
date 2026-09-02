import logging
from django.core.mail import send_mail
from django.conf import settings
from datetime import datetime

logger = logging.getLogger(__name__)

def send_phc_alert_email(recipient_email, recipient_phc_name, source_phc_name, disease, severity, risk_score, alert_message, alert_time=None):
    """
    Sends a formatted High/Critical Surveillance Alert email to a PHC.
    Uses Django's backend mail configuration.
    
    Returns (success: bool, error_message: str or None)
    """
    if not recipient_email:
        return False, "Recipient email is missing."

    time_str = alert_time or datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')
    
    subject = f"[{severity} ALERT] Disease Surveillance Notification for {recipient_phc_name}"
    
    # Plain text body
    plain_message = f"""======================================================================
FEDHEALTH AI - PUBLIC HEALTH SURVEILLANCE ALERT
======================================================================

Severity Level:    {severity}
Target Facility:   {recipient_phc_name}
Source Facility:   {source_phc_name}
Disease Flagged:   {disease}
Risk Score:        {risk_score}
Timestamp:         {time_str}

----------------------------------------------------------------------
SURVEILLANCE DETAILS:
----------------------------------------------------------------------
{alert_message}

RECOMMENDED CLINICAL ACTION:
• Review recent patient admissions and vital sign logs.
• Ensure adequate diagnostic and triage capacity for suspected {disease} cases.
• Coordinate with the District Health Officer if incidence continues to rise.

======================================================================
This is an automated notification from FedHealth AI Privacy-Preserving Health Intelligence Network.
======================================================================
"""

    # HTML formatted body
    severity_color = "#dc2626" if severity in ['HIGH', 'CRITICAL'] else "#d97706"
    html_message = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }}
    .card {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }}
    .header {{ background: {severity_color}; color: #ffffff; padding: 20px 24px; }}
    .badge {{ display: inline-block; background: rgba(255,255,255,0.25); padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }}
    .title {{ margin: 10px 0 0 0; font-size: 20px; font-weight: 700; }}
    .content {{ padding: 24px; }}
    .grid {{ display: table; width: 100%; margin-bottom: 20px; }}
    .row {{ display: table-row; }}
    .label {{ display: table-cell; padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 600; width: 35%; }}
    .val {{ display: table-cell; padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 600; }}
    .box {{ background: #f1f5f9; border-left: 4px solid {severity_color}; padding: 14px 16px; border-radius: 4px; margin: 16px 0; font-size: 14px; line-height: 1.5; color: #334155; }}
    .actions {{ background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-top: 20px; }}
    .actions-title {{ font-weight: 700; color: #1e40af; font-size: 14px; margin-bottom: 8px; }}
    .actions-list {{ margin: 0; padding-left: 20px; color: #1e3a8a; font-size: 13px; }}
    .footer {{ padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">{severity} SEVERITY</span>
      <h1 class="title">Disease Surveillance Alert</h1>
    </div>
    <div class="content">
      <div class="grid">
        <div class="row"><div class="label">Target PHC:</div><div class="val">{recipient_phc_name}</div></div>
        <div class="row"><div class="label">Source PHC:</div><div class="val">{source_phc_name}</div></div>
        <div class="row"><div class="label">Identified Disease:</div><div class="val" style="color: {severity_color};">{disease}</div></div>
        <div class="row"><div class="label">Calculated Risk Score:</div><div class="val">{risk_score}/100</div></div>
        <div class="row"><div class="label">Detection Timestamp:</div><div class="val">{time_str}</div></div>
      </div>
      
      <div class="box">
        <strong>Surveillance Summary:</strong><br>
        {alert_message}
      </div>

      <div class="actions">
        <div class="actions-title">Recommended Clinical & Operational Protocol:</div>
        <ul class="actions-list">
          <li>Review active patient admissions for fever and symptoms related to <strong>{disease}</strong>.</li>
          <li>Ensure adequate diagnostic reagents and rapid test kits are available at triage.</li>
          <li>Monitor local incidence trends in the FedHealth AI PHC Dashboard.</li>
        </ul>
      </div>
    </div>
    <div class="footer">
      FedHealth AI &bull; Automated Privacy-Preserving Health Intelligence Network
    </div>
  </div>
</body>
</html>
"""

    try:
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', settings.EMAIL_HOST_USER)
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=from_email,
            recipient_list=[recipient_email],
            html_message=html_message,
            fail_silently=False
        )
        logger.info(f"[Email Service] Alert email sent successfully to {recipient_email} (Severity: {severity})")
        return True, None
    except Exception as e:
        logger.error(f"[Email Service] Failed to deliver alert email to {recipient_email}: {str(e)}")
        return False, str(e)
