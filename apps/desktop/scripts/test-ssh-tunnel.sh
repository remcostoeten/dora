#!/bin/bash

NETWORK="dora-test-net"
SSH_CONTAINER="dora-ssh-bastion"
PG_CONTAINER="dora-test-postgres"

SSH_USER="testuser"
SSH_PASS="testpass"
SSH_PORT="2222"

PG_USER="postgres"
PG_PASS="testpass"
PG_DB="testdb"
PG_PORT="5555"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

TUNNEL_URL="postgresql://$PG_USER:$PG_PASS@$PG_CONTAINER:5432/$PG_DB"
DIRECT_URL="postgresql://$PG_USER:$PG_PASS@localhost:$PG_PORT/$PG_DB"

function show_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════╗"
    echo "║       Dora SSH Tunnel Test Environment            ║"
    echo "╚═══════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

function copy_to_clipboard() {
    local text="$1"
    if command -v wl-copy &> /dev/null; then
        echo -n "$text" | wl-copy
    elif command -v xclip &> /dev/null; then
        echo -n "$text" | xclip -selection clipboard
    else
        echo -e "${RED}No clipboard tool found (install xclip or wl-copy)${NC}"
        return 1
    fi
    echo -e "${GREEN}✓ Copied to clipboard!${NC}"
}

function show_credentials() {
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}SSH Connection:${NC}"
    echo -e "  Host:     ${CYAN}localhost${NC}"
    echo -e "  Port:     ${CYAN}$SSH_PORT${NC}"
    echo -e "  Username: ${CYAN}$SSH_USER${NC}"
    echo -e "  Password: ${CYAN}$SSH_PASS${NC}"
    echo ""
    echo -e "${YELLOW}PostgreSQL (via SSH tunnel):${NC}"
    echo -e "  Host:     ${CYAN}$PG_CONTAINER${NC} (from SSH container)"
    echo -e "  Port:     ${CYAN}5432${NC}"
    echo -e "  Username: ${CYAN}$PG_USER${NC}"
    echo -e "  Password: ${CYAN}$PG_PASS${NC}"
    echo -e "  Database: ${CYAN}$PG_DB${NC}"
    echo -e "  URL:      ${CYAN}$TUNNEL_URL${NC}"
    echo ""
    echo -e "${YELLOW}PostgreSQL (direct, no SSH):${NC}"
    echo -e "  Host:     ${CYAN}localhost${NC}"
    echo -e "  Port:     ${CYAN}$PG_PORT${NC}"
    echo -e "  Username: ${CYAN}$PG_USER${NC}"
    echo -e "  Password: ${CYAN}$PG_PASS${NC}"
    echo -e "  Database: ${CYAN}$PG_DB${NC}"
    echo -e "  URL:      ${CYAN}$DIRECT_URL${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}Copy shortcuts:${NC}"
    echo "  ./test-ssh-tunnel.sh copy-tunnel  - Copy tunnel URL"
    echo "  ./test-ssh-tunnel.sh copy-direct  - Copy direct URL"
}

function start_containers() {
    echo -e "${CYAN}Starting test environment...${NC}"
    
    docker network create $NETWORK 2>/dev/null || true
    
    echo -e "${CYAN}Starting PostgreSQL container...${NC}"
    docker rm -f $PG_CONTAINER 2>/dev/null || true
    docker run -d \
        --name $PG_CONTAINER \
        --network $NETWORK \
        -p $PG_PORT:5432 \
        -e POSTGRES_USER=$PG_USER \
        -e POSTGRES_PASSWORD=$PG_PASS \
        -e POSTGRES_DB=$PG_DB \
        postgres:16
    
    echo -e "${CYAN}Starting SSH Bastion container...${NC}"
    docker rm -f $SSH_CONTAINER 2>/dev/null || true
    docker run -d \
        --name $SSH_CONTAINER \
        --network $NETWORK \
        -p $SSH_PORT:2222 \
        -e PUID=1000 \
        -e PGID=1000 \
        -e USER_NAME=$SSH_USER \
        -e USER_PASSWORD=$SSH_PASS \
        -e PASSWORD_ACCESS=true \
        linuxserver/openssh-server
    
    echo -e "${GREEN}Waiting for containers to be ready...${NC}"
    sleep 3
    
    echo -e "${GREEN}✓ Test environment ready!${NC}"
    echo ""
    show_credentials
}

function stop_containers() {
    echo -e "${CYAN}Stopping test environment...${NC}"
    docker rm -f $SSH_CONTAINER 2>/dev/null
    docker rm -f $PG_CONTAINER 2>/dev/null
    docker network rm $NETWORK 2>/dev/null || true
    echo -e "${GREEN}✓ Stopped${NC}"
}

function show_status() {
    echo -e "${CYAN}Container Status:${NC}"
    echo ""
    
    if docker ps --format "{{.Names}}" | grep -q "^$SSH_CONTAINER$"; then
        echo -e "  SSH Bastion:  ${GREEN}● Running${NC}"
    else
        echo -e "  SSH Bastion:  ${RED}○ Stopped${NC}"
    fi
    
    if docker ps --format "{{.Names}}" | grep -q "^$PG_CONTAINER$"; then
        echo -e "  PostgreSQL:   ${GREEN}● Running${NC}"
    else
        echo -e "  PostgreSQL:   ${RED}○ Stopped${NC}"
    fi
    echo ""
}

function test_connectivity() {
    echo -e "${YELLOW}Interactive Connection Test${NC}"
    echo "----------------------------------------"
    
    read -p "Use SSH Tunneling? (y/n) [n]: " use_ssh
    use_ssh=${use_ssh:-n}
    
    if [[ "$use_ssh" =~ ^[Yy]$ ]]; then
        echo ""
        echo -e "${CYAN}SSH Configuration:${NC}"
        read -p "SSH Host [localhost]: " ssh_host
        ssh_host=${ssh_host:-localhost}
        
        read -p "SSH Port [$SSH_PORT]: " ssh_port
        ssh_port=${ssh_port:-$SSH_PORT}
        
        read -p "SSH User [$SSH_USER]: " ssh_user
        ssh_user=${ssh_user:-$SSH_USER}
        
        read -p "SSH Password (used for command): " ssh_pass 
        ssh_pass=${ssh_pass:-$SSH_PASS} # Note: using sshpass in script is tricky if not installed
        
        echo ""
        echo -e "${CYAN}Database Configuration:${NC}"
        read -p "Target DB URL [$TUNNEL_URL]: " db_url
        db_url=${db_url:-$TUNNEL_URL}
        
        # Parse host/port from URL for testing
        # Format: postgresql://user:pass@host:port/db
        if [[ $db_url =~ @([^:]+):([0-9]+) ]]; then
            target_host="${BASH_REMATCH[1]}"
            target_port="${BASH_REMATCH[2]}"
            
            echo ""
            echo -e "${YELLOW}Testing SSH connection to $ssh_host:$ssh_port...${NC}"
            
            # Simple SSH connection check
            if ssh -q -o BatchMode=yes -o StrictHostKeyChecking=no -p $ssh_port $ssh_user@$ssh_host "exit" 2>/dev/null; then
                 echo -e "${GREEN}✓ SSH Connection established${NC}"
            else
                 # Try with sshpass if available, or warn
                 if command -v sshpass &> /dev/null; then
                     if sshpass -p "$ssh_pass" ssh -q -o StrictHostKeyChecking=no -p $ssh_port $ssh_user@$ssh_host "exit"; then
                         echo -e "${GREEN}✓ SSH Connection established (using sshpass)${NC}"
                     else
                         echo -e "${RED}✗ SSH Connection failed${NC}"
                         return 1
                     fi
                 else
                     echo -e "${YELLOW}⚠ Could not verify password-based SSH automatically (install sshpass for auto-check). Assuming interactive login works.${NC}"
                 fi
            fi
            
            echo -e "${YELLOW}Testing reachability of $target_host:$target_port from SSH host...${NC}"
            # Check if nc is available on remote
            check_cmd="nc -z -w 3 $target_host $target_port"
            
            if command -v sshpass &> /dev/null; then
                result=$(sshpass -p "$ssh_pass" ssh -q -o StrictHostKeyChecking=no -p $ssh_port $ssh_user@$ssh_host "$check_cmd" 2>&1)
                code=$?
            else
                # Prompt user for password if needed
                echo "Running remote reachability check (you may need to type password):"
                ssh -o StrictHostKeyChecking=no -p $ssh_port $ssh_user@$ssh_host "$check_cmd"
                code=$?
            fi
            
            if [ $code -eq 0 ]; then
                echo -e "${GREEN}✓ Authenticated SSH tunnel can reach database!${NC}"
                echo -e "  Host: $target_host"
                echo -e "  Port: $target_port"
            else
                echo -e "${RED}✗ SSH host could NOT reach database${NC}"
                echo "  Command failed: $check_cmd"
            fi
            
        else
            echo -e "${RED}Could not parse Host/Port from URL. Ensure format postgresql://user:pass@host:port/db${NC}"
        fi
        
    else
        # Direct connection
        echo ""
        read -p "Database URL [$DIRECT_URL]: " db_url
        db_url=${db_url:-$DIRECT_URL}
        
        if [[ $db_url =~ @([^:]+):([0-9]+) ]]; then
            target_host="${BASH_REMATCH[1]}"
            target_port="${BASH_REMATCH[2]}"
            
            echo -e "${YELLOW}Testing connection to $target_host:$target_port...${NC}"
            if command -v nc &> /dev/null; then
                if nc -z -w 3 $target_host $target_port; then
                    echo -e "${GREEN}✓ Port is open and reachable!${NC}"
                else
                    echo -e "${RED}✗ Port reachable failed${NC}"
                fi
            else
                 # Fallback to bash tcp
                 if timeout 3 bash -c "</dev/tcp/$target_host/$target_port" 2>/dev/null; then
                    echo -e "${GREEN}✓ Port is open and reachable!${NC}"
                 else
                    echo -e "${RED}✗ Port reachable failed${NC}"
                 fi
            fi
            
            # Check for pg_isready
            if command -v pg_isready &> /dev/null; then
                 echo -e "${YELLOW}Checking Postgres ready status...${NC}"
                 if pg_isready -d "$db_url"; then
                     echo -e "${GREEN}✓ Postgres is ready to accept connections${NC}"
                 else
                     echo -e "${RED}✗ Postgres is not ready${NC}"
                 fi
            fi
        fi
    fi 
}

function show_usage() {
    echo "Usage: $0 {start|stop|status|creds|restart|copy-tunnel|copy-direct|test}"
    echo ""
    echo "Commands:"
    echo "  start       - Start SSH bastion + PostgreSQL containers"
    echo "  stop        - Stop and remove containers"
    echo "  status      - Show container status"
    echo "  creds       - Show connection credentials"
    echo "  restart     - Stop then start containers"
    echo "  copy-tunnel - Copy tunnel PostgreSQL URL to clipboard"
    echo "  copy-direct - Copy direct PostgreSQL URL to clipboard"
    echo "  test        - Interactive connection tester"
}

show_banner

case "$1" in
    start)
        start_containers
        ;;
    stop)
        stop_containers
        ;;
    status)
        show_status
        ;;
    creds)
        show_credentials
        ;;
    restart)
        stop_containers
        echo ""
        start_containers
        ;;
    copy-tunnel)
        echo -e "Tunnel URL: ${CYAN}$TUNNEL_URL${NC}"
        copy_to_clipboard "$TUNNEL_URL"
        ;;
    copy-direct)
        echo -e "Direct URL: ${CYAN}$DIRECT_URL${NC}"
        copy_to_clipboard "$DIRECT_URL"
        ;;
    test)
        test_connectivity
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
