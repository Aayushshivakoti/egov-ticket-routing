import math
from typing import List
from app.models import Ticket

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes the geodesic distance in kilometers between two points on the earth
    using the Haversine formula.
    """
    R = 6371.0088  # Earth radius in kilometers
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def solve_tsp(start_lat: float, start_lon: float, tickets: List[Ticket]) -> List[Ticket]:
    """
    Finds an optimized navigation sequence for field operators traversal using 
    the Nearest Neighbor heuristic with a 2-opt local refinement pass.
    """
    if not tickets:
        return []
        
    # Split tickets with and without coordinates
    valid_tickets = [t for t in tickets if t.latitude is not None and t.longitude is not None]
    other_tickets = [t for t in tickets if t.latitude is None or t.longitude is None]
    
    if not valid_tickets:
        return tickets
        
    unvisited = list(valid_tickets)
    ordered_tickets = []
    
    curr_lat = start_lat
    curr_lon = start_lon
    
    # 1. Nearest Neighbor Phase
    while unvisited:
        nearest = None
        min_dist = float('inf')
        for t in unvisited:
            dist = haversine_distance(curr_lat, curr_lon, t.latitude, t.longitude)
            if dist < min_dist:
                min_dist = dist
                nearest = t
        ordered_tickets.append(nearest)
        unvisited.remove(nearest)
        curr_lat = nearest.latitude
        curr_lon = nearest.longitude
        
    # 2. 2-opt Refinement Phase (only check swaps if sequence has >= 4 items)
    n = len(ordered_tickets)
    if n >= 4:
        improved = True
        limit = 0
        # Prevent infinite loops in degenerate or edge cases
        while improved and limit < 50:
            improved = False
            limit += 1
            for i in range(1, n - 2):
                for j in range(i + 1, n):
                    if j - i == 1:
                        continue
                    
                    p_prev = ordered_tickets[i-1]
                    p_i = ordered_tickets[i]
                    p_j = ordered_tickets[j]
                    p_next = ordered_tickets[j+1] if j+1 < n else None
                    
                    # Compute current transition cost
                    cost_curr = haversine_distance(p_prev.latitude, p_prev.longitude, p_i.latitude, p_i.longitude)
                    if p_next:
                        cost_curr += haversine_distance(p_j.latitude, p_j.longitude, p_next.latitude, p_next.longitude)
                        
                    # Compute cost of swap transition
                    cost_new = haversine_distance(p_prev.latitude, p_prev.longitude, p_j.latitude, p_j.longitude)
                    if p_next:
                        cost_new += haversine_distance(p_i.latitude, p_i.longitude, p_next.latitude, p_next.longitude)
                        
                    if cost_new < cost_curr:
                        # Perform edge swap
                        ordered_tickets[i:j+1] = reversed(ordered_tickets[i:j+1])
                        improved = True
                        
    return ordered_tickets + other_tickets
