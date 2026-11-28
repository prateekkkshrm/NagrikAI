import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  Mic,
  Volume2,
  ChevronLeft,
  Square,
  Navigation,
  Languages,
  Check,
  MessageSquare,
  Plus,
  Play,
  Pause,
  X,
  Trash2,
  Tag,
  HelpCircle
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { getAuthenticatedUser, saveConversationTurn, loadOwnConversation, activeConversationKey, PENDING_CONVERSATION_KEY, START_NEW_CONVERSATION_KEY } from "./aiConversationStore";
import "./askAI.css";

// Verified Municipal & Service Knowledge Base for Greater Noida
const SERVICE_KNOWLEDGE = {
  serviceName: "NagrikAI",
  region: "Greater Noida & Gautam Budh Nagar (NCR)",
  pillars: [
    {
      title: "Real-Time Hazard & Road Intelligence",
      description: "Live crowdsourced & sensor-verified tracking of potholes, broken pavement, flooded underpasses, and road hazards across Alpha, Beta, Pari Chowk, and Knowledge Park."
    },
    {
      title: "Automated Municipal Complaint Handoff",
      description: "Geotagged reports automatically formatted and routed to responsible GNIDA divisions or NPCL with enforceable Service Level Agreements (SLAs)."
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
  authorities: [
    { dept: "GNIDA Civil Maintenance", scope: "Roads, Potholes, Footpaths", sla: "48-72 hours", phone: "0120-2326301" },
    { dept: "NPCL & GNIDA Electrical Wing", scope: "Streetlights, Power outages, Dangling wires", sla: "24 hours", phone: "0120-6229400" },
    { dept: "GNIDA Water & Sewerage", scope: "Drain overflow, Waterlogging, Pipeline leaks", sla: "24-48 hours", phone: "0120-2326308" },
    { dept: "GNIDA Public Health & Sanitation", scope: "Garbage dumps, Waste clearance, Sweeping", sla: "12-24 hours", phone: "0120-2326305" },
    { dept: "Traffic Police Control Room", scope: "Pari Chowk congestion, Illegal parking, Signals", sla: "Patrol Dispatch", phone: "9971009001" }
  ]
};

// Conversational AI Model Response Engine (Natural, dynamic, non-bookish conversational reasoning)
async function callGeminiAPI(prompt, chatHistory = []) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (typeof window !== "undefined" && window.localStorage?.getItem("nagrikai_gemini_api_key"));
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const historyParts = chatHistory.slice(-4).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.textEn || m.textHi || "" }]
    }));

    const systemPrompt = `You are NagrikAI, an empathetic, conversational, and direct civic AI companion for citizens of Greater Noida, India.
Guidelines:
1. Answer the user's specific question naturally and conversationally, like a knowledgeable local resident.
2. Never give repetitive, bookish, or bureaucratic walls of text. Be clear, concise, and helpful.
3. If they ask about local infrastructure (roads, water, NPCL electricity, GNIDA, Pari Chowk, Knowledge Park, Alpha/Beta sectors, metro), give direct practical information.
4. Return pure JSON with keys:
{
  "en": "Direct conversational answer in clear, friendly English",
  "hi": "Direct conversational answer in simple everyday spoken Hindi (बोलचाल की भाषा)",
  "actions": [
    {"labelEn": "Short Button Label", "labelHi": "बटन लेबल", "screen": "Capture report" | "Explore map" | "Civic navigation" | "Weather & air" | "Report history" | "Responsible authority" | "Home"}
  ]
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          ...historyParts,
          { role: "user", parts: [{ text: `${systemPrompt}\n\nUser Question: ${prompt}` }] }
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    });

    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      const parsed = JSON.parse(text);
      if (parsed.en && parsed.hi) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Live Gemini API call bypassed:", err);
  }
  return null;
}

// Dynamic Local Conversational AI Generator (Active whenever no external LLM key is configured)
function generateLocalConversationalResponse(query, liveReports = [], isVoiceNote = false, duration = 0) {
  const rawQ = (query || "").trim();
  const q = rawQ.toLowerCase();

  // 1. Silent / Brief Voice Note
  if (isVoiceNote && (!q || q === "voice note" || q === "voice note civic query" || q === "वॉयसनोट द्वारा प्रश्न")) {
    return {
      en: `I heard your ${duration || 2}-second voice note! 🎙️ It was a bit quiet on my end. You can tell me what you need—whether you'd like to report a road issue, check Pari Chowk traffic, or track a complaint. How can I help?`,
      hi: `मैंने आपका ${duration || 2} सेकंड का वॉयसनोट सुना! 🎙️ आवाज थोड़ी धीमी थी। आप मुझे बोलकर बता सकते हैं कि आपको क्या चाहिए—जैसे सड़क का गड्ढा रिपोर्ट करना, परी चौक का ट्रैफिक देखना या शिकायत ट्रैक करना। बताइए, मैं क्या मदद करूँ?`,
      actions: [
        { labelEn: "Report an Issue", labelHi: "समस्या रिपोर्ट करें", screen: "Capture report" },
        { labelEn: "Explore City Map", labelHi: "नक्शा देखें", screen: "Explore map" },
        { labelEn: "Check Traffic", labelHi: "ट्रैफिक देखें", screen: "Civic navigation" }
      ]
    };
  }

  // Detect specific locations / sectors
  let matchedSector = null;
  if (/alpha\s*(1|i\b|one)/.test(q)) matchedSector = "Alpha I";
  else if (/alpha\s*(2|ii\b|two)/.test(q)) matchedSector = "Alpha II";
  else if (/alpha/.test(q)) matchedSector = "Alpha Sector";
  else if (/beta\s*(1|i\b|one)/.test(q)) matchedSector = "Beta I";
  else if (/beta\s*(2|ii\b|two)/.test(q)) matchedSector = "Beta II";
  else if (/beta/.test(q)) matchedSector = "Beta Sector";
  else if (/gamma/.test(q)) matchedSector = "Gamma Sector";
  else if (/delta/.test(q)) matchedSector = "Delta Sector";
  else if (/pari\s*chowk/.test(q) || /परी\s*चौक/.test(q)) matchedSector = "Pari Chowk";
  else if (/knowledge\s*park/.test(q)) matchedSector = "Knowledge Park";
  else if (/surajpur/.test(q) || /सूरजपुर/.test(q)) matchedSector = "Surajpur";
  else if (/jagat\s*farm/.test(q)) matchedSector = "Jagat Farm";
  else if (/kasna/.test(q) || /कासना/.test(q)) matchedSector = "Kasna";
  else if (/greater\s*noida\s*west|noida\s*extension|gaur\s*city/.test(q)) matchedSector = "Greater Noida West";
  else if (/expressway/.test(q)) matchedSector = "Noida-Greater Noida Expressway";
  else if (/ecotech/.test(q)) matchedSector = "Ecotech Industrial Area";

  // Intent: Greetings & Casual Banter
  if (/^(hi|hello|hey|namaste|pranam|namaskar|good\s*(morning|evening|afternoon)|hola)\b/i.test(q) || /^(हेलो|नमस्ते|प्रणाम|नमस्कार)/.test(q)) {
    return {
      en: `Hey there! 👋 I'm NagrikAI, your Greater Noida civic assistant. I'm here to help you get things done around the city—from reporting broken roads and checking local traffic to tracking municipal complaints. What's on your mind today?`,
      hi: `नमस्ते! 👋 मैं आपका नागरिक एआई सहायक हूँ। ग्रेटर नोएडा में सड़कों के गड्ढे रिपोर्ट करने, ट्रैफिक जानने या नगर पालिका की शिकायतें ट्रैक करने में मैं आपकी पूरी मदद कर सकता हूँ। बताइए, आज क्या जानकारी चाहिए?`,
      actions: [
        { labelEn: "Report Road Issue", labelHi: "सड़क समस्या बताएं", screen: "Capture report" },
        { labelEn: "Pari Chowk Traffic", labelHi: "परी चौक ट्रैफिक", screen: "Civic navigation" },
        { labelEn: "Explore Map", labelHi: "शहर का नक्शा", screen: "Explore map" }
      ]
    };
  }

  // Intent: How are you / Casual chat
  if (q.includes("how are you") || q.includes("kaise ho") || q.includes("kya haal") || q.includes("हाल") || q.includes("कैसे हो")) {
    return {
      en: `I'm doing great, thank you for asking! 😊 Keeping an eye on Greater Noida's roads, weather, and civic reports so you have a smoother day. How's everything going in your sector?`,
      hi: `मैं बिल्कुल ठीक हूँ, पूछने के लिए शुक्रिया! 😊 ग्रेटर नोएडा की सड़कों, मौसम और शिकायतों पर नज़र बनाए हुए हूँ ताकि आपका दिन आसान रहे। आपके सेक्टर में सब कैसा चल रहा है?`,
      actions: [
        { labelEn: "Check My Sector Map", labelHi: "मेरे सेक्टर का नक्शा", screen: "Explore map" },
        { labelEn: "Today's Air & Weather", labelHi: "आज का मौसम व हवा", screen: "Weather & air" }
      ]
    };
  }

  // Intent: Thanks / Appreciation
  if (/^(thank|thanks|shukriya|dhanyawad|dhanyavad|शुक्रिया|धन्यवाद)/i.test(q)) {
    return {
      en: `You're very welcome! Happy to help make our city cleaner and better. Reach out anytime you notice something that needs fixing or if you need a quick route update. 🙌`,
      hi: `आपका बहुत-बहुत स्वागत है! शहर को बेहतर बनाने में मदद करके मुझे खुशी होती है। जब भी कोई समस्या दिखे या कोई रास्ता पूछना हो, बेझिझक पूछिएगा। 🙌`,
      actions: [
        { labelEn: "Explore City Map", labelHi: "नक्शा देखें", screen: "Explore map" },
        { labelEn: "Home", labelHi: "होम", screen: "Home" }
      ]
    };
  }

  // Intent: Who are you / Identity
  if (q.includes("who are you") || q.includes("tum kaun") || q.includes("aap kaun") || q.includes("what is your name") || q.includes("तुम्हारा नाम") || q.includes("आप कौन")) {
    return {
      en: `I am **NagrikAI**—an AI assistant designed specifically for residents of Greater Noida. I connect citizens directly with local municipal services (GNIDA, NPCL, Traffic Police). You can think of me as your pocket guide to city issues, live traffic, and verified repair updates!`,
      hi: `मैं **नागरिक एआई (NagrikAI)** हूँ—ग्रेटर नोएडा के नागरिकों के लिए खास तौर पर बनाया गया एआई सहायक। मेरा काम आपको नगर निगम सेवाओं (जीएनआईडीए, एनपीसीएल, ट्रैफिक पुलिस) से जोड़ना और आपकी शिकायतों पर असली कार्रवाई सुनिश्चित करना है।`,
      actions: [
        { labelEn: "What can you do?", labelHi: "आप क्या कर सकते हैं?", screen: "Explore map" },
        { labelEn: "File a Report", labelHi: "रिपोर्ट दर्ज करें", screen: "Capture report" }
      ]
    };
  }

  // Intent: What can this app do / Features overview
  if (q.includes("what can you do") || q.includes("what do you do") || q.includes("what does this app do") || q.includes("features") || q.includes("service") || q.includes("services") || q.includes("kya kaam") || q.includes("kya karta hai") || q.includes("सुविधा") || q.includes("सेवा")) {
    return {
      en: `Here are the main things I can do for you in Greater Noida:\n\n• **Report Road & Street Hazards:** Snap a photo of a pothole, open manhole, or garbage pile. The app tags your GPS coordinates and sends it to the responsible GNIDA/NPCL team.\n• **Avoid Traffic & Hazards:** Check live routes that steer you clear of waterlogged spots and Pari Chowk jams.\n• **GroundTruth Verification:** When a repair is claimed, our AI verifies before-and-after photos so tickets aren't closed without real work.\n• **Live Air Quality & Weather:** Real-time CPCB AQI readings and forecasts for Greater Noida.\n• **Direct Emergency Helplines:** Instant contact numbers for municipal water, electricity, and road teams.`,
      hi: `नागरिक एआई आपकी इन मुख्य चीज़ों में मदद करता है:\n\n• **सड़क व नागरिक समस्याएं दर्ज करना:** गड्ढे, खुले नाले या कचरे की फोटो खींचें—ऐप खुद लोकेशन जोड़कर संबंधित विभाग को भेज देगा।\n• **ट्रैफिक व जलभराव से बचाव:** परी चौक और मुख्य रास्तों पर जाम या पानी भरे रास्तों से बचकर निकलने का सुरक्षित रास्ता देखना।\n• **ग्राउंडट्रूथ फोटो सत्यापन:** काम पूरा होने पर फोटो की जांच होती है ताकि बिना मरम्मत काम बंद न हो।\n• **लाइव वायु गुणवत्ता (AQI) व मौसम:** ग्रेटर नोएडा की सटीक हवा और मौसम की जानकारी।\n• **आपातकालीन हेल्पलाइन:** बिजली, पानी और सड़क विभागों के सीधे फोन नंबर।`,
      actions: [
        { labelEn: "Try Filing a Report", labelHi: "रिपोर्ट करके देखें", screen: "Capture report" },
        { labelEn: "Explore City Map", labelHi: "नक्शा देखें", screen: "Explore map" },
        { labelEn: "Air Quality Info", labelHi: "हवा की स्थिति", screen: "Weather & air" }
      ]
    };
  }

  // Intent: Weather, Air Quality (AQI), Pollution, Smog, Rain
  if (q.includes("weather") || q.includes("aqi") || q.includes("air quality") || q.includes("pollution") || q.includes("smog") || q.includes("rain") || q.includes("barish") || q.includes("hawa") || q.includes("मौसम") || q.includes("हवा") || q.includes("प्रदूषण") || q.includes("बारिश")) {
    return {
      en: `Greater Noida's air quality and weather fluctuate significantly by season. In winter, PM2.5 levels often push the AQI into Poor or Very Poor territory, especially along the Expressway and industrial corridors. On sunny clear days, it stays in the Moderate range.\n\nTip: You can view real-time hourly CPCB AQI breakdown, humidity, and a 3-day forecast in our **Weather & Air** tab!`,
      hi: `ग्रेटर नोएडा में हवा की गुणवत्ता और मौसम मौसम के हिसाब से बदलता रहता है। सर्दियों में एक्सप्रेसवे और आसपास पीएम 2.5 का स्तर बढ़ने से AQI अक्सर 'खराब' श्रेणी में पहुँच जाता है। वहीं सामान्य दिनों में यह मध्यम रहता है।\n\nसुझाव: आप ऐप के **Weather & air** स्क्रीन पर जाकर प्रति घंटे का सटीक AQI और 3 दिन का मौसम पूर्वानुमान देख सकते हैं!`,
      actions: [
        { labelEn: "Open Weather & Air", labelHi: "मौसम व हवा देखें", screen: "Weather & air" },
        { labelEn: "Back to Home", labelHi: "होम पर जाएं", screen: "Home" }
      ]
    };
  }

  // Intent: Roads, Potholes & Sector maintenance
  if (q.includes("pothole") || q.includes("potholes") || q.includes("gaddha") || q.includes("gaddhe") || q.includes("khadda") || q.includes("road") || q.includes("sadak") || q.includes("asphalt") || q.includes("crater") || q.includes("footpath") || q.includes("broken road") || q.includes("गड्ढा") || q.includes("सड़क")) {
    const sectorInfo = matchedSector ? `in **${matchedSector}**` : "in your sector";
    return {
      en: `For road repairs and potholes ${sectorInfo}:\n\nGNIDA's Civil Maintenance Division handles asphalt resurfacing and patchwork under a targeted 48-to-72 hour turnaround. If you've come across a hazardous pothole or broken lane, you can snap a quick photo with 'Capture report'. The GPS coordinates will auto-fill, and we'll escalate it directly to the field maintenance crew.`,
      hi: `${matchedSector ? `**${matchedSector}** में` : "आपके क्षेत्र में"} टूटी सड़कों या गड्ढों के लिए:\n\nजीएनआईडीए का सिविल रखरखाव विभाग 48 से 72 घंटे के भीतर पैचवर्क और डामर मरम्मत का काम करता है। अगर आपको कहीं गहरा गड्ढा या टूटी सड़क दिखे, तो 'Capture report' से तुरंत फोटो खींचकर भेजें। ऐप आपकी लोकेशन जोड़कर शिकायत सीधे संबंधित जेई/इंजीनियर तक पहुँचा देगा।`,
      actions: [
        { labelEn: "Report This Pothole", labelHi: "गड्ढा रिपोर्ट करें", screen: "Capture report" },
        { labelEn: "Check Road Hazards on Map", labelHi: "नक्शे पर गड्ढे देखें", screen: "Explore map" }
      ]
    };
  }

  // Intent: Traffic, Commute, Pari Chowk, Driving Routes
  if (q.includes("traffic") || q.includes("jam") || q.includes("rush") || q.includes("pari chowk") || q.includes("route") || q.includes("direction") || q.includes("commute") || q.includes("navigation") || q.includes("जाम") || q.includes("ट्रैफिक") || q.includes("रास्ता")) {
    return {
      en: `Traffic in Greater Noida is generally smooth on the wide master roads, with the exception of **Pari Chowk roundabout** during morning (8:30–10:30 AM) and evening (6:00–8:30 PM) rush hours. Ongoing construction near Surajpur connector can also create slowdowns.\n\nSmart tip: Use our **Civic navigation** to preview routes that automatically bypass known potholes, flooded underpasses, and choke points!`,
      hi: `ग्रेटर नोएडा में चौड़ी सड़कों के कारण आमतौर पर ट्रैफिक ठीक रहता है, लेकिन **परी चौक चौराहे** पर सुबह (8:30-10:30) और शाम (6:00-8:30) के समय अक्सर जाम लग जाता है। सूरजपुर मुख्य मार्ग पर भी वाहनों की गति धीमी रहती है।\n\nसलाह: आप हमारे **Civic navigation** स्क्रीन पर जाकर ऐसा रास्ता चुन सकते हैं जो खराब सड़कों और जलभराव वाले रास्तों से बचाकर निकाले!`,
      actions: [
        { labelEn: "Open Civic Navigation", labelHi: "सुरक्षित मार्ग नेविगेशन", screen: "Civic navigation" },
        { labelEn: "View Traffic on Map", labelHi: "नक्शे पर ट्रैफिक देखें", screen: "Explore map" }
      ]
    };
  }

  // Intent: Water supply, Leaks, Drains, Waterlogging & Sewage
  if (q.includes("water") || q.includes("paani") || q.includes("pani") || q.includes("leak") || q.includes("drain") || q.includes("drainage") || q.includes("sewer") || q.includes("sewerage") || q.includes("waterlogging") || q.includes("flood") || q.includes("overflow") || q.includes("जलभराव") || q.includes("पानी") || q.includes("सीवर") || q.includes("नाली")) {
    return {
      en: `For water supply issues, blocked drains, or waterlogging:\n\n• **Responsible Division:** GNIDA Water & Sewerage Department.\n• **Water Helpline:** **0120-2326308** (available during working hours).\n• **Turnaround (SLA):** Water pipeline bursts are prioritized within 24 hours; storm drain de-silting is handled in 24–48 hours.\n\nIf dirty water is coming into your home or water is pooled on the street, report it with a quick photo so a municipal tanker or maintenance van can be dispatched.`,
      hi: `जलापूर्ति, गंदे पानी या जलभराव की समस्या के लिए:\n\n• **संबंधित विभाग:** जीएनआईडीए जल एवं सीवरेज विभाग।\n• **जल हेल्पलाइन:** **0120-2326308**।\n• **समाधान समयसीमा:** टूटी पाइपलाइन का काम 24 घंटे में और नालों की सफाई 24 से 48 घंटे में की जाती है।\n\nअगर सड़क पर पानी भरा है या गंदा पानी आ रहा है, तो फोटो खींचकर रिपोर्ट करें ताकि तुरंत मरम्मत टीम मौके पर पहुँच सके।`,
      actions: [
        { labelEn: "Report Water Issue", labelHi: "पानी की समस्या बताएं", screen: "Capture report" },
        { labelEn: "Authority Contacts", labelHi: "प्राधिकरण संपर्क", screen: "Responsible authority" }
      ]
    };
  }

  // Intent: Streetlights, Electricity & NPCL Power
  if (q.includes("light") || q.includes("lights") || q.includes("streetlight") || q.includes("streetlights") || q.includes("electric") || q.includes("electricity") || q.includes("bijli") || q.includes("npcl") || q.includes("power cut") || q.includes("outage") || q.includes("pole") || q.includes("dark") || q.includes("andhera") || q.includes("बिजली") || q.includes("लाइट") || q.includes("अंधेरा")) {
    return {
      en: `For streetlights and electricity issues in Greater Noida:\n\n• **Streetlights:** Maintained jointly by GNIDA Electrical Division and NPCL. Outages reported with a pole number or GPS location carry a 24-hour turnaround.\n• **Power Outages & Sparking:** Contact **NPCL 24/7 Customer Care** at **0120-6229400**.\n\nIf you see a dark street or a dangling electrical wire, report it immediately in the app so we can alert the nearest emergency field unit.`,
      hi: `स्ट्रीटलाइट और बिजली की समस्याओं के लिए:\n\n• **स्ट्रीटलाइट्स:** जीएनआईडीए इलेक्ट्रिकल विंग और एनपीसीएल द्वारा संचालित। खंभे की फोटो या लोकेशन भेजने पर 24 घंटे में लाइट ठीक करना अनिवार्य है।\n• **बिजली कटौती व फॉल्ट:** **एनपीसीएल 24/7 हेल्पलाइन:** **0120-6229400** पर संपर्क करें।\n\nयदि आपके सेक्टर में लाइट बंद है या कोई तार लटक रहा है, तो तुरंत रिपोर्ट दर्ज करें ताकि नजदीकी टीम को भेजा जा सके।`,
      actions: [
        { labelEn: "Report Broken Light", labelHi: "लाइट की शिकायत दर्ज करें", screen: "Capture report" },
        { labelEn: "View Authority Desk", labelHi: "प्राधिकरण डेस्क", screen: "Responsible authority" }
      ]
    };
  }

  // Intent: Garbage, Cleanliness, Sanitation & Waste Disposal
  if (q.includes("garbage") || q.includes("kachra") || q.includes("waste") || q.includes("trash") || q.includes("dustbin") || q.includes("safai") || q.includes("cleaning") || q.includes("dump") || q.includes("sweeper") || q.includes("sanitation") || q.includes("कचरा") || q.includes("सफाई") || q.includes("कूड़ा")) {
    return {
      en: `For garbage dumps and street sanitation:\n\n• **Division:** GNIDA Public Health & Sanitation Department.\n• **Helpline:** **0120-2326305**.\n• **Standard Resolution:** Waste clearing and collection vehicle dispatch usually happens within 12 to 24 hours of reporting.\n\nTake a picture of the uncollected garbage pile through 'Capture report' so the area sanitation inspector gets notified directly.`,
      hi: `कचरे और गंदगी की समस्या के लिए:\n\n• **संबंधित विभाग:** जीएनआईडीए जनस्वास्थ्य एवं स्वच्छता विभाग।\n• **स्वच्छता हेल्पलाइन:** **0120-2326305**।\n• **निस्तारण समय:** कचरा उठाने की गाड़ी आमतौर पर रिपोर्ट दर्ज होने के 12 से 24 घंटे में पहुँच जाती है।\n\nजहाँ भी कचरे का ढेर दिखे, 'Capture report' से फोटो खींचकर भेजें ताकि सीधे क्षेत्रीय सफाई निरीक्षक को अलर्ट मिले।`,
      actions: [
        { labelEn: "Report Garbage Dump", labelHi: "कचरा रिपोर्ट करें", screen: "Capture report" },
        { labelEn: "View Authority Desk", labelHi: "प्राधिकरण डेस्क", screen: "Responsible authority" }
      ]
    };
  }

  // Intent: Stray Animals / Cattle on Roads
  if (q.includes("dog") || q.includes("stray") || q.includes("cow") || q.includes("cattle") || q.includes("animal") || q.includes("saand") || q.includes("kutta") || q.includes("गाय") || q.includes("कुत्ता") || q.includes("पशु")) {
    return {
      en: `For stray cattle or animal issues in Greater Noida:\n\nGNIDA operates an active Cattle Catching Squad to safely move stray cows and bulls from main expressways and sector roads to registered shelters (Gaushalas). For aggressive stray dogs or sterilization requests, the Animal Welfare Division can be alerted via a geotagged report in the app.`,
      hi: `सड़क पर बेसहारा पशुओं या कुत्तों की समस्या के लिए:\n\nजीएनआईडीए की कैटल कैचिंग स्क्वाड मुख्य सड़कों और एक्सप्रेसवे से बेसहारा मवेशियों को सुरक्षित रूप से गोशालाओं में पहुँचाने का काम करती है। आवारा कुत्तों की समस्या के लिए भी आप ऐप से लोकेशन के साथ शिकायत दर्ज कर सकते हैं।`,
      actions: [
        { labelEn: "Report Animal Hazard", labelHi: "पशु समस्या बताएं", screen: "Capture report" },
        { labelEn: "Check City Map", labelHi: "नक्शा देखें", screen: "Explore map" }
      ]
    };
  }

  // Intent: GroundTruth AI Verification
  if (q.includes("groundtruth") || q.includes("ground truth") || q.includes("verification") || q.includes("verify") || q.includes("proof") || q.includes("fake") || q.includes("सत्यापन") || q.includes("ग्राउंडट्रूथ")) {
    return {
      en: `**GroundTruth AI** is our digital watchdog against fake repair claims! 🔍\n\nIn traditional municipal systems, tickets often get marked 'Resolved' even when work was half-done. With NagrikAI:\n1. The contractor must upload a photo of the completed repair.\n2. Our AI vision compares the original complaint image with the new repair photo (matching road texture, depth, and surroundings).\n3. Citizens walking by can also verify the fix with a 1-tap confirmation.\n\nA ticket is only officially closed once the physical fix is verified on the ground!`,
      hi: `**ग्राउंडट्रूथ एआई (GroundTruth AI)** काम के फर्जी दावों को रोकने वाला डिजिटल पहरेदार है! 🔍\n\nअक्सर शिकायतों को बिना पूरा काम किए 'Resolved' दिखा दिया जाता है। नागरिक एआई में ऐसा नहीं हो सकता:\n1. मरम्मत करने वाली टीम को काम पूरा होने के बाद नई फोटो अपलोड करनी होती है।\n2. एआई पुरानी और नई फोटो की तुलना करके सड़क, स्थान और मरम्मत की पुष्टि करता है।\n3. उस रास्ते से गुजरने वाले नागरिक भी 1 टैप से पुष्टि कर सकते हैं।\n\nसच्चा काम होने पर ही शिकायत बंद मानी जाती है!`,
      actions: [
        { labelEn: "Open GroundTruth Screen", labelHi: "ग्राउंडट्रूथ स्क्रीन देखें", screen: "GroundTruth AI" },
        { labelEn: "Check City Map", labelHi: "नक्शा देखें", screen: "Explore map" }
      ]
    };
  }

  // Intent: How to Report an Issue
  if (q.includes("how to report") || q.includes("how to file") || q.includes("file a complaint") || q.includes("lodge complaint") || q.includes("report kaise") || q.includes("shikayat kaise") || q.includes("शिकायत कैसे") || q.includes("रिपोर्ट कैसे")) {
    return {
      en: `Reporting an issue on NagrikAI takes less than 30 seconds:\n\n1. Tap the **'+' (Report)** button on the bottom bar.\n2. Snap a photo of the problem (pothole, broken light, water leak).\n3. Our app automatically detects your GPS coordinates and sector.\n4. Pick the category and tap **Submit Report**.\n\nYou'll get an instant reference number, and we'll route it straight to the right department with active status tracking!`,
      hi: `नागरिक एआई पर शिकायत दर्ज करना बहुत आसान है (30 सेकंड से कम):\n\n1. नीचे दिए गए **'+' (Report)** बटन पर टैप करें।\n2. समस्या की फोटो खींचें (जैसे गड्ढा, बंद लाइट या पानी का रिसाव)।\n3. ऐप अपने आप आपकी जीपीएस लोकेशन और सेक्टर पहचान लेगा।\n4. श्रेणी चुनें और **Submit Report** दबाएं।\n\nआपको तुरंत एक रेफरेंस नंबर मिलेगा और रिपोर्ट सीधे सही विभाग को चली जाएगी!`,
      actions: [
        { labelEn: "Start a Report Now", labelHi: "अभी रिपोर्ट करें", screen: "Capture report" },
        { labelEn: "View My Past Reports", labelHi: "पुरानी शिकायतें देखें", screen: "Report history" }
      ]
    };
  }

  // Intent: Check My Complaint Status
  if (q.includes("status") || q.includes("my complaint") || q.includes("my report") || q.includes("track") || q.includes("meri report") || q.includes("kya hua") || q.includes("स्थिति") || q.includes("ट्रैकिंग")) {
    if (liveReports && liveReports.length > 0) {
      const open = liveReports.filter(r => r.status !== "Resolved");
      const resolved = liveReports.filter(r => r.status === "Resolved");
      const latest = liveReports[0];
      return {
        en: `Here's where your reports stand:\n\n• **Total Reports:** ${liveReports.length} (${open.length} in progress, ${resolved.length} resolved)\n• **Latest Ticket:** #${latest.report_number || (latest.id ? latest.id.slice(0, 8) : "101")} (${latest.title || latest.category})\n• **Location:** ${latest.locality || "Greater Noida"}\n• **Status:** ${latest.status || "Under Review"}\n\nYou can view the full progress timeline in **Report history**!`,
        hi: `आपकी शिकायतों की वर्तमान स्थिति:\n\n• **कुल रिपोर्ट्स:** ${liveReports.length} (${open.length} प्रक्रिया में, ${resolved.length} पूरी हो चुकी हैं)\n• **नवीनतम टिकट:** #${latest.report_number || (latest.id ? latest.id.slice(0, 8) : "101")} (${latest.title || latest.category})\n• **स्थान:** ${latest.locality || "ग्रेटर नोएडा"}\n• **स्थिति:** ${latest.status || "समीक्षाधीन"}\n\nआप **Report history** में जाकर पूरी टाइमलाइन देख सकते हैं!`,
        actions: [
          { labelEn: "Open Report History", labelHi: "शिकायत इतिहास खोलें", screen: "Report history" },
          { labelEn: "Live Tracking", labelHi: "लाइव ट्रैकिंग", screen: "Reference tracking" }
        ]
      };
    } else {
      return {
        en: `You don't have any open complaints right now—everything looks clean! If you spot any issue around your sector today, feel free to file a report anytime.`,
        hi: `वर्तमान में आपकी कोई भी शिकायत दर्ज नहीं है—सब कुछ ठीक है! अगर आपको आज अपने सेक्टर में कोई समस्या दिखे, तो आप कभी भी रिपोर्ट दर्ज कर सकते हैं।`,
        actions: [
          { labelEn: "File a Report", labelHi: "रिपोर्ट दर्ज करें", screen: "Capture report" },
          { labelEn: "Explore City Map", labelHi: "शहर का नक्शा देखें", screen: "Explore map" }
        ]
      };
    }
  }

  // Intent: Emergency Numbers & Official Contacts
  if (q.includes("helpline") || q.includes("contact") || q.includes("number") || q.includes("phone") || q.includes("police") || q.includes("fire") || q.includes("ambulance") || q.includes("gnida") || q.includes("हेल्पलाइन") || q.includes("नंबर") || q.includes("संपर्क")) {
    return {
      en: `Here are key verified emergency and municipal contacts for Greater Noida:\n\n• **Police Control Room:** 112\n• **Traffic Police Helpline:** 9971009001\n• **NPCL Electricity 24/7:** 0120-6229400\n• **GNIDA Water & Sewerage:** 0120-2326308\n• **GNIDA Civil/Roads:** 0120-2326301\n• **Sanitation & Waste:** 0120-2326305\n• **Fire Emergency:** 101 | **Ambulance:** 108`,
      hi: `ग्रेटर नोएडा के मुख्य आपातकालीन और प्राधिकरण संपर्क नंबर:\n\n• **पुलिस नियंत्रण कक्ष:** 112\n• **ट्रैफिक पुलिस:** 9971009001\n• **एनपीसीएल बिजली (24 घंटे):** 0120-6229400\n• **जीएनआईडीए जल विभाग:** 0120-2326308\n• **सड़क व निर्माण विभाग:** 0120-2326301\n• **सफाई व कचरा विभाग:** 0120-2326305\n• **दमकल:** 101 | **एम्बुलेंस:** 108`,
      actions: [
        { labelEn: "View Authority Desk", labelHi: "प्राधिकरण डेस्क देखें", screen: "Responsible authority" },
        { labelEn: "File Report", labelHi: "रिपोर्ट दर्ज करें", screen: "Capture report" }
      ]
    };
  }

  // Intent: City Info, Metro, Landmarks
  if (q.includes("metro") || q.includes("aqua line") || q.includes("expo mart") || q.includes("airport") || q.includes("jewar") || q.includes("buddh") || q.includes("city park") || q.includes("greater noida") || q.includes("मेट्रो")) {
    return {
      en: `Greater Noida is known for its well-planned sectors, wide roads, and green spaces:\n\n• **Public Transit:** The NMRC Aqua Line connects Pari Chowk and Knowledge Park directly with Noida Sector 51.\n• **Major Landmarks:** India Expo Mart hosts global conferences; Buddh International Circuit is famous for motorsports.\n• **Future Connectivity:** The upcoming Noida International Airport at Jewar is set to connect via expressway and metro extensions.`,
      hi: `ग्रेटर नोएडा अपने सुनियोजित सेक्टरों, चौड़ी सड़कों और हरियाली के लिए जाना जाता है:\n\n• **मेट्रो सुविधा:** एनएमआरसी एक्वा लाइन परी चौक और नॉलेज पार्क को सीधे नोएडा सेक्टर 51 से जोड़ती है।\n• **प्रमुख स्थल:** इंडिया एक्सपो मार्ट और बुद्ध इंटरनेशनल सर्किट यहाँ के प्रसिद्ध स्थल हैं।\n• **जेवर एयरपोर्ट:** आगामी नोएडा इंटरनेशनल एयरपोर्ट से कनेक्टिविटी और भी बेहतर होने जा रही है।`,
      actions: [
        { labelEn: "Explore City Map", labelHi: "शहर का नक्शा देखें", screen: "Explore map" },
        { labelEn: "Civic Navigation", labelHi: "नेविगेशन देखें", screen: "Civic navigation" }
      ]
    };
  }

  // 15. Intelligent Contextual Response for ANY other question
  // Directly extract subject and address what the user actually asked!
  const cleanedSubject = rawQ
    .replace(/^(can you|please|tell me|what is|how do|why is|is there|where can i|kya|kaise|batao|kripya)\s+/i, "")
    .replace(/[?!.]+$/, "")
    .trim();

  return {
    en: `Regarding "${cleanedSubject || rawQ}":\n\nAs your Greater Noida civic assistant, I'm here to help address this directly. If this relates to an issue in your sector—like a road hazard, broken streetlight, water problem, or sanitation—you can file a quick report right here with auto-GPS tagging. I can also help you track active complaints, check local traffic, or connect you with the right GNIDA department.\n\nWould you like to pinpoint this on the city map or submit a report?`,
    hi: `"${cleanedSubject || rawQ}" के बारे में:\n\nग्रेटर नोएडा नागरिक सहायक के रूप में, मैं आपकी इसमें पूरी मदद कर सकता हूँ। अगर यह आपके सेक्टर की किसी समस्या (जैसे सड़क, लाइट, पानी या सफाई) से जुड़ा है, तो आप सीधे ऐप से लोकेशन के साथ शिकायत दर्ज कर सकते हैं। आप यहाँ से लाइव ट्रैफिक भी देख सकते हैं या संबंधित विभाग की जानकारी ले सकते हैं।\n\nक्या आप इसे शहर के नक्शे पर देखना चाहते हैं या नई रिपोर्ट दर्ज करना चाहते हैं?`,
    actions: [
      { labelEn: "Explore City Map", labelHi: "शहर का नक्शा देखें", screen: "Explore map" },
      { labelEn: "File a Report", labelHi: "रिपोर्ट दर्ज करें", screen: "Capture report" },
      { labelEn: "Authority Contacts", labelHi: "प्राधिकरण संपर्क", screen: "Responsible authority" }
    ]
  };
}

// Master function that decides between live LLM (Gemini) and the dynamic local conversational engine
async function generateAIModelResponse(query, liveReports = [], isVoiceNote = false, duration = 0, chatHistory = []) {
  const rawQ = (query || "").trim();
  if (!rawQ && !isVoiceNote) {
    return {
      en: "How can I help you today? Feel free to ask about roads, traffic, municipal issues, or services in Greater Noida.",
      hi: "आज मैं आपकी क्या सहायता कर सकता हूँ? आप ग्रेटर नोएडा की सड़कों, ट्रैफिक या नागरिक समस्याओं के बारे में पूछ सकते हैं।",
      actions: [{ labelEn: "Explore City Map", labelHi: "नक्शा देखें", screen: "Explore map" }]
    };
  }

  // 1. Attempt Live LLM call if API Key is configured
  try {
    const liveLLMResponse = await callGeminiAPI(rawQ, chatHistory);
    if (liveLLMResponse && liveLLMResponse.en && liveLLMResponse.hi) {
      return liveLLMResponse;
    }
  } catch (e) {
    console.warn("LLM API call fallback to local engine:", e);
  }

  // 2. Comprehensive, dynamic local conversational engine
  return generateLocalConversationalResponse(rawQ, liveReports, isVoiceNote, duration);
}

// Interactive Voice Note Player Component
function VoiceNotePlayer({ audioUrl, duration = 0, transcript = "", lang = "en" }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.warn("Audio playback error:", err);
          setIsPlaying(false);
        });
    }
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setTotalDuration(audioRef.current.duration);
      }
    }
  };

  const onEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const progressPct = totalDuration > 0 ? Math.min(100, (currentTime / totalDuration) * 100) : 0;

  return (
    <div className="voicenote-card">
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onLoadedMetadata={(e) => {
          if (e.target.duration && !isNaN(e.target.duration)) {
            setTotalDuration(e.target.duration);
          }
        }}
      />

      <div className="voicenote-player-row">
        <button
          type="button"
          className={`voicenote-play-btn ${isPlaying ? "playing" : ""}`}
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: "2px" }} />}
        </button>

        <div
          className="voicenote-waveform-container"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const newPct = clickX / rect.width;
            if (audioRef.current && totalDuration > 0) {
              audioRef.current.currentTime = newPct * totalDuration;
            }
          }}
          title="Click to seek"
        >
          <div className={`voicenote-waveform-bars ${isPlaying ? "animating" : ""}`}>
            {[35, 65, 90, 45, 80, 100, 50, 75, 95, 40, 85, 60, 90, 55, 70, 40, 65, 85, 50, 70].map((h, i) => (
              <span
                key={i}
                style={{
                  height: `${h}%`,
                  opacity: (i / 20) * 100 <= progressPct ? 1 : 0.4
                }}
              />
            ))}
          </div>
          <div className="voicenote-progress-track">
            <div className="voicenote-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <span className="voicenote-time-badge">
          {isPlaying ? formatTime(currentTime) : formatTime(totalDuration)}
        </span>
      </div>

      {transcript && (
        <div className="voicenote-transcript-preview">
          <span className="voicenote-transcript-label">
            {lang === "hi" ? "ट्रांसक्रिप्ट" : "TRANSCRIPT"}
          </span>
          <p className="voicenote-transcript-text">"{transcript}"</p>
        </div>
      )}
    </div>
  );
}

export function AskAI({
  go,
  onClose,
  query = "",
  setQuery,
  language = "English",
  setLanguage = () => {}
}) {
  const [currentLang, setCurrentLang] = useState(language || "English");
  const [outputMode, setOutputMode] = useState("both"); // "both" (Voice + Text) or "text" (Text Only)
  const [messages, setMessages] = useState([
    {
      id: "m-welcome",
      role: "assistant",
      textEn: "Hello Citizen! I'm NagrikAI — your city AI assistant. You can speak or type to ask about road hazards, municipal services, complaint statuses, or GNIDA departments.",
      textHi: "नमस्ते नागरिक! मैं नागरिक एआई हूँ — आपका शहर एआई सहायक। आप ग्रेटर नोएडा की सड़कों के गड्ढे, नागरिक सेवाएं, शिकायत स्थिति या जीएनआईडीए विभागों के बारे में बोलकर या लिखकर पूछ सकते हैं।",
      activeLang: language === "Hindi" ? "hi" : "en",
      actions: [
        { labelEn: "What do you provide?", labelHi: "आप क्या सेवाएं देते हैं?", query: "What civic services does NagrikAI provide?" },
        { labelEn: "Potholes in Alpha II", labelHi: "अल्फा II में गड्ढे", query: "What potholes are reported in Alpha II?" },
        { labelEn: "Pari Chowk traffic", labelHi: "परी चौक ट्रैफिक", query: "How is the traffic and road condition near Pari Chowk?" }
      ]
    }
  ]);

  const [inputVal, setInputVal] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [dbReports, setDbReports] = useState([]);

  // Voice Note Recording State
  const [isRecordingVoiceNote, setIsRecordingVoiceNote] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recognitionRef = useRef(null);
  const chatBottomRef = useRef(null);

  // Authenticated, per-user conversation state
  const authUserRef = useRef(null);
  const conversationIdRef = useRef(null);
  const conversationInitPromiseRef = useRef(Promise.resolve());
  const conversationSaveQueueRef = useRef(Promise.resolve());

  const startNewConversation = async () => {
    await conversationSaveQueueRef.current;

    const user = authUserRef.current || await getAuthenticatedUser();
    authUserRef.current = user;

    conversationIdRef.current = null;
    localStorage.removeItem(activeConversationKey(user.id));
    localStorage.removeItem(PENDING_CONVERSATION_KEY);
    localStorage.removeItem(START_NEW_CONVERSATION_KEY);

    setMessages(current =>
      current.filter(message => message.id === "m-welcome")
    );
    setInputVal("");
  };
  const persistConversationTurn = (userMessage, assistantMessage) => {
    const saveTurn = async () => {
      await conversationInitPromiseRef.current;

      const user = authUserRef.current || await getAuthenticatedUser();
      authUserRef.current = user;

      const storageKey = activeConversationKey(user.id);
      let conversationId = conversationIdRef.current;

      if (!conversationId) {
        const storedId = localStorage.getItem(storageKey);

        if (storedId) {
          const existing = await loadOwnConversation(storedId, user.id);
          if (existing) conversationId = storedId;
        }
      }

      const savedId = await saveConversationTurn({
        conversationId,
        user,
        userMessage,
        assistantMessage
      });

      conversationIdRef.current = savedId;
      localStorage.setItem(storageKey, savedId);
    };

    conversationSaveQueueRef.current =
      conversationSaveQueueRef.current
        .then(saveTurn)
        .catch(error => {
          console.error("Could not save AI conversation to Supabase:", error);
        });

    return conversationSaveQueueRef.current;
  };

  // Refs to eliminate stale closure bugs during speech recognition
  const latestTranscriptRef = useRef("");
  const isRecordingRef = useRef(false);

  // Sync external language changes
  useEffect(() => {
    if (language && language !== currentLang) {
      setCurrentLang(language);
    }
  }, [language]);

  const handleLangChange = (newLang) => {
    setCurrentLang(newLang);
    setLanguage(newLang);
    stopSpeaking();
  };

  // Fetch live reports from Supabase on mount
  useEffect(() => {
    let active = true;
    async function loadReports() {
      if (!isSupabaseConfigured) return;
      try {
        const { data } = await supabase
          .from("reports")
          .select("id, report_number, title, category, status, groundtruth_status, community_status, locality, latitude, longitude, created_at")
          .order("created_at", { ascending: false })
          .limit(100);
        if (active && Array.isArray(data)) {
          setDbReports(data);
        }
      } catch (err) {
        console.warn("AskAI reports fetch:", err);
      }
    }
    loadReports();

    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel("ask-ai-live-reports")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, loadReports)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    return () => { active = false; };
  }, []);

  // Initialise only the signed-in user's conversation thread.
  useEffect(() => {
    let active = true;

    const initializeConversation = async () => {
      const pendingId = localStorage.getItem(PENDING_CONVERSATION_KEY);
      if (pendingId) {
        localStorage.removeItem(PENDING_CONVERSATION_KEY);
      }

      const startNew =
        localStorage.getItem(START_NEW_CONVERSATION_KEY) === "true";

      if (startNew) {
        localStorage.removeItem(START_NEW_CONVERSATION_KEY);
      }

      const user = await getAuthenticatedUser();
      if (!active) return;

      authUserRef.current = user;

      const storageKey = activeConversationKey(user.id);

      if (startNew) {
        conversationIdRef.current = null;
        localStorage.removeItem(storageKey);
        return;
      }

      const targetId = pendingId || localStorage.getItem(storageKey);
      if (!targetId) return;

      const restored = await loadOwnConversation(targetId, user.id);
      if (!active) return;

      if (!restored) {
        conversationIdRef.current = null;
        localStorage.removeItem(storageKey);
        console.warn("Requested AI conversation was not found for this account.");
        return;
      }

      conversationIdRef.current = targetId;
      localStorage.setItem(storageKey, targetId);

      setMessages(current => {
        const welcome = current.find(message => message.id === "m-welcome");
        return [...(welcome ? [welcome] : []), ...restored.messages];
      });

      const lastUserMessage = [...restored.messages]
        .reverse()
        .find(message => message.role === "user");

      if (lastUserMessage) {
        const restoredLanguage =
          lastUserMessage.activeLang === "hi" ? "Hindi" : "English";

        setCurrentLang(restoredLanguage);
        setLanguage(restoredLanguage);
      }
    };

    const initialization = initializeConversation();
    conversationInitPromiseRef.current = initialization;

    initialization.catch(error => {
      console.error("AI conversation initialization failed:", error);
    });

    return () => {
      active = false;
    };
  }, []);
  // Check for pending reopened conversation or query from outside
  useEffect(() => {
    const reopened = localStorage.getItem("nagrikai_pending_reopen_query");
    if (reopened) {
      localStorage.removeItem("nagrikai_pending_reopen_query");
      handleSend(reopened);
      return;
    }

    if (window.__pendingVoiceNote) {
      const p = window.__pendingVoiceNote;
      window.__pendingVoiceNote = null;
      handleSendVoiceNote(p.audioUrl, p.duration, p.transcript, p.lang || (currentLang === "Hindi" ? "hi" : "en"));
    } else if (query && query.trim()) {
      handleSend(query.trim());
      if (setQuery) setQuery("");
    }
  }, [query]);

  // Scroll to bottom on new message or recording state change
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isRecordingVoiceNote, liveTranscript]);

  // Clean up any audio streams on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      isRecordingRef.current = false;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  // Robust SpeechSynthesis with native Hindi voice selection
  const speakText = (text, targetLang = currentLang) => {
    if (outputMode === "text" || !window.speechSynthesis) return;

    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      const isHi = targetLang === "Hindi" || targetLang === "hi" || /[\u0900-\u097F]/.test(text);

      utter.lang = isHi ? "hi-IN" : "en-IN";
      utter.rate = isHi ? 0.95 : 1.0;
      utter.pitch = 1.0;

      // Select matching voice
      const voices = window.speechSynthesis.getVoices();
      if (isHi) {
        const hiVoice = voices.find(v => v.lang.startsWith("hi") || v.name.toLowerCase().includes("hindi"));
        if (hiVoice) utter.voice = hiVoice;
      } else {
        const enVoice = voices.find(v => v.lang === "en-IN" || v.lang.startsWith("en"));
        if (enVoice) utter.voice = enVoice;
      }

      utter.onstart = () => setIsSpeaking(true);
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Start Voice Note Recording
  const startVoiceNoteRecording = async () => {
    stopSpeaking();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Microphone recording is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      let mimeType = "";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
        }
      }

      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);

      latestTranscriptRef.current = "";
      isRecordingRef.current = true;
      setLiveTranscript("");

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recog = new SpeechRecognition();
          recog.continuous = true;
          recog.interimResults = true;
          recog.lang = currentLang === "Hindi" ? "hi-IN" : "en-IN";

          recog.onresult = (event) => {
            let fullText = "";
            for (let i = 0; i < event.results.length; ++i) {
              fullText += event.results[i][0].transcript + " ";
            }
            const cleanText = fullText.trim();
            if (cleanText) {
              latestTranscriptRef.current = cleanText;
              setLiveTranscript(cleanText);
            }
          };

          recog.onerror = (e) => {
            if (e.error !== "no-speech") {
              console.warn("Speech recognition notice:", e.error);
            }
          };

          recog.onend = () => {
            if (isRecordingRef.current) {
              try { recog.start(); } catch {}
            }
          };

          recog.start();
          recognitionRef.current = recog;
        } catch (recErr) {
          console.warn("Speech recognition initialization:", recErr);
        }
      }

      setRecordingSeconds(0);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

      setIsRecordingVoiceNote(true);
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Could not access microphone. Please enable microphone permission in your browser.");
    }
  };

  // Stop Recording and Send Voice Note
  const stopVoiceNoteAndSend = () => {
    if (!mediaRecorderRef.current || !isRecordingVoiceNote) return;

    isRecordingRef.current = false;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const duration = recordingSeconds || 1;
    const transcriptText = (latestTranscriptRef.current || liveTranscript || "").trim();

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

    mediaRecorderRef.current.onstop = () => {
      try {
        const mime = mediaRecorderRef.current?.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        const audioUrl = URL.createObjectURL(audioBlob);

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(t => t.stop());
          mediaStreamRef.current = null;
        }

        handleSendVoiceNote(audioUrl, duration, transcriptText, currentLang === "Hindi" ? "hi" : "en");
      } catch (err) {
        console.error("Voice note assembly error:", err);
      }
    };

    try {
      mediaRecorderRef.current.stop();
    } catch (e) {
      console.warn("MediaRecorder stop error:", e);
    }

    setIsRecordingVoiceNote(false);
    setLiveTranscript("");
  };

  // Cancel Voice Note Recording without sending
  const cancelVoiceNote = () => {
    isRecordingRef.current = false;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current) {
      try { mediaRecorderRef.current.stop(); } catch {}
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    audioChunksRef.current = [];
    latestTranscriptRef.current = "";
    setIsRecordingVoiceNote(false);
    setLiveTranscript("");
    setRecordingSeconds(0);
  };

  // Send Voice Note Message & Generate Conversational AI Response
  const handleSendVoiceNote = async (audioUrl, duration, transcriptText, lang = "en") => {
    const isHi = lang === "hi" || currentLang === "Hindi";
    const queryText = (transcriptText || "").trim() || (isHi ? "वॉयसनोट द्वारा प्रश्न" : "Voice note civic query");

    stopSpeaking();
    const userMsg = {
      id: "u-vn-" + Date.now(),
      role: "user",
      isVoiceNote: true,
      audioUrl: audioUrl,
      duration: duration,
      transcript: transcriptText,
      textEn: transcriptText ? `🎤 Voice Note: "${transcriptText}"` : "🎤 Voice Note",
      textHi: transcriptText ? `🎤 वॉयसनोट: "${transcriptText}"` : "🎤 वॉयसनोट",
      activeLang: isHi ? "hi" : "en",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const aiResponse = await generateAIModelResponse(queryText, dbReports, true, duration, messages);

      const assistantMsg = {
        id: "a-vn-" + Date.now(),
        role: "assistant",
        textEn: aiResponse.en,
        textHi: aiResponse.hi,
        activeLang: isHi ? "hi" : "en",
        actions: aiResponse.actions || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setMessages(prev => [...prev, assistantMsg]);
      persistConversationTurn(userMsg, assistantMsg);
      setInputVal("");
      setLiveTranscript("");
      latestTranscriptRef.current = "";
      if (setQuery) setQuery("");

      // Speak AI response if voice mode is enabled
      const textToSpeak = isHi ? aiResponse.hi : aiResponse.en;
      speakText(textToSpeak, isHi ? "Hindi" : "English");
    } catch (err) {
      console.warn("AI voice response error:", err);
    } finally {
      setIsThinking(false);
    }
  };

  // Send Text Message
  const handleSend = async (textToSend = null) => {
    const q = (textToSend !== null ? textToSend : inputVal).trim();
    if (!q || isThinking) return;

    stopSpeaking();
    if (isRecordingVoiceNote) cancelVoiceNote();

    const isHi = currentLang === "Hindi" || /[\u0900-\u097F]/.test(q);

    const userMsg = {
      id: "u-" + Date.now(),
      role: "user",
      textEn: q,
      textHi: q,
      activeLang: isHi ? "hi" : "en",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputVal("");
    setLiveTranscript("");
    latestTranscriptRef.current = "";
    if (setQuery) setQuery("");
    setIsThinking(true);

    try {
      const aiResponse = await generateAIModelResponse(q, dbReports, false, 0, messages);

      const assistantMsg = {
        id: "a-" + Date.now(),
        role: "assistant",
        textEn: aiResponse.en,
        textHi: aiResponse.hi,
        activeLang: isHi ? "hi" : "en",
        actions: aiResponse.actions || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setMessages(prev => [...prev, assistantMsg]);
      persistConversationTurn(userMsg, assistantMsg);

      // Speak AI response if voice mode is enabled
      const textToSpeak = isHi ? aiResponse.hi : aiResponse.en;
      speakText(textToSpeak, isHi ? "Hindi" : "English");
    } catch (err) {
      console.warn("AI text response error:", err);
    } finally {
      setIsThinking(false);
    }
  };

  // Toggle message language display between English and Hindi
  const toggleMessageLang = (msgId) => {
    setMessages(prev =>
      prev.map(m => {
        if (m.id === msgId) {
          const nextLang = m.activeLang === "hi" ? "en" : "hi";
          return { ...m, activeLang: nextLang };
        }
        return m;
      })
    );
  };

  const formatSeconds = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const suggestionChips = [
    { labelEn: "🌟 What services do you provide?", labelHi: "🌟 आपकी सेवाएं क्या हैं?", q: "What civic services does NagrikAI provide?" },
    { labelEn: "🚗 Potholes in Alpha II", labelHi: "🚗 अल्फा II में गड्ढे", q: "What potholes are reported in Alpha II?" },
    { labelEn: "🚦 Pari Chowk traffic & route", labelHi: "🚦 परी चौक ट्रैफिक", q: "How is the traffic and road condition near Pari Chowk?" },
    { labelEn: "📸 How GroundTruth AI works?", labelHi: "📸 ग्राउंडट्रूथ एआई कैसे काम करता है?", q: "How does GroundTruth AI verify repairs?" },
    { labelEn: "📋 Check complaint status", labelHi: "📋 मेरी शिकायतों की स्थिति", q: "What is the status of my reported complaints?" },
    { labelEn: "📞 GNIDA Authority Helplines", labelHi: "📞 जीएनआईडीए हेल्पलाइन नंबर", q: "What are the contact numbers for GNIDA and NPCL?" }
  ];

  return (
    <div className="page ask-ai-container">
      {/* Top Bar */}
      <div className="topbar">
        <button
          className="icon-btn"
          onClick={() => onClose ? onClose() : go("Home")}
          aria-label={onClose ? "Close Ask AI" : "Back to home"}
        >
          {onClose ? <X size={18} /> : <ChevronLeft size={19} />}
        </button>
        <b>{currentLang === "Hindi" ? "नागरिक एआई" : "Ask NagrikAI"}</b>
        <button
          className="icon-btn"
          onClick={() => go("Voice assistant")}
          title="Open Fullscreen Voice Assistant"
          style={{ color: "#28d7a0" }}
        >
            <Mic size={18} />
        </button>
        <button
          className="icon-btn"
          onClick={() => go("AI conversations")}
          title="View AI conversation history"
        >
            <MessageSquare size={18} />
        </button>
        <button
          className="icon-btn"
          onClick={() => startNewConversation().catch(error => console.error("Could not start new conversation:", error))}
          title="Start a new conversation"
        >
          <Plus size={17} />
        </button>
      </div>

      {/* Control Header: Language Options & Output Mode */}
      <div className="ask-ai-header">
        <div className="ask-ai-header-row">
          <span className="ask-ai-badge">
            <Sparkles size={11} />
            {currentLang === "Hindi" ? "नागरिक बुद्धिमत्ता मॉडल" : "CIVIC AI MODEL"}
          </span>

          {/* Language Selector Toggle */}
          <div className="lang-selector-group">
            <button
              className={`lang-selector-btn ${currentLang === "English" ? "active" : ""}`}
              onClick={() => handleLangChange("English")}
            >
              English
            </button>
            <button
              className={`lang-selector-btn ${currentLang === "Hindi" ? "active" : ""}`}
              onClick={() => handleLangChange("Hindi")}
            >
              हिन्दी
            </button>
          </div>
        </div>

        {/* Output Mode Switcher: Voice & Text vs Text Only */}
        <div className="ask-ai-controls-row">
          <span style={{ fontSize: "10px", color: "#64748b", fontWeight: "600" }}>
            {currentLang === "Hindi" ? "आउटपुट विकल्प:" : "OUTPUT MODE:"}
          </span>

          <div className="output-mode-group">
            <button
              className={`output-mode-btn ${outputMode === "both" ? "active" : ""}`}
              onClick={() => setOutputMode("both")}
              title="AI outputs both text and voice speech"
            >
              <Volume2 size={12} />
              <span>{currentLang === "Hindi" ? "आवाज + टेक्स्ट" : "Voice & Text"}</span>
            </button>

            <button
              className={`output-mode-btn ${outputMode === "text" ? "active" : ""}`}
              onClick={() => {
                stopSpeaking();
                setOutputMode("text");
              }}
              title="AI outputs text only (Muted)"
            >
              <MessageSquare size={12} />
              <span>{currentLang === "Hindi" ? "केवल टेक्स्ट" : "Text Only"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Speech Synthesizer Waves Banner */}
      {isSpeaking && (
        <div className="speaking-banner">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="speaking-waves">
              <span className="speaking-wave-bar" />
              <span className="speaking-wave-bar" />
              <span className="speaking-wave-bar" />
              <span className="speaking-wave-bar" />
            </div>
            <span>
              {currentLang === "Hindi" ? "नागरिक एआई बोल रहा है (हिन्दी)..." : "NagrikAI speaking (English)..."}
            </span>
          </div>
          <button className="speaking-stop-btn" onClick={stopSpeaking}>
            <Square size={10} style={{ marginRight: "3px" }} />
            {currentLang === "Hindi" ? "रोकें" : "Stop"}
          </button>
        </div>
      )}

      {/* Live Voice Note Recording Bar */}
      {isRecordingVoiceNote && (
        <div className="live-voicenote-recording-bar">
          <div className="live-rec-left">
            <div className="live-rec-dot-pulse" />
            <span className="live-rec-timer">
              REC {formatSeconds(recordingSeconds)}
            </span>
            <div className="live-rec-waveform">
              <span /><span /><span /><span /><span /><span /><span /><span />
            </div>
          </div>

          <div className="live-rec-right">
            <button
              type="button"
              className="live-rec-cancel-btn"
              onClick={cancelVoiceNote}
              title={currentLang === "Hindi" ? "वॉयसनोट रद्द करें" : "Cancel Voice Note"}
            >
              <Trash2 size={15} />
            </button>

            <button
              type="button"
              className="live-rec-send-btn"
              onClick={stopVoiceNoteAndSend}
              title={currentLang === "Hindi" ? "वॉयसनोट भेजें" : "Send Voice Note"}
            >
              <Check size={16} />
              <span>{currentLang === "Hindi" ? "भेजें" : "Send"}</span>
            </button>
          </div>

          <div className="live-rec-transcript-bubble">
            <small>{currentLang === "Hindi" ? "लाइव शब्द / ट्रांसक्रिप्ट:" : "Live speech preview:"}</small>
            <p>
              {liveTranscript || (
                <span style={{ color: "#64748b", fontStyle: "italic" }}>
                  {currentLang === "Hindi" ? "बोलिए, आपकी आवाज रिकॉर्ड हो रही है..." : "Speak now, your audio is recording live..."}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Chat Messages Stream */}
      <div className="chat-stream">
        {messages.map((m) => {
          const displayText = m.activeLang === "hi" ? (m.textHi || m.textEn) : (m.textEn || m.textHi);

          return (
            <div key={m.id} className={`msg-row ${m.role}`}>
              <div className="msg-bubble">
                {/* Voice Note Player Card if message contains audio */}
                {m.audioUrl ? (
                  <VoiceNotePlayer
                    audioUrl={m.audioUrl}
                    duration={m.duration}
                    transcript={m.transcript}
                    lang={m.activeLang}
                  />
                ) : (
                  <p style={{ margin: 0, fontSize: "12px", lineHeight: "1.58", whiteSpace: "pre-line" }}>
                    {displayText}
                  </p>
                )}

                {/* In-app Navigation / Conversational Chips */}
                {m.actions && m.actions.length > 0 && (
                  <div className="msg-actions">
                    {m.actions.map((act, i) => (
                      <button
                        key={i}
                        className="msg-action-chip"
                        onClick={() => {
                          if (act.screen) go(act.screen);
                          else if (act.query) handleSend(act.query);
                        }}
                      >
                        <Navigation size={10} />
                        {m.activeLang === "hi" ? act.labelHi : act.labelEn}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="msg-meta-row">
                {m.timestamp && <span>{m.timestamp}</span>}

                {m.role === "assistant" && (
                  <>
                    {/* Speak Button (in message's active language) */}
                    <button
                      className="msg-listen-btn"
                      onClick={() => speakText(displayText, m.activeLang === "hi" ? "Hindi" : "English")}
                      title={m.activeLang === "hi" ? "हिन्दी में सुनें" : "Listen in English"}
                    >
                      <Volume2 size={12} />
                      <span>{m.activeLang === "hi" ? "सुनें (हिन्दी)" : "Listen"}</span>
                    </button>

                    {/* Toggle Language between Hindi and English */}
                    <button
                      className="msg-translate-btn"
                      onClick={() => toggleMessageLang(m.id)}
                      title="Translate between English and Hindi"
                    >
                      <Languages size={12} />
                      <span>{m.activeLang === "hi" ? "English" : "हिन्दी"}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {isThinking && (
          <div className="msg-row assistant thinking">
            <div className="avatar assistant-avatar"><Sparkles size={14} /></div>
            <div className="msg-bubble">
              <span className="thinking-dot" />
              <span className="thinking-dot" />
              <span className="thinking-dot" />
            </div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Suggested Prompts based on real database topics */}
      <div className="prompt-suggestions">
        <div className="prompt-suggestions-label">
          {currentLang === "Hindi" ? "सुझाए गए नागरिक प्रश्न" : "POPULAR CIVIC QUESTIONS"}
        </div>
        <div className="prompt-chips-scroll">
          {suggestionChips.map((chip, idx) => (
            <button
              key={idx}
              className="prompt-chip"
              onClick={() => handleSend(chip.q)}
            >
              {currentLang === "Hindi" ? chip.labelHi : chip.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Input Bar with Mic & Send */}
      <div className="ai-input-bar">
        <input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          disabled={isRecordingVoiceNote || isThinking}
          placeholder={
            isRecordingVoiceNote
              ? (currentLang === "Hindi" ? "वॉयसनोट रिकॉर्ड हो रहा है..." : "Recording voice note...")
              : isThinking
              ? (currentLang === "Hindi" ? "नागरिक एआई सोच रहा है..." : "NagrikAI is thinking...")
              : (currentLang === "Hindi" ? "सड़क, ट्रैफिक, या शिकायत के बारे में पूछें..." : "Ask anything about roads, traffic, or complaints...")
          }
        />

        {/* Live Voice Note Microphone Button */}
        <button
          className={`ai-mic-btn ${isRecordingVoiceNote ? "listening" : ""}`}
          onClick={isRecordingVoiceNote ? stopVoiceNoteAndSend : startVoiceNoteRecording}
          disabled={isThinking}
          title={isRecordingVoiceNote ? "Stop & Send Voice Note" : (currentLang === "Hindi" ? "वॉयसनोट रिकॉर्ड करने के लिए दबाएं" : "Record Voice Note")}
          aria-label="Voice note input"
        >
          {isRecordingVoiceNote ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}
        </button>

        {/* Send Button */}
        <button
          className="ai-send-btn"
          onClick={() => handleSend()}
          disabled={!inputVal.trim() || isRecordingVoiceNote || isThinking}
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </div>

      <p className="hint" style={{ marginTop: "8px", textAlign: "center" }}>
        {currentLang === "Hindi"
          ? "नागरिक एआई ग्रेटर नोएडा नगर पालिका सेवाओं और जीएनआईडीए नागरिक रिकॉर्ड से जुड़ा है।"
          : "Powered by Greater Noida civic intelligence & verified municipal records."}
      </p>
    </div>
  );
}

export function Voice({
  recording,
  setRecording,
  go,
  query,
  setQuery,
  language = "English",
  setLanguage = () => {}
}) {
  const [currentLang, setCurrentLang] = useState(language || "English");
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const latestTranscriptRef = useRef("");
  const isRecordingRef = useRef(false);

  useEffect(() => {
    if (language && language !== currentLang) {
      setCurrentLang(language);
    }
  }, [language]);

  const handleLangToggle = (newLang) => {
    if (isRecording) {
      stopVoiceRecording(false);
    }
    setCurrentLang(newLang);
    setLanguage(newLang);
  };

  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Microphone not supported on this device/browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      let mimeType = "";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        }
      }

      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);

      latestTranscriptRef.current = "";
      isRecordingRef.current = true;
      setTranscript("");

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recog = new SpeechRecognition();
          recog.continuous = true;
          recog.interimResults = true;
          recog.lang = currentLang === "Hindi" ? "hi-IN" : "en-IN";

          recog.onresult = (event) => {
            let fullText = "";
            for (let i = 0; i < event.results.length; ++i) {
              fullText += event.results[i][0].transcript + " ";
            }
            const clean = fullText.trim();
            if (clean) {
              latestTranscriptRef.current = clean;
              setTranscript(clean);
            }
          };

          recog.onerror = (e) => {
            if (e.error !== "no-speech") {
              console.warn("Voice assistant speech notice:", e.error);
            }
          };

          recog.onend = () => {
            if (isRecordingRef.current) {
              try { recog.start(); } catch {}
            }
          };

          recog.start();
          recognitionRef.current = recog;
        } catch (e) {
          console.warn("Speech recognition error:", e);
        }
      }

      setSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);

      setIsRecording(true);
      if (setRecording) setRecording(true);
    } catch (err) {
      console.error("Microphone permission failed:", err);
      alert("Could not access microphone. Please enable microphone permissions.");
    }
  };

  const stopVoiceRecording = (shouldNavigate = true) => {
    isRecordingRef.current = false;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

    const duration = seconds || 1;
    const spoken = (latestTranscriptRef.current || transcript || "").trim();

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
        try {
          const mime = mediaRecorderRef.current?.mimeType || "audio/webm";
          const audioBlob = new Blob(audioChunksRef.current, { type: mime });
          const audioUrl = URL.createObjectURL(audioBlob);

          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(t => t.stop());
            mediaStreamRef.current = null;
          }

          if (shouldNavigate) {
            window.__pendingVoiceNote = {
              audioUrl,
              duration,
              transcript: spoken,
              lang: currentLang === "Hindi" ? "hi" : "en"
            };
            go("Ask NagrikAI");
          }
        } catch (e) {
          console.error("Voice note stop error:", e);
        }
      };

      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("Recorder stop error:", e);
      }
    } else {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
    }

    setIsRecording(false);
    if (setRecording) setRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopVoiceRecording(true);
    } else {
      startVoiceRecording();
    }
  };

  const formatSecs = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? "0" : ""}${sec}`;
  };

  return (
    <div className="page voice-mode-screen">
      {/* Top Bar with Language Selector */}
      <div className="topbar">
        <button className="icon-btn" onClick={() => {
          if (isRecording) stopVoiceRecording(false);
          go("Ask NagrikAI");
        }}>
          <ChevronLeft size={19} />
        </button>
        <b>{currentLang === "Hindi" ? "बोलकर पूछें" : "Speak your city"}</b>

        <div className="lang-selector-group" style={{ transform: "scale(0.9)" }}>
          <button
            className={`lang-selector-btn ${currentLang === "English" ? "active" : ""}`}
            onClick={() => handleLangToggle("English")}
          >
            EN
          </button>
          <button
            className={`lang-selector-btn ${currentLang === "Hindi" ? "active" : ""}`}
            onClick={() => handleLangToggle("Hindi")}
          >
            हिन्दी
          </button>
        </div>
      </div>

      <div className="eyebrow">
        {currentLang === "Hindi" ? "आवाज मोड • हिन्दी / ENGLISH" : "VOICE MODE • ENGLISH / हिन्दी"}
      </div>

      <h1 style={{ whiteSpace: "pre-line" }}>
        {isRecording
          ? (currentLang === "Hindi" ? `सुन रहा हूँ...\n[REC ${formatSecs(seconds)}]` : `I'm listening.\n[REC ${formatSecs(seconds)}]`)
          : (currentLang === "Hindi" ? "बोलने के लिए\nटैप करें।" : "Tap the orb.\nSpeak your city.")}
      </h1>

      {/* Interactive Animated Voice Orb */}
      <button
        className={`voice-orb-interactive ${isRecording ? "listening" : ""}`}
        onClick={toggleRecording}
        title={isRecording ? "Tap to finish and ask AI" : "Tap to record voice note"}
      >
        <span /><span /><span /><span /><span /><span />
        <span /><span /><span /><span /><span />
      </button>

      <p className={`center ${isRecording ? "green" : "muted"}`} style={{ fontWeight: 600 }}>
        {isRecording
          ? (currentLang === "Hindi" ? "● वॉयसनोट रिकॉर्ड हो रहा है — भेजने के लिए दोबारा टैप करें" : "● Recording voice note — tap orb to send to AI")
          : (currentLang === "Hindi" ? `● भाषा: हिन्दी — शुरू करने के लिए ऊपर टैप करें` : `● Language: English — tap orb above to record`)}
      </p>

      {/* Live Transcript Box */}
      <div className="voice-transcript-box">
        <div className="voice-transcript-label">
          <span>{currentLang === "Hindi" ? "लाइव ट्रांसक्रिप्ट" : "LIVE TRANSCRIPT"}</span>
          <span style={{ color: "#94a3b8", fontWeight: "normal" }}>
            {currentLang === "Hindi" ? "हिन्दी इनपुट" : "English input"}
          </span>
        </div>
        <div className="voice-transcript-text">
          {transcript || (
            <span style={{ color: "#64748b", fontStyle: "italic" }}>
              {currentLang === "Hindi"
                ? "यहाँ आपके बोले गए शब्द वास्तविक समय में दिखाई देंगे..."
                : "Your speech will appear here in real-time as you speak..."}
            </span>
          )}
        </div>
      </div>

      <button
        className="btn"
        onClick={() => stopVoiceRecording(true)}
        disabled={!isRecording && !transcript.trim()}
      >
        {currentLang === "Hindi" ? "यह वॉयसनोट एआई से पूछें" : "Send this voice note to AI"}
      </button>

      <button
        className="btn secondary"
        onClick={() => {
          if (isRecording) stopVoiceRecording(false);
          go("Ask NagrikAI");
        }}
      >
        {currentLang === "Hindi" ? "चैट पर वापस जाएं" : "Back to Ask AI Chat"}
      </button>

      <p className="hint">
        {currentLang === "Hindi"
          ? "नेगेटिव लेटेंसी मीडिया रिकॉर्डर एवं वेब स्पीच द्वारा संचालित। हिन्दी और अंग्रेजी में पूर्ण दोतरफा वॉयसनोट समर्थित।"
          : "Powered by native MediaRecorder & Web Speech. Complete two-way voicenotes in English & Hindi."}
      </p>
    </div>
  );
}

export default AskAI;
