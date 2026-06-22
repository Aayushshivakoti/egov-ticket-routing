import os
import csv
import random

def generate():
    # English context values
    streets_en = [
        "New Road", "Kanti Path", "Durbar Marg", "Putalisadak", 
        "Tripureshwor", "Baneshwor", "Chabahil", "Kalimati", 
        "Kupondole", "Jawalakhel", "Thamel", "Maitighar"
    ]
    landmarks_en = [
        "Central Park", "Civil Mall", "Ward Office", "Public Library", 
        "Golden Temple", "City Hospital", "Metro Station", "Supermarket",
        "Police Station", "Standard School", "Post Office"
    ]
    times_en = [
        "three days", "yesterday morning", "the past 48 hours", 
        "last week", "almost a month", "two days", "five days"
    ]
    
    # English Templates mapped to Department ID
    templates_en = {
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

    # Nepali context values
    streets_ne = [
        "नयाँ सडक", "कान्तिपथ", "दरबारमार्ग", "पुतलीसडक",
        "त्रिपुरेश्वर", "बानेश्वर", "चाबहिल", "कालिमाटी",
        "कुपोण्डोल", "जावलाखेल", "ठमेल", "माइतीघर"
    ]
    landmarks_ne = [
        "पार्क", "मल", "वडा कार्यालय", "पुस्तकालय",
        "मन्दिर", "अस्पताल", "मेट्रो स्टेशन", "सुपरमार्केट",
        "प्रहरी कार्यालय", "विद्यालय", "हुलाक कार्यालय"
    ]
    times_ne = [
        "तीन दिनदेखि", "हिजो बिहानदेखि", "गत २४ घण्टादेखि",
        "गत हप्तादेखि", "झन्डै एक महिनादेखि", "दुई दिनदेखि", "पाँच दिनदेखि"
    ]

    # Nepali Templates mapped to Department ID
    templates_ne = {
        1: [ # Water Supply
            "{street} को {landmark} नजिकै खानेपानीको पाइप फुटेको छ।",
            "{street} को मुख्य पाइप फुटेर सडकभरी पानी बगिरहेको छ।",
            "हाम्रो टोलमा {time} खानेपानी आपूर्ति बन्द भएको छ।",
            "{street} को धारामा ढलको फोहोर र गन्ध मिसिएको पानी आउँदैछ।",
            "{street} मा पानीको प्रेसर निकै कम छ, पिउने पानी पाउन मुस्किल भयो।",
            "{street} को मुख्य ढल मार्ग टालिएर {landmark} नजिकै फोहोर पानी उम्लिरहेको छ।",
            "यस महिना खानेपानीको बिल अत्याधिक त्रुटिपूर्ण तरिकाले आएको छ।",
            "खानेपानीको मुख्य भल्भ बिग्रेर लगातार पानी नष्ट भइरहेको छ।",
            "{street} को नालामा अवरोध सिर्जना भई ठूलो दुर्गन्ध फैलिरहेको छ।",
            "{landmark} नजिकै ढलको पानी खानेपानीको पाइपमा मिसिएको शंका छ।"
        ],
        2: [ # Roads & Infrastructure
            "{street} मा ठूलो खाल्डो परेकोले गर्दा सवारी जाम भइरहेको छ।",
            "{time} नयाँ जडान गरिएका सडक बत्तीहरू बलेका छैनन्।",
            "{street} को फुटपाथ भत्किएको कारण पैदलयात्रुलाई हिँड्न निकै सास्ती छ।",
            "{street} र मुख्य सडक जोड्ने चोकको ट्राफिक लाइट बिग्रेको छ।",
            "सडक मर्मतको कार्य अलपत्र छाडेर हिँडेकाले आवतजावतमा बाधा पुगेको छ।",
            "{landmark} नजिकैको पुलमा ठूले-ठूला चिराहरू परेका छन्।",
            "{landmark} वरपरको फुटपाथका टायलहरू गायब भएका छन्।",
            "{landmark} विद्यालय नजिकै जेब्रा क्रसिङ नहुँदा बालबालिकालाई जोखिम छ।",
            "{street} मा म्यानहोलको ढक्कन हराएकोले गर्दा दुर्घटना हुन सक्छ।",
            "{street} को सडक पिच भत्किएर मसिना गिटीहरू उडेर मोटरसाइकल चिप्लिरहेका छन्।"
        ],
        3: [ # Electricity Authority
            "{street} मा विगत {time} पटक-पटक बत्ती जाने-आउने गरिरहेको छ।",
            "विद्युत भोल्टेज अत्याधिक घटबढ हुँदा घरका उपकरणहरू बिग्रने डर भयो।",
            "{street} को बिजुलीको पोलबाट नाङ्गो तार भुइँमा खसेर जोखिम सिर्जना गरेको छ।",
            "{landmark} नजिकैको ट्रान्सफर्मर पड्किएर ठूलो आवाज आयो र बत्ती निभ्यो।",
            "हाम्रो घरको बिजुलीको मिटर असामान्य रूपमा छिटो कुदिरहेको छ।",
            "बिजुलीको महसुल बिल र मिटरको अंक मेल खाएको छैन।",
            "{street} का सडक बत्तीहरूमा विद्युत आपूर्ति नहुँदा अँध्यारो छ।",
            "{street} को बिजुलीको पोल ढल्न लागेर जोखिमपूर्ण अवस्थामा छ।",
            "{landmark} नजिकैको मुख्य जङ्क्सन बक्समा सर्ट सर्किट भयो।",
            "{landmark} नजिकै ओभरहेड तारहरूबाट बिजुलीको झिल्काहरू निस्किरहेका छन्।"
        ],
        4: [ # Waste Management
            "{street} मा रहेको सार्वजनिक फोहोर फाल्ने ठाउँ फोहोरले भरिएर गन्हाएको छ।",
            "{time} फोहोर संकलन गर्ने गाडी हाम्रो टोलमा आएको छैन।",
            "{landmark} नजिकै गैरकानूनी रूपमा फोहोर फालिएकोले दुर्गन्ध छ।",
            "{landmark} को सार्वजनिक पार्कमा जताततै प्लास्टिक र बोतलहरू फालिएका छन्।",
            "{street} को सडक छेउमा जनावरको मृत शरीर कुहिएर गन्हाइरहेको छ।",
            "बजार क्षेत्रमा फोहोर नउठाइएकोले तरकारी कुहिएर दुर्गन्ध फैलिएको छ।",
            "हाम्रो टोल {landmark} नजिकै फोहोर वर्गीकरण गर्ने भाँडो छैन।",
            "फोहोर संकलकहरूले अतिरिक्त रकम मागिरहेका छन्।",
            "प्लास्टिक जन्य फोहोरले नालाहरू थुनिएका छन्।",
            "{landmark} नजिकै अस्पतालको फोहोर खुल्ला रूपमा फालिएको छ।"
        ],
        5: [ # General Administration
            "व्यापार नवीकरण प्रक्रिया र दस्तुरको विवरण चाहियो।",
            "जन्म दर्ता प्रमाणपत्रमा नाम सच्याउने निवेदन {time} अलपत्र छ।",
            "सम्पत्ति कर अनलाइन मार्फत भुक्तानी गर्दा प्रणालीले काम गरेन।",
            "वडा कार्यालयका कर्मचारीहरूले सेवाग्राहीसँग अमर्यादित व्यवहार गरे।",
            "{street} मा नयाँ पार्किङ अनुमतिको लागि कसरी निवेदन दिने होला?",
            "वडा कार्यालयमा नागरिक बडापत्र स्पष्ट देखिने गरी राखिएको छैन।",
            "नागरिकताको प्रमाणपत्र प्रतिलिपि लिन के-के कागजात चाहिन्छ?",
            "सम्पत्ति कर बुझाउने प्रक्रिया बुझाइदिनु हुन अनुरोध छ।",
            "कार्यालय समयमा सम्बन्धित फाँटका कर्मचारी सिटमा भेटिँदैनन्।",
            "सूचनाको हक अन्तर्गत सूचना माग गर्न दर्ता शाखा कहाँ छ?"
        ]
    }

    dataset = []
    
    # 1. Generate 50 English examples per department (250 total)
    for dept_id, list_templates in templates_en.items():
        for _ in range(50):
            template = random.choice(list_templates)
            text = template.format(
                street=random.choice(streets_en),
                landmark=random.choice(landmarks_en),
                time=random.choice(times_en)
            )
            dataset.append((text, dept_id))

    # 2. Generate 10 Nepali examples per department (50 total)
    for dept_id, list_templates in templates_ne.items():
        for _ in range(10):
            template = random.choice(list_templates)
            text = template.format(
                street=random.choice(streets_ne),
                landmark=random.choice(landmarks_ne),
                time=random.choice(times_ne)
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
        
    print(f"Generated {len(dataset)} examples (250 English + 50 Nepali) in dataset.csv successfully!")

if __name__ == "__main__":
    generate()
