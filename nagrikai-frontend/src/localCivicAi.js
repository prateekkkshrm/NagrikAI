// localCivicAi.js - Offline Local Civic Intelligence Engine for NagrikAI
// Provides reliable, zero-dependency civic intelligence for Greater Noida & NCR.
// Grounded in verified official portals:
// - GNIDA Citizen Services: https://investgnida.in/myGNIDAServices/CitizenServices/Citizen_Services.aspx
// - GNIDA Official Portal: https://www.greaternoidaauthority.in
// - NPCL Official Portal: https://www.noidapower.com
// - UP Emergency Helpline: 112

// Verified Municipal Knowledge Base for Greater Noida & Gautam Budh Nagar
export const SERVICE_KNOWLEDGE = {
  serviceName: "NagrikAI",
  region: "Greater Noida & Gautam Budh Nagar (NCR)",
  officialPortal: {
    name: "GNIDA Citizen Services Portal",
    url: "https://investgnida.in/myGNIDAServices/CitizenServices/Citizen_Services.aspx",
    description: "Official portal for lodging complaints, checking published citizen charter delivery periods, and tracking municipal service requests in Greater Noida."
  },
  pillars: [
    {
      title: "Real-Time Hazard & Road Intelligence",
      description: "Live crowdsourced & sensor-verified tracking of potholes, broken pavement, flooded underpasses, and road hazards across Alpha, Beta, Gamma, Delta, Pari Chowk, and Knowledge Park."
    },
    {
      title: "Automated Municipal Complaint Handoff",
      description: "Geotagged reports formatted and prepared for handoff to responsible GNIDA divisions or NPCL with published indicative citizen service delivery periods."
    },
    {
      title: "GroundTruth AI Verification",
      description: "Computer-vision verification comparing before-and-after photographic evidence to confirm repairs were genuinely completed before tickets are closed."
    },
    {
      title: "Civic Navigation Engine",
      description: "Dynamic route planning powered by Valhalla routing that steers drivers and commuters around active road craters, waterlogged choke points, and Pari Chowk delays."
    },
    {
      title: "Bilingual Civic Voice Assistant",
      description: "Two-way voice and text assistance in English and हिन्दी, empowering every citizen to speak or type in their preferred language."
    }
  ],
  // Verified official municipal contacts and exact published indicative service delivery periods
  authorities: [
    {
      dept: "GNIDA Civil Maintenance (Roads & Infrastructure)",
      scope: "Potholes, broken roads, damaged footpaths, and central verges",
      portalUrl: "https://investgnida.in/myGNIDAServices/CitizenServices/Citizen_Services.aspx",
      callCenter: "0120-2336046 / 47 / 48 / 49",
      helpline: "0120-2336030",
      whatsappGrievance: "8800203912",
      indicativeTimeline: "No specific fixed resolution timeline for general pothole repairs is published on the official Citizen Services portal. Timelines depend on site inspection and whether engineering maintenance tenders are active. Road complaints can be logged directly on the portal for departmental review."
    },
    {
      dept: "NPCL (Noida Power Company Limited) & GNIDA Electrical Wing",
      scope: "Streetlights, electrical outages, dangling cables, and distribution transformers",
      callCenter: "0120-6226666",
      emergencyNumber: "9718722222 (Electrical Hazards / Sparks / Accidents Only)",
      whatsappSupport: "0120-6226666",
      portalUrl: "https://investgnida.in/myGNIDAServices/CitizenServices/Citizen_Services.aspx",
      indicativeTimeline: "Published indicative delivery period on GNIDA's official Citizen Services portal: 7 days for streetlight repair (not a guaranteed completion time)."
    },
    {
      dept: "GNIDA Water & Sewerage Department",
      scope: "Pipeline leaks, low pressure, contaminated water, drain blockages, and sewer overflows",
      portalUrl: "https://investgnida.in/myGNIDAServices/CitizenServices/Citizen_Services.aspx",
      callCenter: "0120-2336046 / 47 / 48 / 49",
      helpline: "0120-2336030",
      whatsappGrievance: "8800203912",
      indicativeTimeline: "Published indicative delivery periods on GNIDA's official Citizen Services portal: Minor water supply leakage: 1 day; Minor drain repair: 10 days (published indicative periods, not guaranteed completion times)."
    },
    {
      dept: "GNIDA Public Health & Sanitation Department",
      scope: "Garbage collection, overflowing dumpsters, road sweeping, and waste clearance",
      portalUrl: "https://investgnida.in/myGNIDAServices/CitizenServices/Citizen_Services.aspx",
      callCenter: "0120-2336046 / 47 / 48 / 49",
      helpline: "0120-2336030",
      whatsappGrievance: "8800203912",
      indicativeTimeline: "Published indicative delivery period on GNIDA's official Citizen Services portal: Waste / garbage collection: 5 days (published indicative period, not a guaranteed completion time)."
    },
    {
      dept: "Gautam Budh Nagar Traffic Police",
      scope: "Pari Chowk congestion, traffic signals, illegal parking, and route diversions",
      trafficHelpline: "9971009001",
      emergency: "112",
      indicativeTimeline: "Field patrol units are dispatched based on real-time traffic priority."
    },
    {
      dept: "UP Emergency Helpline (Dial 112)",
      scope: "Immediate police, fire, road accident, or medical rescue emergencies",
      emergency: "112",
      indicativeTimeline: "Immediate emergency dispatch across Uttar Pradesh."
    }
  ]
};

// Common navigation screens in NagrikAI
const SCREENS = {
  CAPTURE: "Capture report",
  EXPLORE_MAP: "Explore map",
  NAVIGATION: "Civic navigation",
  WEATHER: "Weather & air",
  HISTORY: "Report history",
  AUTHORITY: "Responsible authority",
  HOME: "Home"
};

// Helper: Normalize query text for intent matching
function cleanText(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Helper: Extract conversational history context (prior civic subject or sector)
function extractHistoryContext(chatHistory = []) {
  const context = {
    priorTopic: null,
    priorSector: null
  };

  const recent = (chatHistory || []).slice(-4).reverse();
  for (const m of recent) {
    const text = cleanText((m.textEn || "") + " " + (m.textHi || "") + " " + (m.text || ""));
    if (!context.priorSector) {
      if (text.includes("pari chowk") || text.includes("परी चौक")) context.priorSector = "Pari Chowk";
      else if (text.includes("alpha") || text.includes("अल्फा")) context.priorSector = "Alpha";
      else if (text.includes("beta") || text.includes("बीटा")) context.priorSector = "Beta";
      else if (text.includes("gamma") || text.includes("गामा")) context.priorSector = "Gamma";
      else if (text.includes("delta") || text.includes("डेल्टा")) context.priorSector = "Delta";
      else if (text.includes("knowledge park") || text.includes("नॉलेज पार्क")) context.priorSector = "Knowledge Park";
      else if (text.includes("surajpur") || text.includes("सूरजपुर")) context.priorSector = "Surajpur";
      else if (text.includes("greater noida west") || text.includes("नोएडा वेस्ट")) context.priorSector = "Greater Noida West";
    }

    if (!context.priorTopic) {
      if (text.includes("pothole") || text.includes("road") || text.includes("गड्ढ") || text.includes("सड़क")) context.priorTopic = "roads";
      else if (text.includes("water") || text.includes("पानी") || text.includes("सीवर") || text.includes("drain")) context.priorTopic = "water";
      else if (text.includes("garbage") || text.includes("kachra") || text.includes("कचरा") || text.includes("कूड़ा")) context.priorTopic = "garbage";
      else if (text.includes("light") || text.includes("बिजली") || text.includes("लाइट") || text.includes("npcl")) context.priorTopic = "electricity";
      else if (text.includes("traffic") || text.includes("जाम") || text.includes("ट्रैफिक")) context.priorTopic = "traffic";
    }
  }

  return context;
}

// Main Intent Detection & Response Generator
export function generateOfflineCivicResponse(query, liveReports = [], isVoiceNote = false, duration = 0, chatHistory = [], currentLang = "English") {
  const rawQ = (query || "").trim();

  // 1. Silent or empty query handling
  if (isVoiceNote && !rawQ) {
    return {
      en: "I couldn't hear any audio in your voice note. Please speak closer to the microphone or type your question below.",
      hi: "आपके वॉयसनोट में कोई आवाज़ नहीं सुनाई दी। कृपया माइक के पास बोलें या अपना प्रश्न लिखकर पूछें।",
      actions: []
    };
  }

  if (!rawQ) {
    return {
      en: "Please enter a question or speak your query about civic issues, roads, sanitation, or NagrikAI features.",
      hi: "कृपया नागरिक सुविधाओं, सड़क, सफाई, पानी या नागरिक एआई के बारे में कोई प्रश्न पूछें।",
      actions: []
    };
  }

  const clean = cleanText(rawQ);
  const context = extractHistoryContext(chatHistory);

  // 2. Complaint Status / Ticket Follow-up Inquiry Detection
  // Highest priority intent: intercepts any inquiry asking about complaint or ticket status/update/resolution
  const isComplaintStatusQuery =
    /(has\s+my\s+(complaint|ticket|issue|report)\s+been\s+(resolved|fixed|done|updated|closed)|is\s+my\s+(complaint|ticket|issue|report)\s+(resolved|fixed|done|closed|in\s+progress)|what\s+is\s+the\s+status\s+of\s+my\s+(complaint|ticket|issue|report)|status\s+of\s+my\s+(complaint|ticket|issue|report)|complaint\s+status|ticket\s+status|any\s+update\s+on\s+my\s+(report|complaint|ticket|issue)|is\s+my\s+issue\s+fixed|did\s+(anyone|they)\s+fix\s+my|check\s+my\s+(complaint|ticket|status)|(kya|meri)\s+.*(complaint|ticket|issue|report)\s+.*(resolve|fixed|hua|hui|status)|मेरी\s+शिकायत\s+(का\s+क्या\s+हुआ|कहाँ\s+तक\s+पहुँची|हल\s+हो\s+गई|सुलझ\s+गई|की\s+स्थिति)|क्या\s+मेरी\s+शिकायत\s+हल\s+हो\s+गई|शिकायत\s+की\s+स्थिति|शिकायत\s+का\s+क्या\s+हुआ|समाधान\s+हो\s+गया\s+क्या|स्टेटस\s+क्या\s+है|अपडेट\s+क्या\s+है|टैंकर\s+आया|काम\s+शुरू\s+हुआ)/i.test(clean);

  if (isComplaintStatusQuery) {
    return {
      en: "I cannot check live complaint status because this local assistant does not have access to GNIDA's live municipal ticket database. To view the current status of your submitted report:\n\n1. Open the 'Report history' section in NagrikAI to view your submitted reports and GroundTruth AI verification.\n2. Track your complaint directly on the official GNIDA Citizen Services portal using your reference number:\n   https://investgnida.in/myGNIDAServices/CitizenServices/Citizen_Services.aspx\n3. Contact GNIDA authorities directly:\n   • GNIDA Call Center: 0120-2336046 / 47 / 48 / 49\n   • GNIDA Central Helpline: 0120-2336030\n   • GNIDA WhatsApp Grievance: 8800203912",
      hi: "मैं आपकी शिकायत की लाइव स्थिति की जाँच नहीं कर सकता क्योंकि इस स्थानीय सहायक के पास GNIDA के लाइव म्युनिसिपल टिकट डेटाबेस का एक्सेस नहीं है। अपनी दर्ज शिकायत की वर्तमान स्थिति जानने के लिए:\n\n1. NagrikAI में 'Report history' (शिकायत इतिहास) सेक्शन खोलें और अपनी रिपोर्ट व ग्राउंडट्रुथ सत्यापन देखें।\n2. अपने संदर्भ नंबर के साथ GNIDA के आधिकारिक सिटीजन सर्विसेज पोर्टल पर सीधे ट्रैक करें:\n   https://investgnida.in/myGNIDAServices/CitizenServices/Citizen_Services.aspx\n3. सीधे GNIDA से संपर्क करें:\n   • GNIDA कॉल सेंटर: 0120-2336046 / 47 / 48 / 49\n   • GNIDA केंद्रीय हेल्पलाइन: 0120-2336030\n   • GNIDA व्हाट्सएप शिकायत: 8800203912",
      actions: [
        { labelEn: "View Report History", labelHi: "शिकायत इतिहास देखें", screen: SCREENS.HISTORY },
        { labelEn: "Responsible Authority", labelHi: "विभाग संपर्क", screen: SCREENS.AUTHORITY },
        { labelEn: "File New Report", labelHi: "नई शिकायत दर्ज करें", screen: SCREENS.CAPTURE }
      ]
    };
  }

  // 2.5 Electrical Hazards & Emergencies (Highest Priority over road, pothole, and general civic intents)
  // Intercepts fallen wires, sparking, broken poles, transformer fire, live electrical wires on roads/streets
  const isElectricalHazard =
    /(live\s+(electrical\s+)?wire|fallen\s+(electric(al)?\s+)?(wire|cable|pole)|dangling\s+(wire|cable)|broken\s+(live\s+)?(wire|cable)|exposed\s+(electrical\s+)?cable|sparking|sparks|electric(al)?\s+wires?\s+sparking|transformer\s+fire|electric(al)?\s+shock|electric(al)?\s+accident|electric(al)?\s+hazard|electric(al)?\s+emergency|power\s+emergency|करंट\s*वाला\s*तार|तार\s*(सड़क\s*पर\s*)?गिर|बिजली\s*का\s*तार\s*(टूट|गिर|लटक)|बिजली\s*(के\s*तार\s*)?में\s*आग|ट्रांसफॉर्मर\s*(में\s*)?आग|खंभा\s*गिर|करंट)/i.test(clean) ||
    (/(emergency|hazard|danger|खतरा|आपातकाल)/i.test(clean) && /(electric|power|wire|cable|transformer|npcl|बिजली|तार|खंभा)/i.test(clean)) ||
    (/(wire|cable|तार)/i.test(clean) && /(electric|power|live|fallen|spark|current|करंट|बिजली|शॉक)/i.test(clean));

  if (isElectricalHazard) {
    return {
      en: "⚠️ CRITICAL ELECTRICAL SAFETY ADVISORY:\n\n• Stay far away from the fallen wire (maintain a minimum distance of at least 10 meters / 33 feet).\n• Never touch the wire, pole, or anything in contact with it (including water, puddles, vehicles, or fences).\n• Keep other pedestrians, motorists, and children far away from the hazard zone.\n• Do not attempt to move, lift, or cut the wire under any circumstances.\n\nEMERGENCY CONTACTS FOR GREATER NOIDA:\n• NPCL Electrical Emergency Helpline: 9718722222 (Immediate reporting for live sparking, fallen poles, snapped cables, and electrical hazards).\n• UP Emergency: 112 (For immediate life-threatening danger, severe accidents, or fire).\n• NPCL 24x7 Customer Care: 0120-6226666 (For general billing and non-emergency electricity complaints; do not use as a substitute for the emergency line).",
      hi: "⚠️ अति आवश्यक विद्युत सुरक्षा चेतावनी:\n\n• गिरे या लटके हुए बिजली के तार से बहुत दूर रहें (कम से कम 10 मीटर / 33 फीट की सुरक्षित दूरी बनाए रखें)।\n• तार, खंभे या उसके संपर्क में आने वाली किसी भी वस्तु (पानी, वाहन, बाड़) को भूलकर भी न छुएं।\n• अन्य राहगीरों, वाहनों और बच्चों को उस स्थान से दूर रखें।\n• तार को हटाने या हिलाने का बिल्कुल प्रयास न करें।\n\nग्रेटर नोएडा आपातकालीन संपर्क:\n• NPCL विद्युत आपातकालीन हेल्पलाइन: 9718722222 (स्पार्किंग, टूटे या लटके बिजली के तार, गिरे खंभे और खुले करंट की तत्काल सूचना के लिए)।\n• यूपी आपातकालीन सेवा: 112 (जीवन के गंभीर खतरे, भीषण दुर्घटना या आग लगने पर)।\n• NPCL 24x7 ग्राहक सेवा: 0120-6226666 (सामान्य पूछताछ व गैर-आपातकालीन शिकायतों के लिए; आपातकाल में इसका उपयोग न करें)।",
      actions: [
        { labelEn: "Responsible Authority", labelHi: "विभाग संपर्क", screen: SCREENS.AUTHORITY },
        { labelEn: "Report Hazard", labelHi: "खतरा दर्ज करें", screen: SCREENS.CAPTURE }
      ]
    };
  }
  if (/^(hello|hi|hey|namaste|pranam|good\s+morning|good\s+evening|kaise\s+ho|नमस्ते|प्रणाम|हाय|हेलो)(\s|$)/i.test(clean)) {
    return {
      en: "Hello! I am your NagrikAI civic assistant for Greater Noida and NCR. I can help you report road hazards, sanitation dumps, streetlight faults, or water issues, and guide you with verified GNIDA & NPCL contact channels and published indicative delivery periods. How can I help you today?",
      hi: "नमस्ते! मैं ग्रेटर नोएडा और एनसीआर के लिए आपका नागरिक एआई सहायक हूँ। मैं आपको सड़क, कचरा, स्ट्रीटलाइट या पानी की समस्याओं की रिपोर्ट दर्ज करने और GNIDA व NPCL के सत्यापित संपर्क चैनलों तथा प्रकाशित सांकेतिक डिलीवरी अवधियों की जानकारी दे सकता हूँ। आज मैं आपकी क्या सहायता करूँ?",
      actions: [
        { labelEn: "Report Issue", labelHi: "समस्या दर्ज करें", screen: SCREENS.CAPTURE },
        { labelEn: "Safe Routes", labelHi: "सुरक्षित मार्ग", screen: SCREENS.NAVIGATION },
        { labelEn: "Explore Map", labelHi: "नक्शा देखें", screen: SCREENS.EXPLORE_MAP }
      ]
    };
  }

  // 4. Who are you / NagrikAI overview
  if (/(who\s+are\s+you|what\s+is\s+nagrikai|about\s+nagrikai|what\s+can\s+you\s+do|तुम\s+कौन\s+हो|नागरिक\s*एआई\s+क्या\s+है|आप\s+क्या\s+कर\s+सकते\s+हो)/i.test(clean)) {
    return {
      en: "NagrikAI is an intelligent civic platform for Greater Noida & NCR designed to assist citizens with municipal services. Key capabilities include: 1) Geotagged civic reporting with camera evidence, 2) GroundTruth AI to verify before-and-after repair photos, 3) Civic navigation steering around road craters and waterlogged areas, and 4) Direct alignment with GNIDA's Citizen Services portal (investgnida.in) and NPCL helplines.",
      hi: "नागरिक एआई ग्रेटर नोएडा और एनसीआर के नागरिकों के लिए एक नागरिक सेवा प्लेटफॉर्म है। इसकी मुख्य विशेषताएं हैं: 1) फोटो और जीपीएस के साथ नागरिक शिकायतें, 2) काम पूरा होने की पुष्टि के लिए ग्राउंडट्रुथ एआई विज़न, 3) गड्ढों और जलभराव से बचाने वाला सुरक्षित नेविगेशन, और 4) GNIDA के सिटीजन सर्विसेज पोर्टल (investgnida.in) और NPCL हेल्पलाइन के साथ सीधा मार्गदर्शन।",
      actions: [
        { labelEn: "Report a Hazard", labelHi: "समस्या रिपोर्ट करें", screen: SCREENS.CAPTURE },
        { labelEn: "View Authorities", labelHi: "प्राधिकरण विवरण", screen: SCREENS.AUTHORITY },
        { labelEn: "Open Navigation", labelHi: "नेविगेशन खोलें", screen: SCREENS.NAVIGATION }
      ]
    };
  }

  // 5. GroundTruth AI Verification
  if (/(groundtruth|ground\s+truth|verification|verify\s+repair|before\s+and\s+after|सत्यापन|ग्राउंडट्रुथ)/i.test(clean)) {
    return {
      en: "GroundTruth AI is NagrikAI's visual audit tool. When you report a civic hazard, it captures geotagged photos. When repair work is submitted by maintenance teams, GroundTruth AI compares the before-and-after photographs using computer vision to confirm actual on-ground resolution before closing the issue in your history.",
      hi: "ग्राउंडट्रुथ एआई (GroundTruth AI) नागरिक एआई का दृश्य सत्यापन टूल है। जब आप किसी नागरिक समस्या की रिपोर्ट करते हैं, तो यह जीपीएस-युक्त फोटो दर्ज करता है। जब रखरखाव टीम काम पूरा होने की फोटो अपलोड करती है, तो कंप्यूटर विज़न द्वारा पहले और बाद की तस्वीरों का मिलान करके पुष्टि की जाती है।",
      actions: [
        { labelEn: "Track Reports", labelHi: "रिपोर्ट ट्रैक करें", screen: SCREENS.HISTORY },
        { labelEn: "Capture Issue", labelHi: "फोटो खींचें", screen: SCREENS.CAPTURE }
      ]
    };
  }

  // 6. Civic Navigation & Safe Routes (Pari Chowk, avoid potholes)
  if (/(navigation|route|avoid\s+potholes|pari\s+chowk\s+traffic|choke\s+point|valhalla|ड्राइविंग|नेविगेशन|रास्ता|मार्ग|जाम|ट्रैफिक)/i.test(clean)) {
    return {
      en: "NagrikAI's Civic Navigation Engine dynamically steers commuters around reported road craters, severe potholes, and flooded underpasses across Greater Noida (including Pari Chowk and Knowledge Park). You can activate it by tapping 'Civic navigation' to find the smoothest and safest path.",
      hi: "नागरिक एआई का सिविक नेविगेशन ग्रेटर नोएडा में सक्रिय गड्ढों, टूटी सड़कों और जलभराव वाले चौराहों (जैसे परी चौक व नॉलेज पार्क) से बचाकर सुरक्षित रास्ता दिखाता है। सबसे सुरक्षित और सुगम मार्ग के लिए 'Civic navigation' पर टैप करें।",
      actions: [
        { labelEn: "Start Civic Navigation", labelHi: "नेविगेशन शुरू करें", screen: SCREENS.NAVIGATION },
        { labelEn: "Explore City Hazards", labelHi: "शहर के खतरे देखें", screen: SCREENS.EXPLORE_MAP }
      ]
    };
  }

  // 7. Potholes & Damaged Roads
  if (/(pothole|road|crater|pavement|broken\s+road|divider|speed\s+breaker|गड्ढ|सड़क|फुटपाथ|टूटी\s+सड़क|रोड)/i.test(clean) || (context.priorTopic === "roads" && /(how\s+to\s+fix|lodge\s+complaint|file\s+complaint|department\s+number|phone|helpline|शिकायत\s+दर्ज|नंबर)/i.test(clean))) {
    return {
      en: "Road and pothole maintenance in Greater Noida falls under the GNIDA Civil Maintenance division.\n\n• Verified Channels: GNIDA Call Center (0120-2336046 to 49), Helpline (0120-2336030), WhatsApp Grievance (8800203912), or the official Citizen Services portal (investgnida.in).\n• Service Delivery Period: GNIDA's official Citizen Services portal does not specify a fixed delivery period for pothole repairs. Timelines depend on site inspection and active civil maintenance contracts; no completion time is guaranteed.\n\nYou can submit geotagged photos through NagrikAI to track before-and-after verification.",
      hi: "ग्रेटर नोएडा में सड़कों और गड्ढों की मरम्मत GNIDA सिविल मेंटेनेंस विभाग के अधीन आती है।\n\n• सत्यापित संपर्क: GNIDA कॉल सेंटर (0120-2336046 से 49), हेल्पलाइन (0120-2336030), व्हाट्सएप शिकायत (8800203912), या आधिकारिक सिटीजन सर्विसेज पोर्टल (investgnida.in)।\n• डिलीवरी अवधि: GNIDA के आधिकारिक सिटीजन सर्विसेज पोर्टल पर गड्ढों की मरम्मत के लिए कोई निश्चित डिलीवरी अवधि प्रकाशित नहीं है। मरम्मत की समय-सीमा मौके के निरीक्षण और अनुबंधों पर निर्भर करती है; इसके पूरा होने का कोई निश्चित समय तय नहीं है।\n\nसत्यापन ट्रैक करने के लिए आप NagrikAI में फोटो सहित रिपोर्ट दर्ज कर सकते हैं।",
      actions: [
        { labelEn: "Report Pothole", labelHi: "गड्ढा रिपोर्ट करें", screen: SCREENS.CAPTURE },
        { labelEn: "Safe Route Navigation", labelHi: "गड्ढा-मुक्त मार्ग", screen: SCREENS.NAVIGATION },
        { labelEn: "Authority Contacts", labelHi: "विभाग संपर्क", screen: SCREENS.AUTHORITY }
      ]
    };
  }

  // 8. Garbage Collection, Sanitation & Waste Dumping
  if (/(garbage|kachra|waste|trash|dump|sanitation|sweeping|cleanliness|dustbin|कचरा|कूड़ा|सफाई|सफाईकर्मी|गंदगी|डस्टबिन)/i.test(clean) || (context.priorTopic === "garbage" && /(how\s+to|lodge\s+complaint|file\s+complaint|department\s+number|helpline|शिकायत\s+दर्ज|नंबर)/i.test(clean))) {
    return {
      en: "Public sanitation and waste management are administered by the GNIDA Public Health & Sanitation Department.\n\n• Verified Channels: GNIDA Call Center (0120-2336046 to 49), WhatsApp Grievance (8800203912), or via the Citizen Services portal at investgnida.in.\n• Published Indicative Delivery Period: 5 days for waste/garbage collection (as published on GNIDA's official Citizen Services portal; this is an indicative delivery period, not a guaranteed completion time).\n\nCapture an image via 'Capture report' with accurate GPS coordinates to direct sanitation teams to the exact spot.",
      hi: "सार्वजनिक स्वच्छता और कचरा प्रबंधन GNIDA स्वास्थ्य एवं स्वच्छता विभाग द्वारा देखा जाता है।\n\n• सत्यापित संपर्क: GNIDA कॉल सेंटर (0120-2336046 से 49), व्हाट्सएप शिकायत (8800203912), या सिटीजन सर्विसेज पोर्टल (investgnida.in)।\n• प्रकाशित सांकेतिक डिलीवरी अवधि: कचरा / अपशिष्ट संग्रह के लिए 5 दिन (GNIDA के आधिकारिक सिटीजन सर्विसेज पोर्टल पर प्रकाशित; यह एक सांकेतिक डिलीवरी अवधि है, कार्य पूरा होने का गारंटीकृत समय नहीं)।\n\nसटीक स्थान पर सफाई दल भेजने के लिए 'Capture report' से फोटो खींचकर दर्ज करें।",
      actions: [
        { labelEn: "Report Garbage Dump", labelHi: "कचरे की रिपोर्ट करें", screen: SCREENS.CAPTURE },
        { labelEn: "Explore Hazard Map", labelHi: "सफाई नक्शा देखें", screen: SCREENS.EXPLORE_MAP },
        { labelEn: "Sanitation Details", labelHi: "विभाग विवरण", screen: SCREENS.AUTHORITY }
      ]
    };
  }

  // 9. Water Supply, Pipeline Leaks & Drainage / Waterlogging
  const isWaterOrDrain =
    /(water|pipe|leak|drain|sewer|waterlogging|overflow|contamination|no\s+water|पानी|लीकेज|सीवर|नाली|जलभराव|गंदा\s+पानी|नल)/i.test(clean) ||
    (context.priorTopic === "water" && /(how\s+to|lodge\s+complaint|file\s+complaint|department\s+number|helpline|शिकायत\s+दर्ज|नंबर)/i.test(clean));

  if (isWaterOrDrain) {
    const isDrainSpecific =
      /(drain|sewer|waterlogging|overflow|नाली|सीवर|जलभराव)/i.test(clean) &&
      !/(water\s+supply|drinking\s+water|water\s+leakage|pipeline\s+leak|पानी\s+की\s+सप्लाई|पीने\s+का\s+पानी|पानी\s+लीक)/i.test(clean);

    const isWaterSpecific =
      /(water\s+supply|drinking\s+water|water\s+leak|pipeline\s+leak|pipe\s+leak|water\s+contamination|no\s+water|नल|पानी\s+की\s+सप्लाई|पीने\s+का\s+पानी|पानी\s+लीक|पाइपलाइन\s+लीक|गंदा\s+पानी)/i.test(clean) &&
      !/(drain|sewer|waterlogging|नाली|सीवर|जलभराव)/i.test(clean);

    if (isDrainSpecific) {
      return {
        en: "Drainage and sewer maintenance in Greater Noida are handled by the GNIDA Water & Sewerage Department.\n\n• Verified Channels: GNIDA Call Center (0120-2336046 to 49), Helpline (0120-2336030), WhatsApp Grievance (8800203912), or online at investgnida.in.\n• Published Indicative Delivery Period: 10 days for minor drain repair (as published on GNIDA's official Citizen Services portal; this is an indicative delivery period, not a guaranteed completion time).\n\nPlease log a geotagged photo via 'Capture report' so our community map warns commuters of active waterlogging.",
        hi: "ग्रेटर नोएडा में नाली और सीवर रखरखाव का कार्य GNIDA जल एवं सीवरेज विभाग द्वारा संभाला जाता है।\n\n• सत्यापित संपर्क: GNIDA कॉल सेंटर (0120-2336046 से 49), हेल्पलाइन (0120-2336030), व्हाट्सएप शिकायत (8800203912), या investgnida.in पर ऑनलाइन।\n• प्रकाशित सांकेतिक डिलीवरी अवधि: नाली की छोटी मरम्मत के लिए 10 दिन (GNIDA के आधिकारिक सिटीजन सर्विसेज पोर्टल पर प्रकाशित; यह एक सांकेतिक डिलीवरी अवधि है, कार्य पूरा होने का गारंटीकृत समय नहीं)।\n\nजलभराव की जानकारी दूसरों तक पहुँचाने हेतु 'Capture report' से फोटो दर्ज करें।",
        actions: [
          { labelEn: "Report Drain Issue", labelHi: "नाली/सीवर समस्या रिपोर्ट करें", screen: SCREENS.CAPTURE },
          { labelEn: "Check Waterlogged Roads", labelHi: "जलभराव वाले मार्ग देखें", screen: SCREENS.EXPLORE_MAP },
          { labelEn: "Water Authority Contact", labelHi: "जल विभाग संपर्क", screen: SCREENS.AUTHORITY }
        ]
      };
    }

    if (isWaterSpecific) {
      return {
        en: "Drinking water distribution and pipeline repairs are handled by the GNIDA Water & Sewerage Department.\n\n• Verified Channels: GNIDA Call Center (0120-2336046 to 49), Helpline (0120-2336030), WhatsApp Grievance (8800203912), or online at investgnida.in.\n• Published Indicative Delivery Period: 1 day for minor water supply leakage (as published on GNIDA's official Citizen Services portal; this is an indicative delivery period, not a guaranteed completion time).\n\nPlease log a geotagged photo via 'Capture report' for prompt departmental inspection.",
        hi: "पेयजल आपूर्ति और पाइपलाइन मरम्मत का कार्य GNIDA जल एवं सीवरेज विभाग द्वारा संभाला जाता है।\n\n• सत्यापित संपर्क: GNIDA कॉल सेंटर (0120-2336046 से 49), हेल्पलाइन (0120-2336030), व्हाट्सएप शिकायत (8800203912), या investgnida.in पर ऑनलाइन।\n• प्रकाशित सांकेतिक डिलीवरी अवधि: पानी की छोटी पाइपलाइन लीकेज के लिए 1 दिन (GNIDA के आधिकारिक सिटीजन सर्विसेज पोर्टल पर प्रकाशित; यह एक सांकेतिक डिलीवरी अवधि है, कार्य पूरा होने का गारंटीकृत समय नहीं)।\n\nशीघ्र विभागीय निरीक्षण हेतु 'Capture report' से फोटो दर्ज करें।",
        actions: [
          { labelEn: "Report Water Leak", labelHi: "पानी लीकेज रिपोर्ट करें", screen: SCREENS.CAPTURE },
          { labelEn: "Water Authority Contact", labelHi: "जल विभाग संपर्क", screen: SCREENS.AUTHORITY }
        ]
      };
    }

    // General water supply and drainage queries → Show both timelines
    return {
      en: "Drinking water distribution, pipeline repairs, and sewer/stormwater drains are supervised by the GNIDA Water & Sewerage Department.\n\n• Verified Channels: GNIDA Call Center (0120-2336046 to 49), Helpline (0120-2336030), WhatsApp Grievance (8800203912), or online at investgnida.in.\n• Published Indicative Delivery Periods (GNIDA Citizen Services portal):\n  - Minor water supply leakage: 1 day\n  - Minor drain repair: 10 days\n  (These are published indicative delivery periods, not guaranteed completion times).\n\nPlease log a geotagged photo via 'Capture report' so our community map warns commuters of active waterlogging.",
      hi: "पेयजल आपूर्ति, पाइपलाइन मरम्मत और सीवर/नाली की देखरेख GNIDA जल एवं सीवरेज विभाग करता है।\n\n• सत्यापित संपर्क: GNIDA कॉल सेंटर (0120-2336046 से 49), हेल्पलाइन (0120-2336030), व्हाट्सएप शिकायत (8800203912), या investgnida.in पर ऑनलाइन।\n• प्रकाशित सांकेतिक डिलीवरी अवधियां (GNIDA सिटीजन सर्विसेज पोर्टल):\n  - पानी की छोटी पाइपलाइन लीकेज: 1 दिन\n  - नाली की छोटी मरम्मत: 10 दिन\n  (ये प्रकाशित सांकेतिक डिलीवरी अवधियां हैं, कार्य पूरा होने का गारंटीकृत समय नहीं)।\n\nजलभराव की जानकारी दूसरों तक पहुँचाने हेतु 'Capture report' से फोटो दर्ज करें।",
      actions: [
        { labelEn: "Report Water/Drain Issue", labelHi: "पानी/सीवर समस्या रिपोर्ट करें", screen: SCREENS.CAPTURE },
        { labelEn: "Check Waterlogged Roads", labelHi: "जलभराव वाले मार्ग देखें", screen: SCREENS.EXPLORE_MAP },
        { labelEn: "Water Authority Contact", labelHi: "जल विभाग संपर्क", screen: SCREENS.AUTHORITY }
      ]
    };
  }

  // 10. Streetlights & Electrical Outages (NPCL)
  if (/(light|streetlight|dark|pole|electricity|power\s+cut|npcl|dangling\s+wire|transformer|लाइट|स्ट्रीटलाइट|अंधेरा|बिजली|तार|खंभा)/i.test(clean) || (context.priorTopic === "electricity" && /(how\s+to|lodge\s+complaint|file\s+complaint|department\s+number|helpline|शिकायत\s+दर्ज|नंबर)/i.test(clean))) {
    return {
      en: "Streetlighting fixtures and electrical distribution in Greater Noida are handled through NPCL (Noida Power Company Limited) and GNIDA's Electrical Wing.\n\n• Verified Channels: NPCL 24x7 Customer Care & WhatsApp (0120-6226666); Electrical Emergency (9718722222 for sparking/accidents only); GNIDA Citizen Services portal (investgnida.in).\n• Published Indicative Delivery Period: 7 days for streetlight repair (as published on GNIDA's official Citizen Services portal; this is an indicative delivery period, not a guaranteed completion time).\n\nYou can log broken streetlights or dark stretches in NagrikAI to alert fellow commuters.",
      hi: "ग्रेटर नोएडा में स्ट्रीटलाइट्स और विद्युत आपूर्ति का कार्य NPCL (नोएडा पावर कंपनी लिमिटेड) और GNIDA विद्युत शाखा द्वारा संभाला जाता है।\n\n• सत्यापित संपर्क: NPCL 24x7 ग्राहक सेवा व व्हाट्सएप (0120-6226666); आपातकालीन विद्युत खतरा (9718722222 - केवल स्पार्किंग/दुर्घटनाओं के लिए); GNIDA सिटीजन सर्विसेज पोर्टल (investgnida.in)।\n• प्रकाशित सांकेतिक डिलीवरी अवधि: स्ट्रीटलाइट मरम्मत के लिए 7 दिन (GNIDA के आधिकारिक सिटीजन सर्विसेज पोर्टल पर प्रकाशित; यह एक सांकेतिक डिलीवरी अवधि है, कार्य पूरा होने का गारंटीकृत समय नहीं)।\n\nअंधेरे मार्गों या टूटी स्ट्रीटलाइट की रिपोर्ट आप NagrikAI में दर्ज कर सकते हैं।",
      actions: [
        { labelEn: "Report Broken Streetlight", labelHi: "स्ट्रीटलाइट रिपोर्ट करें", screen: SCREENS.CAPTURE },
        { labelEn: "NPCL Contact Info", labelHi: "NPCL संपर्क", screen: SCREENS.AUTHORITY }
      ]
    };
  }

  // 11. Public Safety, Emergency & Police (Traffic Police included only when traffic is referenced)
  if (/(emergency|police|safety|crime|accident|ambulance|fire|112|suraksha|पुलिस|दुर्घटना|आपातकाल|सुरक्षा|एम्बुलेंस|खतरा)/i.test(clean)) {
    const isTrafficQuery = /(traffic|congestion|jam|vehicle|car|bike|parking|signal|चौक|परी\s+चौक|जाम|गाड़ी|सड़क\s+जाम)/i.test(clean);

    if (isTrafficQuery) {
      return {
        en: "For immediate life safety, accidents, fire, or crime emergencies, dial UP Emergency 112 immediately.\n\n• Gautam Budh Nagar Traffic Police Helpline: 9971009001 (For traffic congestion, vehicle breakdowns, signal faults, or road diversions across Greater Noida).\n• For permanent municipal road hazards, you can log a geotagged report in NagrikAI.",
        hi: "तत्काल व्यक्तिगत सुरक्षा, गंभीर सड़क दुर्घटना, आग या अपराध की आपात स्थिति के लिए तुरंत 112 डायल करें।\n\n• गौतमबुद्ध नगर ट्रैफिक पुलिस हेल्पलाइन: 9971009001 (ग्रेटर नोएडा में भारी जाम, वाहन खराबी, सिग्नल खराबी या रूट डायवर्जन के लिए)।\n• सड़क के स्थायी बुनियादी खतरों के लिए नागरिक एआई में रिपोर्ट दर्ज करें।",
        actions: [
          { labelEn: "View Authority Contacts", labelHi: "आपातकालीन नंबर", screen: SCREENS.AUTHORITY },
          { labelEn: "Report Road Hazard", labelHi: "सड़क खतरा दर्ज करें", screen: SCREENS.CAPTURE },
          { labelEn: "Civic Navigation", labelHi: "नेविगेशन", screen: SCREENS.NAVIGATION }
        ]
      };
    }

    return {
      en: "For immediate emergencies, accidents, fire, or police assistance in Greater Noida and Uttar Pradesh, dial UP Emergency 112 immediately. For municipal civic hazards (such as road craters, open manholes, or waterlogging), you can log a ticket in NagrikAI.",
      hi: "ग्रेटर नोएडा और उत्तर प्रदेश में किसी भी आपात स्थिति, दुर्घटना, आग या पुलिस सहायता के लिए तुरंत 112 डायल करें। सड़क के बुनियादी खतरों (जैसे गड्ढे, खुले सीवर या जलभराव) के लिए आप नागरिक एआई में रिपोर्ट दर्ज कर सकते हैं।",
      actions: [
        { labelEn: "View Authority Contacts", labelHi: "आपातकालीन नंबर", screen: SCREENS.AUTHORITY },
        { labelEn: "Report Civic Hazard", labelHi: "खतरा दर्ज करें", screen: SCREENS.CAPTURE }
      ]
    };
  }

  // 12. How to file a complaint / step-by-step
  if (/(how\s+to\s+(report|file|submit|lodge)|process\s+to\s+complain|kaise\s+complain\s+kare|शिकायत\s+कैसे\s+करें|रिपोर्ट\s+कैसे\s+दर्ज\s+करें)/i.test(clean)) {
    return {
      en: "To report a civic hazard in NagrikAI: 1) Tap 'Capture report' below, 2) Snap a clear photo of the issue (pothole, garbage dump, dark streetlight), 3) Confirm the automatically detected GPS location, 4) Choose the category and tap Submit. You can also file directly through the official GNIDA Citizen Services portal (investgnida.in) or the GNIDA WhatsApp helpline (8800203912).",
      hi: "नागरिक एआई में शिकायत दर्ज करने के चरण: 1) नीचे 'Capture report' पर टैप करें, 2) समस्या (गड्ढा, कचरा, बंद स्ट्रीटलाइट) की स्पष्ट फोटो लें, 3) अपने जीपीएस स्थान की पुष्टि करें, 4) श्रेणी चुनकर 'सबमिट' करें। इसके अलावा आप सीधे GNIDA के सिटीजन सर्विसेज पोर्टल (investgnida.in) या GNIDA व्हाट्सएप हेल्पलाइन (8800203912) पर भी शिकायत दर्ज कर सकते हैं।",
      actions: [
        { labelEn: "Open Camera / Report", labelHi: "कैमरा खोलें / रिपोर्ट करें", screen: SCREENS.CAPTURE },
        { labelEn: "View My Past Reports", labelHi: "पिछली रिपोर्ट देखें", screen: SCREENS.HISTORY }
      ]
    };
  }

  // 13. Weather & Air Quality (AQI)
  if (/(weather|aqi|air\s+quality|pollution|smog|temperature|मौसम|हवा|प्रदूषण|तापमान)/i.test(clean)) {
    return {
      en: "You can monitor live weather forecasts, temperature, and Air Quality Index (AQI) readings across Gautam Budh Nagar directly within the app on our dedicated 'Weather & air' screen.",
      hi: "आप ऐप में दिए गए 'Weather & air' स्क्रीन पर जाकर ग्रेटर नोएडा और गौतमबुद्ध नगर का लाइव मौसम, तापमान और वायु गुणवत्ता सूचकांक (AQI) देख सकते हैं।",
      actions: [
        { labelEn: "Open Weather & AQI", labelHi: "मौसम और एक्यूआई देखें", screen: SCREENS.WEATHER },
        { labelEn: "Civic Navigation", labelHi: "नेविगेशन", screen: SCREENS.NAVIGATION }
      ]
    };
  }

  // 14. Sector specific inquiries (Alpha, Beta, Gamma, Pari Chowk, Knowledge Park, etc.)
  if (/(pari\s+chowk|alpha|beta|gamma|delta|knowledge\s+park|surajpur|greater\s+noida\s+west|परी\s+चौक|अल्फा|बीटा|गामा|नॉलेज\s+पार्क)/i.test(clean)) {
    const sectorName = clean.includes("pari chowk") || clean.includes("परी चौक") ? "Pari Chowk"
      : clean.includes("alpha") || clean.includes("अल्फा") ? "Alpha I & II"
      : clean.includes("beta") || clean.includes("बीटा") ? "Beta I & II"
      : clean.includes("knowledge park") || clean.includes("नॉलेज पार्क") ? "Knowledge Park"
      : "Greater Noida";

    return {
      en: `${sectorName} is actively monitored by NagrikAI. You can view community-reported road hazards, open potholes, and municipal works on the Explore Map, or start Civic Navigation to automatically steer around known delays in this area.`,
      hi: `${sectorName} नागरिक एआई द्वारा सक्रिय रूप से मॉनिटर किया जाता है। आप Explore Map पर इस क्षेत्र के सक्रिय गड्ढों और नागरिक कार्यों को देख सकते हैं, या जाम व गड्ढों से बचने के लिए Civic Navigation शुरू कर सकते हैं।`,
      actions: [
        { labelEn: `Explore Hazards in ${sectorName}`, labelHi: `${sectorName} के खतरे देखें`, screen: SCREENS.EXPLORE_MAP },
        { labelEn: "Safe Route Navigation", labelHi: "सुरक्षित मार्ग खोजें", screen: SCREENS.NAVIGATION },
        { labelEn: "Report Issue Here", labelHi: "यहाँ समस्या दर्ज करें", screen: SCREENS.CAPTURE }
      ]
    };
  }

  // 15. Thanks and appreciation
  if (/(thank\s*you|thanks|shukriya|dhanyawad|धन्यवाद|शुक्रिया|बहुत\s+अच्छा)/i.test(clean)) {
    return {
      en: "You're very welcome! Together we keep Greater Noida clean, safe, and well-maintained. Let me know if you need help with anything else.",
      hi: "आपका बहुत-बहुत धन्यवाद! हम मिलकर ग्रेटर नोएडा को स्वच्छ, सुरक्षित और सुव्यवस्थित बना रहे हैं। यदि आपको कोई अन्य सहायता चाहिए तो अवश्य बताएं।",
      actions: [
        { labelEn: "Report an Issue", labelHi: "समस्या दर्ज करें", screen: SCREENS.CAPTURE },
        { labelEn: "Civic Map", labelHi: "नागरिक नक्शा", screen: SCREENS.EXPLORE_MAP }
      ]
    };
  }

  // 16. Fallback with helpful clarification prompts
  return {
    en: "I want to make sure I give you accurate civic guidance. Are you looking to report a hazard (such as a pothole, garbage dump, or broken streetlight), find safe navigation routes around road issues, or contact a municipal authority in Greater Noida?",
    hi: "मैं आपको सटीक नागरिक जानकारी देना चाहता हूँ। क्या आप किसी समस्या (जैसे गड्ढा, कचरा या बंद स्ट्रीटलाइट) की रिपोर्ट दर्ज करना चाहते हैं, सुरक्षित मार्ग खोजना चाहते हैं, या ग्रेटर नोएडा के किसी विभाग से संपर्क करना चाहते हैं?",
    actions: [
      { labelEn: "Report a Civic Issue", labelHi: "समस्या दर्ज करें", screen: SCREENS.CAPTURE },
      { labelEn: "Safe Driving Routes", labelHi: "सुरक्षित मार्ग", screen: SCREENS.NAVIGATION },
      { labelEn: "Municipal Authorities", labelHi: "नगर निगम विभाग", screen: SCREENS.AUTHORITY },
      { labelEn: "City Hazard Map", labelHi: "शहर का नक्शा", screen: SCREENS.EXPLORE_MAP }
    ]
  };
}
