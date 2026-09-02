import logging
from django.core.management.base import BaseCommand
from api.surveillance_service import run_surveillance_detection

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Discover PHCs, evaluate disease incidence increases, and notify neighboring PHCs with alerts.'

    def handle(self, *args, **options):
        self.stdout.write("Starting automated health surveillance alert detection...")
        try:
            result = run_surveillance_detection()
            self.stdout.write(self.style.SUCCESS(
                f"Surveillance detection cycle completed successfully.\n"
                f"  Created: {result['alerts_created']} alert(s)\n"
                f"  Updated: {result['alerts_updated']} alert(s)"
            ))
            for skip in result['skipped_phcs']:
                self.stdout.write(self.style.WARNING(f"  Skipped {skip['phc_id']}: {skip['reason']}"))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Surveillance cycle failed: {str(e)}"))
            logger.exception("Error executing detect_health_alerts management command")
