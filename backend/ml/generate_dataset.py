import os
import csv
import random

def generate():
    streets = [
        "New Road", "Kanti Path", "Durbar Marg", "Putalisadak", 
        "Tripureshwor", "Baneshwor", "Chabahil", "Kalimati", 
        "Kupondole", "Jawalakhel", "Thamel", "Maitighar"
    ]
    
    landmarks = [
        "Central Park", "Civil Mall", "Ward Office", "Public Library", 
        "Golden Temple", "City Hospital", "Metro Station", "Supermarket",
        "Police Station", "Standard School", "Post Office"
    ]
    
    times = [
        "three days", "yesterday morning", "the past 48 hours", 
        "last week", "almost a month", "two days", "five days"
    ]
    
    # Templates mapped to Department ID
    templates = {
        1: [ # Water Supply
            "Water leak in {street} near {landmark}.",
            "The main pipe broke at {street} and it is flooding the street.",
            "No water supply in our locality since {time}.",
            "Tap water is coming out dirty and smells like sewage in {street}.",
            "Low water pressure in {street} making it hard to get drinking water.",
            "Main sewerage pipeline is clogged and overflowing near {landmark}.",
            "Water supply billing error, showing excessive charges this month.",
            "Municipal water valve is broken and leaking constantly.",
            "We have a drainage blockage in {street} causing a terrible smell.",
            "Water treatment plant near {landmark} is leaking chemical smell.",
            "Sewage water is mixing with drinking water lines near {landmark}.",
            "The drainage system at {street} is completely blocked.",
            "No drinking water tanker has arrived in {street} for {time}.",
            "Public tap in {street} is broken and wasting clean water.",
            "Manhole drainage is backing up into our backyard near {landmark}."
        ],
        2: [ # Roads & Infrastructure
            "Huge pothole in {street} causing traffic jams.",
            "Street lights are not working at {street} since {time}.",
            "Sidewalk on {street} is broken and dangerous for pedestrians.",
            "Traffic signal at the intersection of {street} and the highway is broken.",
            "Road construction is left incomplete and blocking the driveway.",
            "Bridge near {landmark} has developed cracks in the pillars.",
            "Pavement tiles are missing near {landmark} path.",
            "No zebra crossing near {landmark} school, very risky for children.",
            "Pothole filled with rainwater caused a bike crash on {street}.",
            "Manhole cover is missing on {street}, needs urgent placement.",
            "Road gravel is loose on {street}, causing motorcycles to skid.",
            "Street sign at the corner of {street} has fallen down.",
            "Speed breaker on {street} is not painted and invisible at night.",
            "Flooded underpass at {street} is completely impassable.",
            "Landslide debris is blocking the side lane at {street}."
        ],
        3: [ # Electricity Authority
            "Frequent power outages in {street} for the past {time}.",
            "High voltage fluctuations are damaging home appliances.",
            "Electric wire is hanging dangerously low from the pole at {street}.",
            "Transformer blew up near {landmark} with a loud noise, now there is no power.",
            "Electricity meter is faulty and runs too fast.",
            "Electricity bill has a mismatch with the actual meter reading in our house.",
            "No street lights have electricity on {street}.",
            "Power pole is bent and looks like it will fall soon on {street}.",
            "Short circuit occurred in the main junction box near {landmark}.",
            "Load shedding schedules are not being followed in {street}.",
            "Electric sparkles are flying off the overhead lines near {landmark}.",
            "Power supply has been disconnected without any warning in {street}.",
            "Loose electrical cabling is lying on the wet street near {landmark}.",
            "Main power grid station is offline and there is a total blackout.",
            "The solar streetlights on {street} are broken."
        ],
        4: [ # Waste Management
            "Communal garbage dumpster is overflowing in {street}.",
            "Garbage collection truck has not visited {street} for {time}.",
            "Illegal garbage dumping near {landmark} causing health hazards.",
            "Public park near {landmark} is filled with litter and plastic bottles.",
            "Dead animal body is lying on the side of {street} and rotting.",
            "Market street is not swept and has heaps of rotting vegetables.",
            "No recycling bins available in our neighborhood near {landmark}.",
            "Garbage collectors are demanding extra money for trash disposal.",
            "Waste sorting center is creating a lot of dust and noise.",
            "Plastic waste is choking the drains in {street}.",
            "Medical waste is dumped out in the open near {landmark}.",
            "Chemical dumping in {street} is ruining the local soil.",
            "Nobody has cleared the autumn leaves and plastic trash in {street}.",
            "Public toilet near {landmark} is dirty and full of litter.",
            "Debris from construction is dumped illegally on the road at {street}."
        ],
        5: [ # General Administration
            "Query regarding trade license renewal procedure and fees.",
            "Birth certificate correction application is stuck for {time}.",
            "Need information on property tax payment methods.",
            "Staff at the municipal registration desk was extremely rude today.",
            "How can I apply for a new parking permit in {street}?",
            "Citizens charter is not displayed at the local ward office.",
            "Marriage registration certificate has a typing mistake in the name.",
            "Grievance redressal officer is never present during public hours at {landmark}.",
            "Online portal for tax payment is down and throwing errors.",
            "Need checklist for building approval documents.",
            "Citizenship application status has not updated in {time}.",
            "Corruption and bribery going on at the licensing office near {landmark}.",
            "Ward office at {street} is closed before working hours.",
            "How do I request information under the Right to Information Act?",
            "Official stamp is missing on our land registry documents."
        ]
    }
    
    dataset = []
    
    # Generate 50 examples per department (50 * 5 = 250 records)
    for dept_id, list_templates in templates.items():
        for _ in range(50):
            template = random.choice(list_templates)
            text = template.format(
                street=random.choice(streets),
                landmark=random.choice(landmarks),
                time=random.choice(times)
            )
            dataset.append((text, dept_id))
            
    # Shuffle dataset
    random.shuffle(dataset)
    
    # Write to CSV
    script_dir = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(script_dir, 'dataset.csv'), 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['text', 'department_id'])
        writer.writerows(dataset)
        
    print(f"Generated {len(dataset)} examples in dataset.csv successfully!")

if __name__ == "__main__":
    generate()
