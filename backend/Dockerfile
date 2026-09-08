FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=fedhealth.settings

RUN mkdir -p /app/logs

EXPOSE 8000
EXPOSE 10000

CMD ["sh", "-c", "python manage.py migrate --noinput; exec gunicorn fedhealth.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --threads 4 --timeout 120 --access-logfile - --error-logfile -"]

