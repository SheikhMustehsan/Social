#!/bin/bash
# Logs internet connectivity drops/recoveries, and auto-heals a known cause:
# a stale ARP cache entry for the gateway that leaves the interface "up" but
# unable to actually reach anything. Confirmed live: refreshing the ARP entry
# for the gateway instantly restores connectivity when this happens.

LOGFILE="/home/dccdev/Social/backend/net-watchdog.log"
IFACE="enx68e43b308c49"
GATEWAY="192.168.1.1"
PREV_STATE="unknown"
DROP_START=""
COUNTER=0

log() {
  echo "$(date -Iseconds) $1" >> "$LOGFILE"
}

check_ipv4() {
  if curl -s -o /dev/null --max-time 5 -4 https://1.1.1.1/ 2>/dev/null; then
    echo 1
  else
    echo 0
  fi
}

while true; do
  IPV4_OK=$(check_ipv4)

  IPV6_OK=0
  curl -s -o /dev/null --max-time 5 -6 "https://[2606:4700:4700::1111]/" 2>/dev/null && IPV6_OK=1

  GW_OK=0
  ping -4 -c1 -W2 "$GATEWAY" >/dev/null 2>&1 && GW_OK=1

  LINK_STATE=$(cat /sys/class/net/$IFACE/operstate 2>/dev/null)

  RECOVERY="none"
  if [ "$IPV4_OK" = "0" ]; then
    # Known fix: refresh the stale ARP entry for the gateway and re-check.
    sudo -n ip neigh del "$GATEWAY" dev "$IFACE" >/dev/null 2>&1
    sleep 1
    IPV4_OK=$(check_ipv4)
    if [ "$IPV4_OK" = "1" ]; then
      RECOVERY="arp_refresh_fixed_it"
    else
      RECOVERY="arp_refresh_did_not_help"
    fi
  fi

  if [ "$IPV4_OK" = "1" ]; then
    CURRENT_STATE="up"
  else
    CURRENT_STATE="down"
  fi

  if [ "$CURRENT_STATE" != "$PREV_STATE" ]; then
    if [ "$CURRENT_STATE" = "down" ]; then
      DROP_START=$(date -Iseconds)
      log "DROP START | ipv4=$IPV4_OK ipv6=$IPV6_OK gateway=$GW_OK iface_operstate=$LINK_STATE recovery=$RECOVERY"
    else
      if [ -n "$DROP_START" ]; then
        log "RECOVERED  | was down since $DROP_START | ipv4=$IPV4_OK ipv6=$IPV6_OK gateway=$GW_OK iface_operstate=$LINK_STATE recovery=$RECOVERY"
      else
        log "UP (initial check) | ipv4=$IPV4_OK ipv6=$IPV6_OK gateway=$GW_OK iface_operstate=$LINK_STATE"
      fi
    fi
    PREV_STATE="$CURRENT_STATE"
  elif [ "$RECOVERY" = "arp_refresh_fixed_it" ]; then
    # Caught and fixed a drop within a single check cycle - still worth logging.
    log "AUTO-HEALED within one cycle via ARP refresh | ipv4=$IPV4_OK"
  fi

  # Heartbeat every ~20 minutes so we know the watchdog itself is alive
  COUNTER=$((COUNTER+1))
  if [ $((COUNTER % 40)) -eq 0 ]; then
    log "heartbeat  | state=$CURRENT_STATE ipv4=$IPV4_OK ipv6=$IPV6_OK gateway=$GW_OK iface_operstate=$LINK_STATE"
  fi

  sleep 30
done
