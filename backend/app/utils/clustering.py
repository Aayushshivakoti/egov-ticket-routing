from sqlalchemy.orm import Session
from app.models import Ticket
import numpy as np
from sklearn.cluster import DBSCAN
import os
import json
import redis

def run_spatial_clustering(db: Session, department_id: int):
    """
    Run DBSCAN clustering on active tickets for the given department
    to identify duplicate reports within a 50-meter radius.
    """
    if not department_id:
        return
        
    # 1. Fetch active, unresolved tickets with valid coordinates for the department
    tickets = db.query(Ticket).filter(
        Ticket.assigned_department_id == department_id,
        Ticket.status.in_(["pending", "processing", "in_progress", "Under Re-evaluation"]),
        Ticket.latitude.isnot(None),
        Ticket.longitude.isnot(None)
    ).all()
    
    if len(tickets) < 3:
        # DBSCAN needs at least min_samples=3 to form a cluster
        return
        
    # Extract coordinates
    coords = []
    ticket_map = []
    
    for t in tickets:
        coords.append([t.latitude, t.longitude])
        ticket_map.append(t)
        
    coords_arr = np.array(coords)
    
    # Convert lat/lon coordinates to radians for the Haversine metric
    coords_rad = np.radians(coords_arr)
    
    # Earth radius in kilometers
    EARTH_RADIUS_KM = 6371.0088
    # 50 meters = 0.05 km
    epsilon_rad = 0.05 / EARTH_RADIUS_KM
    
    # Run DBSCAN
    dbscan = DBSCAN(eps=epsilon_rad, min_samples=3, metric='haversine')
    labels = dbscan.fit_predict(coords_rad)
    
    # Group tickets by cluster label
    clusters = {}
    for idx, label in enumerate(labels):
        if label == -1:
            # Noise point (standalone ticket)
            continue
        if label not in clusters:
            clusters[label] = []
        clusters[label].append(ticket_map[idx])
        
    updated = False
    
    for label, cluster_tickets in clusters.items():
        # Identify the Master Ticket: the oldest ticket (lowest ID)
        cluster_tickets.sort(key=lambda t: t.id)
        master_ticket = cluster_tickets[0]
        
        # If the master ticket itself was a child of another, break it out
        if master_ticket.parent_ticket_id is not None:
            master_ticket.parent_ticket_id = None
            
        child_ids = []
        for ticket in cluster_tickets[1:]:
            if ticket.parent_ticket_id != master_ticket.id:
                ticket.parent_ticket_id = master_ticket.id
                # Keep status and assigned employee in sync with Master
                ticket.status = master_ticket.status
                ticket.assigned_employee_id = master_ticket.assigned_employee_id
                updated = True
                child_ids.append(ticket.id)
                
        if child_ids:
            print(f"Clustered {len(child_ids)} sub-tickets under Master Ticket #{master_ticket.id}")
            # Publish WebSocket event
            try:
                redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
                r = redis.Redis.from_url(redis_url)
                message = {
                    "event": "tickets_clustered",
                    "master_ticket_id": master_ticket.id,
                    "child_ticket_ids": child_ids
                }
                r.publish("ticket_updates", json.dumps(message))
            except Exception as pub_err:
                print(f"Clustering event broadcast failed: {pub_err}")
                
    if updated:
        db.commit()
