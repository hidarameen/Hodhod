#!/bin/sh
set -e

echo "[INFO] Starting BotNexus container entrypoint..."

# Function to log with timestamp
log_info() {
    echo "[$(date -Iseconds)] [INFO] $1"
}

log_error() {
    echo "[$(date -Iseconds)] [ERROR] $1" >&2
}

# Sanitize DATABASE_URL if it contains multiple hosts
# Some providers (like Northflank) provide URLs with multiple hosts (primary,read)
# which is not supported by standard URL parsers
sanitize_database_url() {
    if [ -n "$DATABASE_URL" ]; then
        # Check if URL contains comma (multiple hosts)
        if echo "$DATABASE_URL" | grep -q ","; then
            log_info "Detected multi-host DATABASE_URL, extracting primary host..."
            
            # Extract parts of the URL
            # Format: postgresql://user:pass@host1:port,host2:port/dbname?params
            
            # Get the protocol and credentials part (before @)
            PROTO_CREDS=$(echo "$DATABASE_URL" | sed -E 's/^([^@]+@).*/\1/')
            
            # Get the hosts part (between @ and /)
            HOSTS_PART=$(echo "$DATABASE_URL" | sed -E 's/^[^@]+@([^\/]+)\/.*/\1/')
            
            # Get the database and params part (after hosts)
            DB_PARAMS=$(echo "$DATABASE_URL" | sed -E 's/^[^@]+@[^\/]+\/(.*)/\1/')
            
            # Extract only the first host (primary)
            PRIMARY_HOST=$(echo "$HOSTS_PART" | cut -d',' -f1)
            
            # Reconstruct the URL with only the primary host
            export DATABASE_URL="${PROTO_CREDS}${PRIMARY_HOST}/${DB_PARAMS}"
            
            log_info "Using primary host: $PRIMARY_HOST"
        fi
    fi
}

# Wait for PostgreSQL to be ready
wait_for_postgres() {
    if [ -n "$DATABASE_URL" ]; then
        log_info "Waiting for PostgreSQL to be ready..."
        max_attempts=30
        attempt=0
        
        while [ $attempt -lt $max_attempts ]; do
            if pg_isready -d "$DATABASE_URL" > /dev/null 2>&1; then
                log_info "PostgreSQL is ready!"
                return 0
            fi
            attempt=$((attempt + 1))
            log_info "Waiting for PostgreSQL... (attempt $attempt/$max_attempts)"
            sleep 2
        done
        
        log_error "PostgreSQL did not become ready in time"
        return 1
    fi
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    if npm run db:push; then
        log_info "Database migrations completed successfully"
    else
        log_error "Database migrations failed, but continuing..."
    fi
}

# Main execution
main() {
    # Sanitize DATABASE_URL first (handle multi-host URLs)
    sanitize_database_url
    
    # Wait for database if configured
    if [ -n "$DATABASE_URL" ]; then
        wait_for_postgres
        run_migrations
    fi
    
    log_info "Starting application..."
    
    # Execute the main command
    exec "$@"
}

main "$@"
