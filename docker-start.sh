#!/bin/bash

# Load APP_TIMEZONE from .env (defaults to America/New_York if not set)
if [ -f .env ]; then
    export APP_TIMEZONE=$(grep '^APP_TIMEZONE=' .env | cut -d '=' -f 2)
fi

TIMEZONE=${APP_TIMEZONE:-America/New_York}
echo "🕐 Using timezone: $TIMEZONE"

docker compose --env-file /dev/null up --build
