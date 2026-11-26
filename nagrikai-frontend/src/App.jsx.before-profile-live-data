import React, { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { translateDOM } from "./translations";
import { supabase } from "./supabaseClient";
import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Popup,
  Polyline,
  useMap
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import {
  Activity, AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, Bell, Check,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3,
  CloudSun, Cloud, CloudRain, CloudLightning, CloudSnow, CloudDrizzle,
  Compass, Copy, FileText, Filter, Globe2, Headphones, Home,
  Info, Languages, Layers, LocateFixed, LockKeyhole, Map, MapPin, Menu,
  Mic, MicOff, Moon, Navigation, Plus, Search, Send, Settings, Shield,
  ShieldCheck, SlidersHorizontal, Sparkles, Sun, TrendingUp, User, Users,
  Volume2, WifiOff, X, Camera, Image as ImageIcon, MessageCircle, BarChart3
} from "lucide-react";

const GREEN = "#83c9a7";
const screens = [
  "Splash","Welcome","Language","Login","OTP verification","Home","Explore map","Map filters",
  "Capture report","Review report","Possible duplicate","Report submitted","Issue details",
  "GroundTruth AI","Responsible authority","Complaint handoff","Reference tracking","Weather & air",
  "Ask NagrikAI","Voice assistant","Civic navigation","City analytics","Profile","Report history",
  "Notifications","Accessibility","Privacy & settings","Loading","Empty history","Connection error"
];

const navItems = [
  {id:"Home", label:"Home", icon:Home},
  {id:"Explore map", label:"Explore", icon:Map},
  {id:"Capture report", label:"Report", icon:Plus},
  {id:"Ask NagrikAI", label:"Ask AI", icon:Sparkles},
  {id:"Profile", label:"Profile", icon:User}
];

function App() {
  const [screen, setScreen] = useState("Splash");
  const [language, setLanguage] = useState(() => localStorage.getItem("nagrikai-language") || "English");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["","","","","",""]);
  const [authLoading, setAuthLoading] = useState(false);
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [filters, setFilters] = useState(["Potholes & damaged roads","Waterlogging"]);
  const [distance, setDistance] = useState("2 km");
  const [issue, setIssue] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [submittedReport, setSubmittedReport] = useState(null);
  const [duplicateReports, setDuplicateReports] = useState([]);
  const [duplicateStatus, setDuplicateStatus] = useState("idle");
  const [duplicateError, setDuplicateError] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [locationError, setLocationError] = useState("");
  const [locationDetails, setLocationDetails] = useState(null);
  const autoLocationStarted = useRef(false);
  const [weatherData, setWeatherData] = useState(null);
  const [weatherStatus, setWeatherStatus] = useState("idle");
  const [weatherError, setWeatherError] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [recording, setRecording] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [privacy, setPrivacy] = useState(true);
  const [accessibility, setAccessibility] = useState({motion:true, contrast:true, text:false, voice:false});
  const [reportCount, setReportCount] = useState(8);
  const [selectedTab, setSelectedTab] = useState("Home");

  useEffect(() => {
    localStorage.setItem("nagrikai-language", language);
    document.documentElement.lang = language === "Hindi" ? "hi" : "en";
    const root = document.querySelector(".app-shell");
    if (!root) return;
    translateDOM(root, language);
    const observer = new MutationObserver(() => translateDOM(root, language));
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "title", "aria-label"] });
    return () => observer.disconnect();
  }, [language]);
  
  useEffect(() => {
  if (!userLocation) {
    setWeatherData(null);
    setWeatherStatus("idle");
    setWeatherError("");
    return;
  }

  const controller = new AbortController();
  let active = true;

  const loadWeather = async () => {
    try {
      setWeatherStatus(current =>
        current === "success" ? "refreshing" : "loading"
      );
      setWeatherError("");

      const params = new URLSearchParams({
        latitude: String(userLocation.lat),
        longitude: String(userLocation.lng),

        current:
          "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,weather_code,wind_speed_10m",

        hourly:
          "temperature_2m,precipitation_probability,precipitation,rain,weather_code",

        daily:
          "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code,sunrise,sunset",

        forecast_days: "3",
        timezone: "auto"
      });

      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
        { signal: controller.signal }
      );

      if (!response.ok) {
        throw new Error(`Weather service returned ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.reason || "Weather data unavailable.");
      }

      if (active) {
        setWeatherData(data);
        setWeatherStatus("success");
      }

    } catch (error) {
      if (error.name === "AbortError") return;

      console.error("Weather API error:", error);

      if (active) {
        setWeatherStatus("error");
        setWeatherError(error.message || "Unable to load weather.");
      }
    }
  };

  loadWeather();

  const refreshInterval = window.setInterval(
    loadWeather,
    15 * 60 * 1000
  );

  return () => {
    active = false;
    controller.abort();
    window.clearInterval(refreshInterval);
  };

}, [userLocation]);

  const go = (name) => {
    setScreen(name);
    const nav = navItems.find(n => n.id === name);
    if (nav) setSelectedTab(nav.id);
    window.scrollTo?.(0,0);
  };
  const notify = (msg) => {
    setToast(msg);
    window.clearTimeout(window.__toastTimer);
    window.__toastTimer = window.setTimeout(() => setToast(""), 2400);
  };
  
const detectUserLocation = async () => {
  setLocationStatus("loading");
  setLocationError("");

  try {
    let position;

    if (Capacitor.isNativePlatform()) {
      let permission = await Geolocation.checkPermissions();

      if (
        permission.location !== "granted" &&
        permission.coarseLocation !== "granted"
      ) {
        permission = await Geolocation.requestPermissions();
      }

      if (
        permission.location !== "granted" &&
        permission.coarseLocation !== "granted"
      ) {
        throw new Error("Location permission denied.");
      }

      position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0
      });
    } else {
      if (!navigator.geolocation) {
        throw new Error("Location is not supported by this browser.");
      }

      position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0
          }
        );
      });
    }

    const location = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy
    };

    setUserLocation(location);
    setLocationStatus("success");

    fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${location.lat}&longitude=${location.lng}&localityLanguage=en`
    )
      .then(response => {
        if (!response.ok) {
          throw new Error("Location lookup failed");
        }
        return response.json();
      })
      .then(data => {
        setLocationDetails({
          city: data.city || data.locality || "",
          locality: data.locality || "",
          state: data.principalSubdivision || "",
          country: data.countryName || ""
        });
      })
      .catch(error => {
        console.error("Reverse geocoding error:", error);
        setLocationDetails(null);
      });

    notify(
      `Location detected. Accuracy: ±${Math.round(location.accuracy)} metres`
    );

  } catch (error) {
    let message = "Unable to detect your location.";

    if (
      error.code === 1 ||
      error.message?.toLowerCase().includes("permission")
    ) {
      message = "Location permission denied. Allow location access in app settings.";
    } else if (error.code === 2) {
      message = "Your location is currently unavailable.";
    } else if (error.code === 3) {
      message = "Location request timed out. Please try again.";
    }

    console.error("GPS error:", error);
    setLocationStatus("error");
    setLocationError(message);
    setLocationDetails(null);
    notify(message);
  }
};

  
useEffect(() => {
  if (autoLocationStarted.current) return;

  autoLocationStarted.current = true;
  detectUserLocation();
}, []);

  const handleSendOtp = async () => {
  const digits = phone.replace(/\D/g, "");

if (!/^[6-9]\d{9}$/.test(digits)) {
  notify("Enter a valid 10-digit Indian mobile number.");
  return;
}

const formattedPhone = `+91${digits}`;

  setAuthLoading(true);

  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone
    });

    if (error) throw error;

    go("OTP verification");
    notify("OTP request successful. Enter your test OTP.");
  } catch (error) {
    notify(error.message || "Unable to request OTP.");
  } finally {
    setAuthLoading(false);
  }
};
const handleVerifyOtp = async () => {
  const digits = phone.replace(/\D/g, "");
  const token = otp.join("");

  if (!/^[6-9]\d{9}$/.test(digits)) {
    notify("Invalid mobile number.");
    go("Login");
    return;
  }

  if (!/^\d{6}$/.test(token)) {
    notify("Enter all 6 OTP digits.");
    return;
  }

  setAuthLoading(true);

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: `+91${digits}`,
      token,
      type: "sms"
    });

    if (error) throw error;

    if (!data.session) {
      throw new Error("Authentication session was not created.");
    }

    go("Home");
    notify("Phone number verified successfully.");

  } catch (error) {
    setOtp(["", "", "", "", "", ""]);
    notify("Incorrect or expired OTP. Please try again.");

  } finally {
    setAuthLoading(false);
  }
};
  const toggleFilter = (name) => setFilters(v => v.includes(name) ? v.filter(x => x !== name) : [...v,name]);
  const checkNearbyReports = async () => {
    if (duplicateStatus === "loading") return;

    if (
      !category ||
      !Number.isFinite(userLocation?.lat) ||
      !Number.isFinite(userLocation?.lng)
    ) {
      notify("Select a category and detect your GPS location first.");
      return;
    }

    setDuplicateReports([]);
    setDuplicateError("");
    setDuplicateStatus("loading");
    go("Possible duplicate");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;
      if (!authData?.user) {
        throw new Error("Please sign in before checking nearby reports.");
      }

      const { data, error } = await supabase.rpc(
        "find_nearby_reports",
        {
          p_lat: userLocation.lat,
          p_lng: userLocation.lng,
          p_category: category
        }
      );

      if (error) throw error;

      setDuplicateReports(Array.isArray(data) ? data : []);
      setDuplicateStatus("success");
    } catch (error) {
      console.error("Nearby report lookup failed:", error);
      setDuplicateError(
        error.message || "Nearby reports could not be checked."
      );
      setDuplicateStatus("error");
    }
  };
  const submitReport = async () => {
    if (submissionLoading) return;

    if (
      issue.trim().length < 3 ||
      issue.trim().length > 140 ||
      description.trim().length < 10 ||
      !photo?.file ||
      !category ||
      !severity ||
      !Number.isFinite(userLocation?.lat) ||
      !Number.isFinite(userLocation?.lng)
    ) {
      notify("Enter a title of 3–140 characters, a description of at least 10 characters, and complete all other required fields.");
      return;
    }

    setSubmissionLoading(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      const user = authData?.user;

      if (!user) {
        throw new Error("Please sign in before submitting a report.");
      }

      const file = photo.file;

      const extensions = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/heic": "heic",
        "image/heif": "heif"
      };

      const extension = extensions[file.type] || "img";
      const uniqueId = crypto.randomUUID();
      const photoPath = `${user.id}/${uniqueId}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("report-evidence")
        .upload(photoPath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      const reportPayload = {
        user_id: user.id,
        title: issue.trim(),
        description: description.trim(),
        category,
        severity,
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        location_accuracy_m: Number.isFinite(userLocation.accuracy)
          ? userLocation.accuracy
          : null,
        locality: locationDetails?.locality || null,
        city: locationDetails?.city || null,
        state: locationDetails?.state || null,
        country: locationDetails?.country || null,
        photo_path: photoPath
      };

      const { data: reportData, error: reportError } = await supabase
        .from("reports")
        .insert(reportPayload)
        .select("id, report_number, title, status, created_at")
        .single();

      if (reportError) throw reportError;

      setSubmittedReport(reportData);
      go("Report submitted");
      notify("Your report was saved successfully.");

    } catch (error) {
      console.error("Report submission failed:", error);
      notify(error.message || "Unable to submit your report. Please try again.");
    } finally {
      setSubmissionLoading(false);
    }
  };
  const submitEvidence = async (existingReport) => {
    if (evidenceLoading) return;

    if (!existingReport?.id || !photo?.file || description.trim().length < 10) {
      notify("A photo and description of at least 10 characters are required.");
      return;
    }

    setEvidenceLoading(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      const user = authData?.user;
      if (!user) {
        throw new Error("Please sign in before adding evidence.");
      }

      const file = photo.file;
      const extensions = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/heic": "heic",
        "image/heif": "heif"
      };

      const extension = extensions[file.type] || "img";
      const photoPath = `${user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("report-evidence")
        .upload(photoPath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      const { data: evidenceData, error: evidenceError } = await supabase
        .from("report_evidence")
        .insert({
          report_id: existingReport.id,
          user_id: user.id,
          photo_path: photoPath,
          note: description.trim()
        })
        .select("id, report_id, created_at")
        .single();

      if (evidenceError) throw evidenceError;

      setSubmittedReport({
        ...existingReport,
        evidenceAdded: true,
        evidenceCreatedAt: evidenceData.created_at
      });

      go("Report submitted");
      notify("Evidence added to the existing report.");

    } catch (error) {
      console.error("Evidence contribution failed:", error);
      notify(error.message || "Unable to add evidence. Please try again.");
    } finally {
      setEvidenceLoading(false);
    }
  };
  const nav = (id) => { setSelectedTab(id); go(id); };

  return <div className="app-shell">
    <div className="device">
      <main className="screen-content">
        {screen === "Splash" && <Splash go={go}/>}
        {screen === "Welcome" && (
           <Welcome
            go={go}
            userLocation={userLocation}
            locationDetails={locationDetails}
            locationStatus={locationStatus}
            onLocate={detectUserLocation}
           />
         )}
        {screen === "Language" && <Language language={language} setLanguage={setLanguage} go={go}/>}
        {screen === "Login" && <Login phone={phone} setPhone={setPhone} go={go} notify={notify} onSendOtp={handleSendOtp} authLoading={authLoading}/>}
        {screen === "OTP verification" && <OTP phone={phone} otp={otp} setOtp={setOtp} go={go} notify={notify} onVerify={handleVerifyOtp} authLoading={authLoading}/>}
        {screen === "Home" && (
          <HomeScreen
           go={go}
           language={language}
           reportCount={reportCount}
           notify={notify}
           userLocation={userLocation}
           locationDetails={locationDetails}
           locationStatus={locationStatus}
           onLocate={detectUserLocation}
           weatherData={weatherData}
           weatherStatus={weatherStatus}
           weatherError={weatherError}

         />
        )}
        {screen === "Explore map" && (
        <ExploreMap
         go={go}
         query={query}
         setQuery={setQuery}
         userLocation={userLocation}
         locationStatus={locationStatus}
         locationError={locationError}
         onLocate={detectUserLocation}
         />
         )}
        {screen === "Map filters" && <MapFilters filters={filters} toggleFilter={toggleFilter} distance={distance} setDistance={setDistance} go={go}/>}
        {screen === "Capture report" && <CaptureReport issue={issue} setIssue={setIssue} description={description} setDescription={setDescription} photo={photo} setPhoto={setPhoto} category={category} setCategory={setCategory} userLocation={userLocation} locationStatus={locationStatus} locationDetails={locationDetails} onLocate={detectUserLocation} go={go} notify={notify}/>}
        {screen === "Review report" && <ReviewReport issue={issue} description={description} photo={photo} category={category} severity={severity} setSeverity={setSeverity} go={go} onCheckDuplicates={checkNearbyReports} duplicateLoading={duplicateStatus === "loading"}/>}
        {screen === "Possible duplicate" && <Duplicate go={go} issue={issue} matches={duplicateReports} status={duplicateStatus} error={duplicateError} onRetry={checkNearbyReports} onSubmitNew={submitReport} newLoading={submissionLoading} onAddEvidence={submitEvidence} evidenceLoading={evidenceLoading}/>} 
        {screen === "Report submitted" && <Submitted go={go} report={submittedReport}/>}
        {screen === "Issue details" && <IssueDetails go={go} issue={issue}/>}
        {screen === "GroundTruth AI" && <GroundTruth go={go}/>}
        {screen === "Responsible authority" && <Authority go={go}/>}
        {screen === "Complaint handoff" && <Handoff go={go} notify={notify}/>}
        {screen === "Reference tracking" && <Tracking go={go}/>}
        {screen === "Weather & air" && (
        <Weather
        go={go}
        userLocation={userLocation}
        locationDetails={locationDetails}
        weatherData={weatherData}
        weatherStatus={weatherStatus}
        weatherError={weatherError}
        />
        )}
        {screen === "Ask NagrikAI" && <AskAI go={go} query={query} setQuery={setQuery}/>}
        {screen === "Voice assistant" && <Voice recording={recording} setRecording={setRecording} go={go}/>}
        {screen === "Civic navigation" && <NavigationScreen go={go}/>}
        {screen === "City analytics" && <Analytics go={go}/>}
        {screen === "Profile" && <Profile go={go} reportCount={reportCount}/>}
        {screen === "Report history" && <History go={go}/>}
        {screen === "Notifications" && <Notifications go={go} enabled={notifications} setEnabled={setNotifications}/>}
        {screen === "Accessibility" && <Accessibility go={go} values={accessibility} setValues={setAccessibility}/>}
        {screen === "Privacy & settings" && <Privacy go={go} privacy={privacy} setPrivacy={setPrivacy}/>}
        {screen === "Loading" && <Loading go={go}/>}
        {screen === "Empty history" && <Empty go={go}/>}
        {screen === "Connection error" && <Offline go={go}/>}
      </main>
      {!["Splash","Welcome","Language","Login","OTP verification"].includes(screen) &&
        <BottomNav selected={selectedTab} nav={nav}/>}
      {toast && <div className="toast"><CheckCircle2 size={15}/>{toast}</div>}
    </div>
    <aside className="screen-index">
      <div className="index-head"><div className="brand-mark small">N</div><div><b>NagrikAI</b><small>Prototype navigation</small></div></div>
      <p className="index-caption">ALL 30 SCREENS</p>
      <div className="index-grid">{screens.map((s,i)=><button key={s} className={screen===s?"active":""} onClick={()=>go(s)}><span>{String(i+1).padStart(2,"0")}</span>{s}</button>)}</div>
      <p className="index-note">Use this panel to preview every designed screen. The bottom navigation and in-screen actions are also connected.</p>
    </aside>
  </div>;
}

function StatusBarTitle({title, back, right}) {
  return <div className="topbar">{back ? <button className="icon-btn" onClick={back}><ChevronLeft size={19}/></button> : <span/>}<b>{title}</b>{right || <span/>}</div>;
}
function Button({children,onClick,secondary=false,disabled=false}) {
  return <button className={`btn ${secondary?"secondary":""}`} onClick={onClick} disabled={disabled}>{children}</button>;
}
function Card({children,className=""}) { return <section className={`panel ${className}`}>{children}</section>; }
function Label({children}) { return <div className="eyebrow">{children}</div>; }
function useCurrentTime() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return now;
}
function Field({label,value,onChange,placeholder}) { return <label className="field"><span>{label}</span><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label>; }
function BottomNav({selected,nav}) {
  return <nav className="bottom-nav">{navItems.map(({id,label,icon:Icon})=><button key={id} className={`${selected===id?"selected":""} ${id==="Capture report"?"report-nav":""}`} onClick={()=>nav(id)}><Icon size={17}/><small>{label}</small></button>)}</nav>;
}
function Splash({go}) {
  return <div className="center-page splash"><div className="brand-mark">N</div><h1>NagrikAI</h1><p>Your City. Your Voice.<br/>Your Intelligence.</p><div className="micro-line">GREATER NOIDA&nbsp; / &nbsp;CIVIC INTELLIGENCE</div><div className="bottom-action"><Button onClick={()=>go("Welcome")}>Get started</Button></div></div>;
}
function Welcome({
  go,
  userLocation,
  locationDetails,
  locationStatus,
  onLocate
}) {
  const now = useCurrentTime();


  const dateText = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(now);

  const timeText = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  const placeName = locationDetails
    ? [
        locationDetails.locality,
        locationDetails.city,
        locationDetails.state
      ].filter((value, index, array) =>
        value && array.indexOf(value) === index
      ).join(", ")
    : userLocation
      ? "Resolving your location..."
      : "Location not detected";

  const coordinates = userLocation
    ? `${Math.abs(userLocation.lat).toFixed(4)}° ${userLocation.lat >= 0 ? "N" : "S"} · ${Math.abs(userLocation.lng).toFixed(4)}° ${userLocation.lng >= 0 ? "E" : "W"}`
    : "Enable location to personalise your experience";

  return (
    <div className="page">
      <Label>YOUR CITY, DECODED.</Label>

      <div className="city-hero">
        <div className="tiny-coord">{coordinates}</div>

        <div className="brand-mark">N</div>

        <b>{placeName.toUpperCase()}</b>

        <div className="stat-row">
          <span>{dateText}</span>
          <span>{timeText}</span>
        </div>
      </div>

      {!userLocation && (
        <Button
          secondary
          onClick={onLocate}
          disabled={locationStatus === "loading"}
        >
          {locationStatus === "loading"
            ? "Detecting location..."
            : "Detect my location"}
        </Button>
      )}

      <h1>A smarter city starts<br />with you.</h1>

      <p className="muted">
        Spot what matters. Report with proof.<br />
        Let civic intelligence handle the noise.
      </p>

      <Card>
        <p>01 &nbsp; See beyond the traffic</p>
        <p>02 &nbsp; Turn evidence into action</p>
        <p>03 &nbsp; Know what changed — and what didn't</p>
      </Card>

      <div className="bottom-action">
        <Button onClick={() => go("Language")}>Continue</Button>
      </div>
    </div>
  );
}
function Language({language,setLanguage,go}) {
  return <div className="page"><StatusBarTitle title="Choose your language" back={()=>go("Welcome")}/><Label>01 / 03 &nbsp; PERSONALISE</Label><h1>Your city.<br/>Your language.</h1><p className="muted">Choose how NagrikAI speaks to you. You can change this anytime.</p>{["English","Hindi"].map(v=><button className={`choice ${language===v?"chosen":""}`} onClick={()=>setLanguage(v)} key={v}><span>{v==="Hindi"?"हिन्दी":"English"}</span><small>{language===v?"Selected language":"भाषा चुनें"}</small>{language===v&&<Check size={17}/>}</button>)}<p className="hint">All conversations support both English and Hindi, including voice input.</p><div className="bottom-action"><Button onClick={()=>go("Login")}>Continue in {language === "Hindi" ? "हिन्दी" : "English"}</Button></div></div>;
}
function Login({phone,setPhone,go,notify,onSendOtp,authLoading}) {
  return <div className="page"><StatusBarTitle title="Welcome to NagrikAI" back={()=>go("Language")}/><Label>02 / 03 &nbsp; SECURE SIGN-IN</Label><h1>One number.<br/>A stronger voice.</h1><p className="muted">Track your reports and get updates that actually matter.</p><Field
  label="MOBILE NUMBER"
  value={phone}
  onChange={value => setPhone(value.replace(/\D/g, "").slice(0, 10))}
  placeholder="Enter 10-digit mobile number"
/>
<Button onClick={onSendOtp} disabled={authLoading || phone.length !== 10}>
  {authLoading ? "Sending..." : "Send verification code"}
</Button>
<Card><b>Your number stays private.</b><p className="muted">Public reports never show your phone number. Your location is shared only with your consent.</p></Card><p className="hint">By continuing, you accept the Terms of Service and Privacy Policy.</p><Button secondary onClick={()=>go("Home")}>Explore without signing in</Button></div>;
}
function OTP({phone,otp,setOtp,go,notify,onVerify,authLoading}) {

  const handleOtpChange = (event, index) => {
    const entered = event.target.value.replace(/\D/g, "");
    const digits = entered.slice(0, 6 - index);

    const next = [...otp];

    if (!digits) {
      next[index] = "";
      setOtp(next);
      return;
    }

    digits.split("").forEach((digit, offset) => {
      next[index + offset] = digit;
    });

    setOtp(next);

    const inputs = event.currentTarget.parentElement.querySelectorAll("input");
    inputs[Math.min(index + digits.length, 5)]?.focus();
  };

  const handleOtpKeyDown = (event, index) => {
    const inputs = event.currentTarget.parentElement.querySelectorAll("input");

    if (event.key === "Backspace" && !otp[index] && index > 0) {
      event.preventDefault();

      const next = [...otp];
      next[index - 1] = "";
      setOtp(next);

      inputs[index - 1]?.focus();
    }

    if (event.key === "ArrowLeft" && index > 0) {
      inputs[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < 5) {
      inputs[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (event) => {
    event.preventDefault();

    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!pasted) return;

    const next = Array.from(
      { length: 6 },
      (_, index) => pasted[index] || ""
    );

    setOtp(next);

    const inputs = event.currentTarget.parentElement.querySelectorAll("input");
    inputs[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="page">

      <StatusBarTitle
        title="Verify your number"
        back={() => go("Login")}
      />

      <Label>03 / 03 &nbsp; VERIFY</Label>

      <h1>Check your messages.</h1>

      <p className="muted">
        Enter the 6-digit code sent to
        <br />
        +91-{phone}
      </p>

      <div className="otp-row">

        {otp.map((value, index) => (
          <input
            key={index}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            autoFocus={index === 0}
            maxLength={1}
            value={value}
            aria-label={`OTP digit ${index + 1}`}
            onChange={(event) => handleOtpChange(event, index)}
            onKeyDown={(event) => handleOtpKeyDown(event, index)}
            onPaste={handleOtpPaste}
          />
        ))}

      </div>

      <Button
        onClick={onVerify}
        disabled={authLoading || otp.join("").length !== 6}
      >
        {authLoading ? "Verifying..." : "Verify & enter city"}
      </Button>

      <Button
        secondary
        onClick={() => notify("Please request a new verification code.")}
      >
        Resend code
      </Button>

      <Card>
        <b>A little security. A lot of trust.</b>
        <p className="muted">
          Your reports stay connected to you.
          Your identity stays yours.
        </p>
      </Card>

    </div>
  );
}
function WeatherVisual({ code, temperature, isDay = 1, size = 26 }) {
  let Icon = CloudSun;
  let color = "#70C8FF";
  let animation = "weather-float";

  if (code === 0) {
    Icon = isDay ? Sun : Moon;
    color = temperature >= 30 ? "#FFB547" : "#FFD34E";
    animation = "weather-pulse";
  } else if ([1, 2].includes(code)) {
    Icon = CloudSun;
    color = "#70C8FF";
  } else if ([3, 45, 48].includes(code)) {
    Icon = Cloud;
    color = "#A9C9E8";
  } else if ([51, 53, 55, 56, 57].includes(code)) {
    Icon = CloudDrizzle;
    color = "#75C8FF";
    animation = "weather-rain";
  } else if ([61, 63, 65, 80, 81, 82].includes(code)) {
    Icon = CloudRain;
    color = "#55B7FF";
    animation = "weather-rain";
  } else if ([71, 73, 75, 77, 85, 86].includes(code)) {
    Icon = CloudSnow;
    color = "#B9E8FF";
  } else if ([95, 96, 99].includes(code)) {
    Icon = CloudLightning;
    color = "#C4A5FF";
    animation = "weather-pulse";
  }

  if (temperature <= 10 && code < 45) {
    color = "#8CDFFF";
  }

  return (
    <Icon
      size={size}
      strokeWidth={1.8}
      className={`weather-visual ${animation}`}
      style={{
        color,
        filter: `drop-shadow(0 0 8px ${color}70)`
      }}
    />
  );
}
function HomeScreen({
  go,
  language,
  reportCount,
  notify,
  userLocation,
  locationDetails,
  locationStatus,
  onLocate,
  weatherData,
  weatherStatus,
  weatherError
}) {
  const now = useCurrentTime();


  const [newsArticles, setNewsArticles] = useState([]);
  const [newsStatus, setNewsStatus] = useState("idle");
  const [newsError, setNewsError] = useState("");

  const [expandedNewsUrl, setExpandedNewsUrl] = useState("");
  const [newsDetails, setNewsDetails] = useState({});
  const [newsDetailStatus, setNewsDetailStatus] = useState({});

  const newsTerms = [
  locationDetails?.locality,
  locationDetails?.city,
  locationDetails?.state
]
  .filter(value => typeof value === "string" && value.trim())
  .map(value => value.trim());

const isGautamBudhNagar = newsTerms.some(
  value => value.toLowerCase().includes("gautam budh nagar")
);

if (isGautamBudhNagar) {
  newsTerms.push("Noida", "Greater Noida");
}

const uniqueNewsTerms = [...new Set(newsTerms)];

const newsLocation = uniqueNewsTerms.join(", ");

  useEffect(() => {

    const controller = new AbortController();
    let active = true;
    let hasLoaded = false;

    const translateHeadline = async (title) => {
      const cacheKey = `nagrikai-news-hi:${title}`;

      const cached = localStorage.getItem(cacheKey);
      if (cached) return cached;

      const params = new URLSearchParams({
        q: title,
        langpair: "en|hi"
      });

      const response = await fetch(
        `https://api.mymemory.translated.net/get?${params}`,
        { signal: controller.signal }
      );

      if (!response.ok) {
        throw new Error("Hindi translation service unavailable.");
      }

      const result = await response.json();

      if (
        Number(result.responseStatus) !== 200 ||
        !result.responseData?.translatedText
      ) {
        throw new Error(
          result.responseDetails || "Hindi translation unavailable."
        );
      }

      const translated = result.responseData.translatedText;

      localStorage.setItem(cacheKey, translated);

      return translated;
    };

    const loadNews = async () => {
      try {
        setNewsStatus(hasLoaded ? "refreshing" : "loading");
        setNewsError("");

        const query = "sourcecountry:IN sourcelang:English";`(${uniqueNewsTerms
  .map(term => `"${term.replace(/"/g, "")}"`)
  .join(" OR ")}) sourcelang:english`;

        const params = new URLSearchParams({
          query,
          mode: "ArtList",
          format: "json",
          maxrecords: "6",
          timespan: "3d",
          sort: "DateDesc"
        });

        const response = await fetch(
          `https://api.gdeltproject.org/api/v2/doc/doc?${params}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`News service returned ${response.status}.`);
        }

        const data = await response.json();

        if (!Array.isArray(data.articles)) {
          throw new Error("Unexpected news service response.");
        }

        const articles = data.articles
          .filter(item => item.title && item.url)
          .slice(0, 6)
          .map(item => {
            let source = item.domain || "News publisher";

            try {
              source = item.domain ||
                new URL(item.url).hostname.replace(/^www\./, "");
            } catch {
              // Retain the available publisher name.
            }

            return {
              title: item.title,
              displayTitle: item.title,
              url: item.url,
              source,
              seenDate: item.seendate || null,
              translationFailed: false
            };
          });

        let translatedArticles = articles;

        if (language === "Hindi") {
          translatedArticles = await Promise.all(
            articles.map(async article => {
              try {
                return {
                  ...article,
                  displayTitle: await translateHeadline(article.title)
                };
              } catch (error) {
                if (error.name === "AbortError") throw error;

                return {
                  ...article,
                  displayTitle: "इस समाचार का हिंदी अनुवाद उपलब्ध नहीं है।",
                  translationFailed: true
                };
              }
            })
          );
        }

        if (!active) return;

        setNewsArticles(translatedArticles);
        setNewsStatus("success");
        setNewsError("");
        hasLoaded = true;

      } catch (error) {
        if (error.name === "AbortError") return;
        if (!active) return;

        console.error("NagrikAI news error:", error);

        setNewsStatus("error");
        setNewsError(error.message || "Unable to load news.");
      }
    };

    loadNews();

    const refresh = window.setInterval(
      loadNews,
      15 * 60 * 1000
    );

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(refresh);
    };

   }, [language]);

  const formatNewsDate = value => {
    if (!value) return "समय उपलब्ध नहीं है";

    const match = String(value).match(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/
    );

const handleNewsClick = async (article) => {
  if (expandedNewsUrl === article.url) {
    setExpandedNewsUrl("");
    return;
  }

  setExpandedNewsUrl(article.url);

  if (
    newsDetails[article.url] ||
    newsDetailStatus[article.url] === "loading"
  ) {
    return;
  }

  setNewsDetailStatus(prev => ({
    ...prev,
    [article.url]: "loading"
  }));

  try {
    const hostname = new URL(article.url).hostname.replace(/^www\./, "");

    const stopWords = new Set([
      "the", "and", "for", "with", "from", "that",
      "this", "have", "has", "was", "were", "will",
      "after", "before", "over", "into", "about",
      "says", "said", "their", "they", "there",
      "been", "being", "what", "when", "where"
    ]);

    const keywords = article.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 3);

    if (!keywords.length) {
      throw new Error("Could not identify article search terms.");
    }

    const params = new URLSearchParams({
      query: `domain:${hostname} ${keywords.join(" ")}`,
      mode: "artlist",
      format: "json",
      maxrecords: "10",
      timespan: "24h",
      sort: "DateDesc"
    });

    const response = await fetch(
      `https://api.gdeltproject.org/api/v2/context/context?${params}`
    );

    if (!response.ok) {
      throw new Error("Unable to retrieve article context.");
    }

    const data = await response.json();

    const articles = Array.isArray(data.articles)
      ? data.articles
      : [];

    const normalizeUrl = value => {
      try {
        const parsed = new URL(value);
        return (
          parsed.hostname.toLowerCase().replace(/^www\./, "") +
          parsed.pathname.replace(/\/+$/, "")
        );
      } catch {
        return "";
      }
    };

    const matchedArticle = articles.find(
      item => normalizeUrl(item.url) === normalizeUrl(article.url)
    );

    const rawContext = (
      matchedArticle?.context ||
      matchedArticle?.sentence ||
      ""
    ).trim().slice(0, 450);

    let summary = rawContext;

    if (!rawContext) {
      summary = language === "Hindi"
        ? "इस समाचार का विस्तृत संदर्भ अभी उपलब्ध नहीं है।"
        : "No matching article context is available from the news index.";
    }

    if (rawContext && language === "Hindi") {
      const cacheKey = `nagrikai-news-context-hi:${rawContext}`;

      try {
        const cached = localStorage.getItem(cacheKey);

        if (cached) {
          summary = cached;
        } else {
          const translationParams = new URLSearchParams({
            q: rawContext,
            langpair: "en|hi"
          });

          const translationResponse = await fetch(
            `https://api.mymemory.translated.net/get?${translationParams}`
          );

          const translationData = await translationResponse.json();

          if (
            !translationResponse.ok ||
            Number(translationData.responseStatus) !== 200 ||
            !translationData.responseData?.translatedText
          ) {
            throw new Error("Hindi translation unavailable.");
          }

          summary = translationData.responseData.translatedText;
          localStorage.setItem(cacheKey, summary);
        }
      } catch (translationError) {
        console.error("Article translation error:", translationError);
        summary = "इस समाचार का हिंदी संदर्भ अभी उपलब्ध नहीं है। मूल लेख के लिए स्रोत लिंक खोलें।";
      }
    }

    setNewsDetails(prev => ({
      ...prev,
      [article.url]: {
        summary,
        hasContext: Boolean(rawContext),
        source: article.source,
        date: article.seenDate
      }
    }));

    setNewsDetailStatus(prev => ({
      ...prev,
      [article.url]: "success"
    }));

  } catch (error) {
    console.error("Article details error:", error);

    setNewsDetailStatus(prev => ({
      ...prev,
      [article.url]: "error"
    }));
  }
};


    const date = match
      ? new Date(
          `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`
        )
      : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Time unavailable";
    }

    return date.toLocaleString(
      language === "Hindi" ? "hi-IN" : "en-IN",
      {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit"
      }
    );
  };


  const dateText = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(now);

  const timeText = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  const placeName = locationDetails
    ? [
        locationDetails.locality,
        locationDetails.city,
        locationDetails.state
      ].filter((value, index, array) =>
        value && array.indexOf(value) === index
      ).join(", ")
    : userLocation
      ? "Resolving your location..."
      : "Location not detected";
  
    const currentWeather = weatherData?.current;
  const dailyWeather = weatherData?.daily;
  const hourlyWeather = weatherData?.hourly;

  const weatherLabels = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Snow",
    80: "Rain showers",
    81: "Rain showers",
    82: "Heavy rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm",
    99: "Heavy thunderstorm"
  };

  const conditionText = currentWeather
    ? weatherLabels[currentWeather.weather_code] || "Weather conditions"
    : weatherStatus === "loading"
      ? "Loading weather..."
      : weatherStatus === "error"
        ? "Weather unavailable"
        : "Waiting for weather data";

  const hourlyStart = hourlyWeather?.time && currentWeather
    ? Math.max(
        0,
        hourlyWeather.time.findIndex(t => t >= currentWeather.time)
      )
    : 0;

  const upcomingHours = hourlyWeather?.time
    ? Array.from({ length: 4 }, (_, i) => hourlyStart + i)
        .filter(i => i < hourlyWeather.time.length)
    : [];

  return (
    <div className="page">

      <div className="home-heading">
        <div>
          <Label>{dateText.toUpperCase()} • {timeText}</Label>
          <h2>{placeName}</h2>
        </div>

        <button
          className="icon-btn"
          onClick={() => go("Notifications")}
        >
          <Bell size={18} />
        </button>
      </div>

      {!userLocation && (
        <Button
          secondary
          onClick={onLocate}
          disabled={locationStatus === "loading"}
        >
          {locationStatus === "loading"
            ? "Detecting location..."
            : "Detect my location"}
        </Button>
      )}

            <Card className="weather-card">
        <div>
          <strong>
            {currentWeather
              ? `${Math.round(currentWeather.temperature_2m)}°`
              : weatherStatus === "loading" ? "..." : "—"}
          </strong>

          {currentWeather && (
  <WeatherVisual
    code={currentWeather.weather_code}
    temperature={currentWeather.temperature_2m}
    isDay={currentWeather.is_day}
    size={36}
  />
)}

          <span>{conditionText}</span>
        </div>

        <small>
          {currentWeather
            ? `Feels like ${Math.round(currentWeather.apparent_temperature)}°`
            : weatherError || "Waiting for your local weather forecast."}
        </small>

        {currentWeather && dailyWeather && (
          <p>
            H {Math.round(dailyWeather.temperature_2m_max[0])}°
            {" / "}
            L {Math.round(dailyWeather.temperature_2m_min[0])}°
          </p>
        )}

        {currentWeather && (
          <p className="muted">
            Humidity: {currentWeather.relative_humidity_2m}%
            {" • "}
            Wind: {currentWeather.wind_speed_10m} km/h
          </p>
        )}

        <p className="muted">
          AIR QUALITY • Awaiting verified monitoring-station data
        </p>

        {weatherStatus === "error" && (
          <p className="amber">{weatherError}</p>
        )}

        <button
  className="forecast-link"
  onClick={() => go("Weather & air")}
>
  View complete forecast <ChevronRight size={15} />
</button>
      </Card>
            {currentWeather && upcomingHours.length > 0 && (
        <>
          <Label>UPCOMING HOURLY FORECAST</Label>

          <div className="forecast">
            {upcomingHours.map(index => (
              <div key={hourlyWeather.time[index]}>
                <small>
                  {index === hourlyStart
                    ? "NOW"
                    : new Date(
                        hourlyWeather.time[index]
                      ).toLocaleTimeString([], {
                        hour: "numeric"
                      })}
                </small>

                <WeatherVisual
  code={hourlyWeather.weather_code[index]}
  temperature={hourlyWeather.temperature_2m[index]}
  isDay={currentWeather?.is_day}
  size={23}
/>

                <b>
                  {Math.round(hourlyWeather.temperature_2m[index])}°
                </b>

                <small>
                  {hourlyWeather.precipitation_probability?.[index] ?? "—"}%
                  rain
                </small>
              </div>
            ))}
          </div>
        </>
      )}

      
<Label>{language === "Hindi"
  ? "भारत • GDELT News • हर 15 मिनट में अपडेट"
  : "India-wide • GDELT News • Updates every 15 minutes"}</Label>

<Card className="insight news-panel">
  <div className="split">
    <b className="green">
      {language === "Hindi" ? "ताज़ा सुर्खियाँ" : "LATEST HEADLINES"}
    </b>

    <small className="muted">
      {newsStatus === "loading"
        ? language === "Hindi" ? "खबरें खोज रहे हैं..." : "Fetching..."
        : newsStatus === "refreshing"
          ? language === "Hindi" ? "अपडेट हो रहा है..." : "Updating..."
          : newsStatus === "success"
            ? language === "Hindi" ? "लाइव फ़ीड" : "Live feed"
            : language === "Hindi" ? "उपलब्ध नहीं" : "Unavailable"}
    </small>
  </div>

  {newsStatus === "loading" && newsArticles.length === 0 && (
    <p className="muted">
      {language === "Hindi"
        ? `${newsLocation} की खबरें खोजी जा रही हैं...`
        : `Finding recent news for ${newsLocation}...`}
    </p>
  )}

  {newsError && <p className="amber">{newsError}</p>}

  {newsArticles.map((article, index) => {
    const isExpanded = expandedNewsUrl === article.url;
    const detailStatus = newsDetailStatus[article.url];
    const details = newsDetails[article.url];

    return (
      <div className="news-item" key={article.url}>
        <button
          className="news-headline-button"
          onClick={() => handleNewsClick(article)}
        >
          <span className="news-number">
            {String(index + 1).padStart(2, "0")}
          </span>

          <span className="news-headline-text">
            {article.displayTitle}
          </span>

          <ChevronDown
            size={17}
            className={isExpanded ? "news-chevron expanded" : "news-chevron"}
          />
        </button>

        {article.translationFailed && (
          <small className="amber">
            {language === "Hindi"
              ? "हिंदी अनुवाद उपलब्ध नहीं है"
              : "Translation unavailable"}
          </small>
        )}

        <div className="news-meta">
          <span>{article.source}</span>
          <span>•</span>
          <span>
            {language === "Hindi" ? "इंडेक्स समय: " : "Indexed: "}
            {formatNewsDate(article.seenDate)}
          </span>
        </div>

        {isExpanded && (
          <div className="news-details">
            {detailStatus === "loading" && (
              <p className="muted">
                {language === "Hindi"
                  ? "लेख का संदर्भ प्राप्त किया जा रहा है..."
                  : "Retrieving article context..."}
              </p>
            )}

            {detailStatus === "error" && (
              <p className="amber">
                {language === "Hindi"
                  ? "लेख का सारांश अभी उपलब्ध नहीं है। मूल समाचार स्रोत देखें।"
                  : "Article context is unavailable. Please open the original source."}
              </p>
            )}

            {details && (
              <>
                <b className="green">
                  {language === "Hindi"
                    ? "लेख का संदर्भ"
                    : "ARTICLE CONTEXT"}
                </b>

                <p>{details.summary}</p>

                {!details.hasContext && (
                  <small className="muted">
                    {language === "Hindi"
                      ? "स्रोत से मिलान किया गया संदर्भ उपलब्ध नहीं था।"
                      : "No matching article context was returned by the source."}
                  </small>
                )}
              </>
            )}

            <a
              className="news-source-link"
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {language === "Hindi"
                ? `पूरा समाचार पढ़ें · ${article.source}`
                : `Read full article · ${article.source}`}
              <ArrowRight size={13} />
            </a>
          </div>
        )}

        <a
          className="news-small-source"
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {language === "Hindi" ? "स्रोत देखें" : "View source"}
        </a>
      </div>
    );
  })}

  {newsStatus === "success" && newsArticles.length === 0 && (
    <p className="muted">
      {language === "Hindi"
        ? "इस स्थान के लिए हाल की खबरें नहीं मिलीं।"
        : "No recent headlines matched this location."}
    </p>
  )}

  {newsStatus === "error" && newsArticles.length === 0 && (
    <p className="muted">
      {language === "Hindi"
        ? "अभी स्थानीय खबरें लोड नहीं हो सकीं।"
        : "Local headlines could not be loaded right now."}
    </p>
  )}

  <p className="hint">
    {language === "Hindi"
      ? `स्थान: ${newsLocation} • GDELT News • हर 15 मिनट में अपडेट`
      : `Location: ${newsLocation} • GDELT News • Updates every 15 minutes`}
  </p>
</Card>

        

<Card>
        <div className="split">
          <b>CITY HEALTH INDEX</b>
          <span className="muted">Awaiting verified data</span>
        </div>

        <strong className="score">—</strong>

        <small className="muted">
          Calculated from verified civic reports and resolution data.
        </small>
      </Card>

      <Label>NEAR YOU • LIVE CIVIC REPORTS</Label>

      <Card>
        <b>No live reports loaded yet</b>
        <small>
          Verified reports near your current location will appear here.
        </small>
      </Card>


      <p className="hint">
        Live data connections are being integrated.
        Unavailable data is not replaced with sample figures.
      </p>

    </div>
  );
}

function RouteViewport({ routeCoordinates }) {
  const map = useMap();

  useEffect(() => {
    if (routeCoordinates.length > 1) {
      map.fitBounds(routeCoordinates, {
        padding: [40, 40]
      });
    }
  }, [map, routeCoordinates]);

    return null;
}

function decodeValhallaShape(encoded, precision = 6) {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];
  const factor = Math.pow(10, precision);

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    coordinates.push([lat / factor, lng / factor]);
  }

  return coordinates;
}

function ExploreMap({
  go,
  query,
  setQuery,
  userLocation,
  locationStatus,
  locationError,
  onLocate
}) {
  const position = userLocation
    ? [userLocation.lat, userLocation.lng]
    : null;

   
  const [destination, setDestination] = useState("");
  const [startLocation, setStartLocation] = useState("");
  const [selectedStart, setSelectedStart] = useState(null);
  const [startSuggestions, setStartSuggestions] = useState([]);
  const [startSuggestionsLoading, setStartSuggestionsLoading] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(true); 
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const routeCoordinatesRef = useRef(routeCoordinates);

useEffect(() => {
  routeCoordinatesRef.current = routeCoordinates;
}, [routeCoordinates]);
  const [travelMode, setTravelMode] = useState("drive");
  const [destinationPoint, setDestinationPoint] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeOptions, setRouteOptions] = useState([]);
  const routeOptionsRef = useRef(routeOptions);

useEffect(() => {
  routeOptionsRef.current = routeOptions;
}, [routeOptions]);
  const [journeyActive, setJourneyActive] = useState(false);
  const [arrivalReached, setArrivalReached] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [livePosition, setLivePosition] = useState(position);

  useEffect(() => {
  if (!journeyActive) {
    setLivePosition(
      userLocation
        ? [userLocation.lat, userLocation.lng]
        : null
    );
  }
}, [userLocation?.lat, userLocation?.lng, journeyActive]);
  
  const [currentManeuver, setCurrentManeuver] = useState(0);
  const [remainingDistance, setRemainingDistance] = useState(null);
  const [remainingTime, setRemainingTime] = useState(null);
  const watchIdRef = useRef(null);
  const lastSpokenManeuverRef = useRef(-1);
  const rerouteInProgressRef = useRef(false);
  const lastRerouteAtRef = useRef(0); 
  const arrivalConfirmationsRef = useRef(0);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");

  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
const [suggestionsLoading, setSuggestionsLoading] = useState(false);
const [selectedDestination, setSelectedDestination] = useState(null);

useEffect(() => {
  const searchText = destination.trim();

  if (searchText.length < 2 || selectedDestination) {
    setDestinationSuggestions([]);
    setSuggestionsLoading(false);
    return;
  }

  const controller = new AbortController();

  const timer = setTimeout(async () => {
    setSuggestionsLoading(true);

    try {
      const params = new URLSearchParams({
        q: searchText,
        limit: "10",
        lang: "en"
      });

      if (userLocation) {
        params.set("lat", userLocation.lat);
        params.set("lon", userLocation.lng);
        params.set("zoom", "14");
      }

      const response = await fetch(
        `https://photon.komoot.io/api/?${params.toString()}`,
        { signal: controller.signal }
      );

      if (!response.ok) {
        throw new Error("Location search failed.");
      }

      const data = await response.json();

      const results = (data.features || []).map(feature => {
        const [lng, lat] = feature.geometry.coordinates;
        const p = feature.properties;

        const label = [
          p.name,
          p.street,
          p.district || p.suburb,
          p.city,
          p.state
        ].filter(Boolean).filter((value, index, arr) =>
          arr.indexOf(value) === index
        ).join(", ");

        let distance = Infinity;

        if (userLocation) {
          const toRad = value => value * Math.PI / 180;
          const dLat = toRad(lat - userLocation.lat);
          const dLng = toRad(lng - userLocation.lng);

          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(userLocation.lat)) *
            Math.cos(toRad(lat)) *
            Math.sin(dLng / 2) ** 2;

          distance = 6371 * 2 *
            Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }

        return {
          label: label || p.name || "Unnamed location",
          lat,
          lng,
          distance
        };
      });

      results.sort((a, b) => a.distance - b.distance);

      setDestinationSuggestions(results);
    } catch (error) {
      if (error.name !== "AbortError") {
        setDestinationSuggestions([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setSuggestionsLoading(false);
      }
    }
  }, 350);

  return () => {
    clearTimeout(timer);
    controller.abort();
  };
}, [destination, userLocation, selectedDestination]);

useEffect(() => {
  const searchText = startLocation.trim();

  if (
    searchText.length < 2 ||
    selectedStart ||
    useCurrentLocation
  ) {
    setStartSuggestions([]);
    setStartSuggestionsLoading(false);
    return;
  }

  const controller = new AbortController();

  const timer = setTimeout(async () => {
    setStartSuggestionsLoading(true);

    try {
      const params = new URLSearchParams({
        q: searchText,
        limit: "10",
        lang: "en"
      });

      if (userLocation) {
        params.set("lat", userLocation.lat);
        params.set("lon", userLocation.lng);
        params.set("zoom", "14");
      }

      const response = await fetch(
        `https://photon.komoot.io/api/?${params.toString()}`,
        { signal: controller.signal }
      );

      if (!response.ok) {
        throw new Error("Location search failed.");
      }

      const data = await response.json();

      const results = (data.features || []).map(feature => {
        const [lng, lat] = feature.geometry.coordinates;
        const p = feature.properties;

        const label = [
          p.name,
          p.street,
          p.district || p.suburb,
          p.city,
          p.state
        ].filter(Boolean).filter((value, index, arr) =>
          arr.indexOf(value) === index
        ).join(", ");

        let distance = Infinity;

        if (userLocation) {
          const toRad = value => value * Math.PI / 180;
          const dLat = toRad(lat - userLocation.lat);
          const dLng = toRad(lng - userLocation.lng);

          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(userLocation.lat)) *
            Math.cos(toRad(lat)) *
            Math.sin(dLng / 2) ** 2;

          distance = 6371 * 2 *
            Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }

        return {
          label: label || p.name || "Unnamed location",
          lat,
          lng,
          distance
        };
      });

      results.sort((a, b) => a.distance - b.distance);
      setStartSuggestions(results);

    } catch (error) {
      if (error.name !== "AbortError") {
        setStartSuggestions([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setStartSuggestionsLoading(false);
      }
    }
  }, 350);

  return () => {
    clearTimeout(timer);
    controller.abort();
  };
}, [startLocation, userLocation, selectedStart, useCurrentLocation]);

  const findRoute = async () => {
    if (useCurrentLocation && !userLocation) {
  setRouteError("Please detect your current location first.");
  return;
}

if (!useCurrentLocation && !selectedStart) {
  setRouteError("Please search and select a starting location.");
  return;
}

    if (!destination.trim()) {
      setRouteError("Enter a destination.");
      return;
    }

    setRouteLoading(true);
    setRouteError("");
    setRouteCoordinates([]);
    setDestinationPoint(null);
    setRouteInfo(null);
    setRouteOptions([]);

    try {
      let endLat;
let endLng;
let destinationLabel;

if (selectedDestination) {
  endLat = selectedDestination.lat;
  endLng = selectedDestination.lng;
  destinationLabel = selectedDestination.label;
} else {
  const searchUrl =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(destination.trim())}`;

  const searchResponse = await fetch(searchUrl);

  if (!searchResponse.ok) {
    throw new Error("Destination search is temporarily unavailable.");
  }

  const places = await searchResponse.json();

  if (!places.length) {
    throw new Error("Destination not found. Select a suggestion or try another address.");
  }

  endLat = Number(places[0].lat);
  endLng = Number(places[0].lon);
  destinationLabel = places[0].display_name;
}

const startLat = useCurrentLocation
  ? userLocation.lat
  : selectedStart.lat;

const startLng = useCurrentLocation
  ? userLocation.lng
  : selectedStart.lng;

    const modes = [
  { id: "drive", costing: "auto", label: "Car" },
  { id: "bike", costing: "motor_scooter", label: "Two-wheeler" },
  { id: "walk", costing: "pedestrian", label: "Walking" }
];

const options = await Promise.all(
  modes.map(async (mode) => {
    const response = await fetch(
      "https://valhalla1.openstreetmap.de/route",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          locations: [
            { lat: startLat, lon: startLng },
            { lat: endLat, lon: endLng }
          ],
          costing: mode.costing,
          units: "kilometers",
          directions_options: {
            units: "kilometers",
            language: "en"
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`${mode.label} route is unavailable.`);
    }

    const data = await response.json();

    if (
      data.trip?.status !== 0 ||
      !data.trip.legs?.length
    ) {
      throw new Error(`${mode.label} route could not be calculated.`);
    }
    
    const leg = data.trip.legs[0];
    console.log("NagrikAI maneuver data:", leg.maneuvers?.slice(0, 3));
    const summary = data.trip.summary || leg.summary;

    return {
      id: mode.id,
      label: mode.label,
      distance: Number(summary.length).toFixed(1),
      duration: Math.round(summary.time / 60),
      coordinates: decodeValhallaShape(leg.shape),
      maneuvers: leg.maneuvers || [],
      destination: destinationLabel
    };
  })
);

setRouteOptions(options);

const defaultRoute = options.find(
  (option) => option.id === "drive"
);

setTravelMode("drive");
setRouteCoordinates(defaultRoute.coordinates);
setDestinationPoint([endLat, endLng]);

setRouteInfo({
  distance: defaultRoute.distance,
  duration: defaultRoute.duration,
  destination: destinationLabel
});
    } catch (error) {
      setRouteError(error.message || "Something went wrong.");
    } finally {
      setRouteLoading(false);
    }
  };

  const startJourney = () => {
    arrivalConfirmationsRef.current = 0;
  const selectedRoute = routeOptionsRef.current.find(
  (option) => option.id === travelMode
);

  if (!selectedRoute) {
    setRouteError("Please calculate a route first.");
    return;
  }

  if (!useCurrentLocation) {
    setRouteError("Live navigation requires your current location as the starting point.");
    return;
  }

  if (!navigator.geolocation) {
    setRouteError("GPS is not supported by this browser.");
    return;
  }

  setRouteError("");
  setCurrentManeuver(0);
  setRemainingDistance(selectedRoute.distance);
  setRemainingTime(selectedRoute.duration);
  lastSpokenManeuverRef.current = -1;
  setJourneyActive(true);

  watchIdRef.current = navigator.geolocation.watchPosition(
    (location) => {
  const currentPosition = [
    location.coords.latitude,
    location.coords.longitude
  ];

  setLivePosition(currentPosition);

  const activeRouteCoordinates = routeCoordinatesRef.current;

if (!activeRouteCoordinates.length) return;

  const distanceBetween = (a, b) => {
    const toRad = (value) => value * Math.PI / 180;
    const earthRadius = 6371;

    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);

    const value =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a[0])) *
      Math.cos(toRad(b[0])) *
      Math.sin(dLng / 2) ** 2;

    return earthRadius * 2 *
      Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  };

if (
  destinationPoint &&
  distanceBetween(currentPosition, destinationPoint) <= 0.06
) {
  arrivalConfirmationsRef.current += 1;

  if (arrivalConfirmationsRef.current >= 3) {
    stopJourney();
    setArrivalReached(true);
  }

  return;
}

arrivalConfirmationsRef.current = 0;

  let nearestIndex = 0;
  let nearestDistance = Infinity;

  activeRouteCoordinates.forEach((point, index) => {
  const distance = distanceBetween(currentPosition, point);

  if (distance < nearestDistance) {
    nearestDistance = distance;
    nearestIndex = index;
  }
});

const now = Date.now();

if (
  nearestDistance > 0.08 &&
  !rerouteInProgressRef.current &&
  now - lastRerouteAtRef.current > 15000 &&
  destinationPoint
) {
  rerouteInProgressRef.current = true;
  lastRerouteAtRef.current = now;

  const costing = {
    drive: "auto",
    bike: "motor_scooter",
    walk: "pedestrian"
  }[travelMode];

  fetch("https://valhalla1.openstreetmap.de/route", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      locations: [
        {
          lat: currentPosition[0],
          lon: currentPosition[1]
        },
        {
          lat: destinationPoint[0],
          lon: destinationPoint[1]
        }
      ],
      costing,
      units: "kilometers",
      directions_options: {
        units: "kilometers",
        language: "en"
      }
    })
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Rerouting unavailable");
      }
      return response.json();
    })
    .then((data) => {
      const leg = data.trip?.legs?.[0];

      if (data.trip?.status !== 0 || !leg) return;

      const summary = data.trip.summary || leg.summary;
      const newCoordinates = decodeValhallaShape(leg.shape);

      const updatedRoute = {
        id: travelMode,
        label: selectedRoute.label,
        distance: Number(summary.length).toFixed(1),
        duration: Math.round(summary.time / 60),
        coordinates: newCoordinates,
        maneuvers: leg.maneuvers || [],
        destination: selectedRoute.destination
      };

      const updatedOptions = routeOptionsRef.current.map((option) =>
  option.id === travelMode ? updatedRoute : option
);

routeOptionsRef.current = updatedOptions;
setRouteOptions(updatedOptions);

      routeCoordinatesRef.current = newCoordinates;
      setRouteCoordinates(newCoordinates);
      setRouteInfo({
        distance: updatedRoute.distance,
        duration: updatedRoute.duration,
        destination: updatedRoute.destination
      });

      setCurrentManeuver(0);
      lastSpokenManeuverRef.current = -1;
    })
    .catch(() => {
      setRouteError("Automatic rerouting failed. Please try again.");
    })
    .finally(() => {
      rerouteInProgressRef.current = false;
    });
    return;
}

let remainingKm = 0;

  for (let i = nearestIndex; i < activeRouteCoordinates.length - 1; i++) {
  remainingKm += distanceBetween(
    activeRouteCoordinates[i],
    activeRouteCoordinates[i + 1]
  );
}

  const selectedRoute = routeOptionsRef.current.find(
  (option) => option.id === travelMode
);

  if (!selectedRoute) return;

  const totalKm = Number(selectedRoute.distance);
  const remainingMinutes = totalKm > 0
    ? Math.round(
        selectedRoute.duration * remainingKm / totalKm
      )
    : 0;

  setRemainingDistance(remainingKm.toFixed(1));
  setRemainingTime(remainingMinutes);

  const maneuvers = selectedRoute.maneuvers || [];

  const nextIndex = maneuvers.findIndex(
    (maneuver) =>
      maneuver.end_shape_index >= nearestIndex
  );

  const maneuverIndex = nextIndex === -1
    ? Math.max(0, maneuvers.length - 1)
    : nextIndex;

  setCurrentManeuver(maneuverIndex);

  if (
    voiceEnabled &&
    maneuverIndex !== lastSpokenManeuverRef.current &&
    maneuvers[maneuverIndex]?.instruction &&
    "speechSynthesis" in window
  ) {
    window.speechSynthesis.cancel();

    const announcement = new SpeechSynthesisUtterance(
      maneuvers[maneuverIndex].instruction
    );

    announcement.lang = "en-IN";
    announcement.rate = 1;

    window.speechSynthesis.speak(announcement);

    lastSpokenManeuverRef.current = maneuverIndex;
  }
},
    () => {
      setJourneyActive(false);
      setRouteError("Unable to track your GPS location.");
    },
    {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 15000
    }
  );
};
const stopJourney = () => {
  if (watchIdRef.current !== null) {
    navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  setJourneyActive(false);
  setLivePosition(position);
  setCurrentManeuver(0);
  lastSpokenManeuverRef.current = -1;
};
useEffect(() => {
  return () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };
}, []);
if (journeyActive || arrivalReached) {
  const activeRoute = routeOptions.find(
    (option) => option.id === travelMode
  );

  const activeInstruction =
    activeRoute?.maneuvers?.[currentManeuver]?.instruction ||
    "Continue on your route";

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "#080f18",
      overflow: "hidden"
    }}>
      <div style={{
        position: "absolute",
        inset: 0
      }}>
        <MapContainer
          center={livePosition || position}
          zoom={17}
          minZoom={3}
          maxZoom={20}
          zoomControl={false}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <LiveMapFollow
            position={livePosition}
            active={journeyActive}
          />
          <MapRecenter position={livePosition} />

          <TileLayer
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            url={`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${import.meta.env.VITE_CARTO_API_KEY}`}
          />

          {routeCoordinates.length > 1 && (
            <>
              <Polyline
                positions={routeCoordinates}
                pathOptions={{
                  color: "#102b46",
                  weight: 11,
                  opacity: 0.9
                }}
              />
              <Polyline
                positions={routeCoordinates}
                pathOptions={{
                  color: "#16a9e0",
                  weight: 6
                }}
              />
            </>
          )}

          {livePosition && (
            <CircleMarker
              center={livePosition}
              radius={10}
              pathOptions={{
                color: "#ffffff",
                fillColor: "#16a9e0",
                fillOpacity: 1,
                weight: 3
              }}
            >
              <Popup>Your current location</Popup>
            </CircleMarker>
          )}

          {destinationPoint && (
            <CircleMarker
              center={destinationPoint}
              radius={9}
              pathOptions={{
                color: "#ffffff",
                fillColor: "#ff5252",
                fillOpacity: 1,
                weight: 2
              }}
            >
              <Popup>Destination</Popup>
            </CircleMarker>
          )}
        </MapContainer>
      </div>

      <div style={{
        position: "absolute",
        top: "max(18px, env(safe-area-inset-top))",
        left: "14px",
        right: "14px",
        zIndex: 1000,
        padding: "18px",
        borderRadius: "18px",
        background: "rgba(12, 25, 39, 0.96)",
        border: "1px solid #16a9e0",
        color: "#ffffff",
        boxShadow: "0 8px 30px #0008"
      }}>
        {arrivalReached ? (
  <>
    <small style={{color:"#36d6a0"}}>DESTINATION REACHED</small>
    <h2 style={{margin:"9px 0",fontSize:"23px"}}>
      🎉 You have arrived!
    </h2>
    <small style={{color:"#aab9c7"}}>{routeInfo?.destination}</small>
  </>
) : (
  <>
    <small style={{color:"#36d6a0"}}>NAVIGATING TO DESTINATION</small>
    <h2 style={{margin:"9px 0",fontSize:"21px"}}>{activeInstruction}</h2>
    <small style={{color:"#aab9c7"}}>{routeInfo?.destination}</small>
  </>
)}
      </div>

      <div style={{
        position: "absolute",
        right: "16px",
        bottom: "230px",
        zIndex: 1000
      }}>
        <button
          onClick={() => {
            if (livePosition) {
              window.dispatchEvent(
                new CustomEvent("nagrikai-recenter")
              );
            }
          }}
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            border: "1px solid #16a9e0",
            background: "#142b3b",
            color: "#ffffff",
            fontSize: "20px"
          }}
        >
          ◎
        </button>
      </div>

      <div style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        padding: "20px",
        paddingBottom: "max(22px, env(safe-area-inset-bottom))",
        borderRadius: "22px 22px 0 0",
        background: "#101d2a",
        borderTop: "1px solid #263f52",
        color: "#ffffff",
        boxShadow: "0 -8px 30px #0008"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px"
        }}>
          <div>
            <small style={{ color: "#9fb1c0" }}>
              ARRIVAL IN
            </small>
            <h2 style={{ color: "#36d6a0", margin: "5px 0" }}>
              {remainingTime} min
            </h2>
          </div>

          <div>
            <small style={{ color: "#9fb1c0" }}>
              DISTANCE LEFT
            </small>
            <h2 style={{ margin: "5px 0" }}>
              {remainingDistance} km
            </h2>
          </div>

          <div>
            <small style={{ color: "#9fb1c0" }}>
              MODE
            </small>
            <h2 style={{ margin: "5px 0" }}>
              {activeRoute?.label || "Drive"}
            </h2>
          </div>
        </div>

        <div style={{
          display: "flex",
          gap: "10px",
          marginTop: "16px"
        }}>
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            style={{
              flex: 1,
              padding: "13px 8px",
              borderRadius: "12px",
              border: "1px solid #16a9e0",
              background: voiceEnabled ? "#123b43" : "#263442",
              color: "#ffffff",
              fontWeight: "700"
            }}
          >
            {voiceEnabled ? "🔊 Voice ON" : "🔇 Voice OFF"}
          </button>

          <button
            onClick={() => {
  if (arrivalReached) {
    setArrivalReached(false);
  } else {
    stopJourney();
  }
}}
            style={{
              flex: 1,
              padding: "13px 8px",
              borderRadius: "12px",
              border: "1px solid #ff647c",
              background: "linear-gradient(135deg, #e84b65, #a72e58)",
              color: "#ffffff",
              fontWeight: "800"
            }}
          >
            {arrivalReached ? "Back to Explore" : "End Journey"}
          </button>
        </div>
      </div>
    </div>
  );
}

return (
    <div className="page">
      
      <div className="home-heading">
        <h2>Explore your city</h2>
        <button className="icon-btn" onClick={() => go("Notifications")}>
          <Bell size={17} />
        </button>
      </div>

      

      <Card>
        <div className="split">
          <b>Your starting location</b>
          <button
            className="green"
            onClick={onLocate}
            disabled={locationStatus === "loading"}
          >
            <LocateFixed size={17} />
            {locationStatus === "loading" ? "Locating..." : "Locate me"}
          </button>
        </div>

        {userLocation && (
          <>
            <p>Latitude: {userLocation.lat.toFixed(6)}</p>
            <p>Longitude: {userLocation.lng.toFixed(6)}</p>
            <small className="muted">
              GPS accuracy: ±{Math.round(userLocation.accuracy)} metres
            </small>
          </>
        )}

        {locationError && <p className="amber">{locationError}</p>}

        {!userLocation && (
          <p className="muted">
            Allow location access to display your actual position.
          </p>
        )}
      </Card>

      <Card>
        <b>Plan your route</b>

<div className="field" style={{ marginTop: "12px", marginBottom: "12px", position: "relative" }}>
  <Label>STARTING POINT</Label>


<label style={{
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "12px 14px",
  background: "#151e28",
  border: "1px solid #293744",
  borderRadius: "10px",
  marginBottom: "12px",
  cursor: "pointer"
}}>
  <span style={{
    display: "flex",
    alignItems: "center",
    gap: "9px",
    color: "#e8eef2",
    fontSize: "12px",
    fontWeight: 500
  }}>
    <MapPin size={16} color="#2bd9a0" />
    Use my current GPS location
  </span>

  <span style={{
    position: "relative",
    width: "40px",
    height: "22px",
    flexShrink: 0,
    borderRadius: "20px",
    background: useCurrentLocation ? "#2bd9a0" : "#344452",
    transition: "background 0.2s"
  }}>
    <input
      type="checkbox"
      checked={useCurrentLocation}
      onChange={e => {
        setUseCurrentLocation(e.target.checked);
        setSelectedStart(null);
        setStartLocation("");
        setStartSuggestions([]);
      }}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0,
        cursor: "pointer",
        zIndex: 2,
        margin: 0
      }}
    />
    <span style={{
      position: "absolute",
      top: "3px",
      left: useCurrentLocation ? "21px" : "3px",
      width: "16px",
      height: "16px",
      borderRadius: "50%",
      background: "#ffffff",
      transition: "left 0.2s"
    }} />
  </span>
</label>


  {!useCurrentLocation && (
    <>
      <input
        value={startLocation}
        onChange={e => {
          setStartLocation(e.target.value);
          setSelectedStart(null);
        }}
        placeholder="Search starting location"
      />

      {startSuggestionsLoading && (
        <small className="muted">Searching locations...</small>
      )}

      {startSuggestions.map((place, index) => (
        <button
          key={`${place.lat}-${place.lng}-${index}`}
          type="button"
          onClick={() => {
            setStartLocation(place.label);
            setSelectedStart(place);
            setStartSuggestions([]);
          }}
          style={{
            display: "block",
            width: "100%",
            padding: "12px",
            textAlign: "left",
            background: "#151e28",
            color: "#f3f6f8",
            border: "1px solid #293744",
            cursor: "pointer"
          }}
        >
          {place.label}
          <small style={{ display: "block", color: "#9aaab7" }}>
            {Number.isFinite(place.distance)
              ? `${place.distance.toFixed(1)} km away`
              : "Location"}
          </small>
        </button>
      ))}
    </>
  )}
</div>
<div className="field" style={{ marginTop: "12px", position: "relative" }}>
  <Label>DESTINATION</Label>

  <input
    value={destination}
    onChange={e => {
      setDestination(e.target.value);
      setSelectedDestination(null);
    }}
    onKeyDown={e => {
      if (e.key === "Enter" && selectedDestination) {
        findRoute();
      }
    }}
    placeholder="Search hostel, apartment, street or place"
  />

  {suggestionsLoading && (
    <small className="muted">Searching locations...</small>
  )}

  {destinationSuggestions.length > 0 && (
    <div style={{
      marginTop: "6px",
      background: "#151e28",
      border: "1px solid #344452",
      borderRadius: "10px",
      overflow: "hidden"
    }}>
      {destinationSuggestions.map((place, index) => (
        <button
          key={`${place.lat}-${place.lng}-${index}`}
          type="button"
          onClick={() => {
            setDestination(place.label);
            setSelectedDestination(place);
            setDestinationSuggestions([]);
          }}
          style={{
            display: "block",
            width: "100%",
            padding: "12px",
            textAlign: "left",
            background: "transparent",
            color: "#f3f6f8",
            border: "none",
            borderBottom: "1px solid #293744",
            cursor: "pointer"
          }}
        >
          <span>{place.label}</span>
          <small style={{
            display: "block",
            color: "#9aaab7",
            marginTop: "4px"
          }}>
            {Number.isFinite(place.distance)
              ? `${place.distance.toFixed(1)} km away`
              : "Location"}
          </small>
        </button>
      ))}
    </div>
  )}
</div>

<Button
  onClick={findRoute}
  disabled={
    routeLoading ||
    (useCurrentLocation && !userLocation) ||
    (!useCurrentLocation && !selectedStart)
  }
>
          {routeLoading ? "Finding route..." : "Find route"}
        </Button>

        {routeError && <p className="amber">{routeError}</p>}

        {routeInfo && (
  <div style={{ marginTop: "12px" }}>
    <b className="green">Choose your travel mode</b>

    <div className="quick-grid" style={{ marginTop: "12px" }}>
      {routeOptions.map((option) => (
        <button
          key={option.id}
          onClick={() => {
            setTravelMode(option.id);
            setRouteCoordinates(option.coordinates);
            setRouteInfo({
              distance: option.distance,
              duration: option.duration,
              destination: option.destination
            });
          }}
          style={{
            border: travelMode === option.id
              ? "2px solid #16a9e0"
              : "1px solid #25333e",
            background: travelMode === option.id
              ? "#142b3b"
              : "transparent",
            padding: "12px",
            borderRadius: "10px",
            textAlign: "left"
          }}
        >
          <b>{option.label}</b>
          <p style={{ margin: "6px 0 0" }}>
            {option.distance} km
          </p>
          <small className="muted">
            Approx. {option.duration} min
          </small>
        </button>
      ))}
    </div>

        <button
      onClick={startJourney}
      disabled={journeyActive}
      style={{
        width: "100%",
        marginTop: "14px",
        padding: "14px",
        borderRadius: "10px",
        border: "none",
        background: "#16a9e0",
        color: "#ffffff",
        fontWeight: "700",
        cursor: "pointer"
      }}
    >
      {journeyActive ? "Journey Active" : "Start Journey"}
        </button>

    {journeyActive && (
      <div style={{
        marginTop: "16px",
        padding: "16px",
        borderRadius: "12px",
        background: "#142b3b",
        border: "1px solid #16a9e0"
      }}>
        <b className="green">LIVE NAVIGATION</b>

        <h3 style={{ margin: "12px 0" }}>
          {routeOptions.find(
            (option) => option.id === travelMode
          )?.maneuvers?.[currentManeuver]?.instruction
            || "Continue on your route"}
        </h3>

        <div className="quick-grid">
          <div>
            <small className="muted">Distance remaining</small>
            <h3>{remainingDistance} km</h3>
          </div>
          <div>
            <small className="muted">Estimated time</small>
            <h3>{remainingTime} min</h3>
          </div>
        </div>

        <button
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          style={{ marginTop: "12px" }}
        >
          {voiceEnabled ? "Voice guidance: ON" : "Voice guidance: OFF"}
        </button>

        <button
          onClick={stopJourney}
          style={{
            width: "100%",
            marginTop: "12px",
            padding: "12px",
            background: "#b83232",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontWeight: "bold"
          }}
        >
          End Journey
        </button>
      </div>
    )}

    <small className="muted">
      Destination: {routeInfo.destination}
    </small>
  </div>
)}
      </Card>

      <Label>LIVE MAP</Label>

      {position ? (
        <div style={{
          height: "360px",
          width: "100%",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1px solid #25333e"
        }}>
          <MapContainer
            center={position}
            zoom={11}
            minZoom={3}
            maxZoom={19}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
          >

            <RouteViewport routeCoordinates={routeCoordinates} />
            <LiveMapFollow     
             position={livePosition}
             active={journeyActive} />

             

<TileLayer
  attribution='&copy; OpenStreetMap contributors &copy; CARTO'
  url={`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${import.meta.env.VITE_CARTO_API_KEY}`}
/>

{routeCoordinates.length > 1 && (
  <>
    <Polyline
      positions={routeCoordinates}
      pathOptions={{
        color: "#102b46",
        weight: 10,
        opacity: 0.8
      }}
    />
    <Polyline
      positions={routeCoordinates}
      pathOptions={{
        color: "#16a9e0",
        weight: 6,
        opacity: 1
      }}
    />
  </>
)}

<CircleMarker
  center={position}
  radius={8}
  pathOptions={{
    color: "#ffffff",
    fillColor: "#20c997",
    fillOpacity: 1,
    weight: 2
  }}
>
  <Popup>Your starting location</Popup>
</CircleMarker>

{destinationPoint && (
  <CircleMarker
    center={destinationPoint}
    radius={9}
    pathOptions={{
      color: "#ffffff",
      fillColor: "#ff5252",
      fillOpacity: 1,
      weight: 2
    }}
  >
    <Popup>Your destination</Popup>
  </CircleMarker>
)}

<RouteViewport routeCoordinates={routeCoordinates} />
          </MapContainer>
        </div>
      ) : (
        <div className="camera-placeholder" style={{ height: "240px" }}>
          <MapPin size={32} />
          <b>Map location unavailable</b>
          <small>Enable GPS to load your actual map.</small>
          <Button onClick={onLocate} disabled={locationStatus === "loading"}>
            Enable location
          </Button>
        </div>
      )}

      <p className="hint">
        Map data: OpenStreetMap. Route calculation: OSRM.
        Traffic conditions are not included in this route yet.
      </p>

      <Button secondary onClick={() => go("Map filters")}>
        Map filters
      </Button>
    </div>
  );
}
function MapRecenter({ position }) {
  const map = useMap();

  useEffect(() => {
    const recenter = () => {
      if (position) {
        map.setView(position, 18, {
          animate: true
        });
      }
    };

    window.addEventListener("nagrikai-recenter", recenter);

    return () => {
      window.removeEventListener("nagrikai-recenter", recenter);
    };
  }, [map, position]);

  return null;
}

function LiveMapFollow({ position, active }) {
  const map = useMap();

  useEffect(() => {
    if (active && position) {
      map.setView(position, 17, {
        animate: true
      });
    }
  }, [map, position, active]);

  return null;
}


function MapFilters({filters,toggleFilter,distance,setDistance,go}) {
  const opts=["Potholes & damaged roads","Waterlogging","Waste & sanitation","Street lighting"];
  return <div className="page"><StatusBarTitle title="Map layers & filters" back={()=>go("Explore map")}/><h1>A clearer view of your city.</h1><Label>SHOW ON MAP</Label><Card>{opts.map(x=><button className="filter-option" onClick={()=>toggleFilter(x)} key={x}><span>{x}</span><span className={filters.includes(x)?"green":""}>{filters.includes(x)?"✓":"○"}</span></button>)}</Card><Label>INTELLIGENCE LAYERS</Label><Card>{["Traffic flow","Issue density heatmap","Predicted waterlogging"].map((x,i)=><div className="filter-option" key={x}><span>{x}</span><span className="green">{i<2?"On":"Off"}</span></div>)}</Card><Label>DISTANCE</Label><div className="filter-row">{["500 m","2 km","5 km","City"].map(x=><button className={distance===x?"on":""} onClick={()=>setDistance(x)} key={x}>{x}</button>)}</div><Button onClick={()=>go("Explore map")}>Apply filters</Button><p className="hint">Heatmaps show sample report density, not verified risk.</p></div>;
}
function CaptureReport({issue,setIssue,description,setDescription,photo,setPhoto,category,setCategory,userLocation,locationStatus,locationDetails,onLocate,go,notify}) {
  const canReview = Boolean(
    issue.trim().length >= 3 &&
    issue.trim().length <= 140 &&
    description.trim().length >= 10 &&
    photo?.file &&
    category &&
    locationStatus === "success" &&
    Number.isFinite(userLocation?.lat) &&
    Number.isFinite(userLocation?.lng)
  );
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const handlePhotoSelect = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      notify("Please select a valid image.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      notify("Image must be 10 MB or smaller.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setPhoto({
        file,
        previewUrl: reader.result
      });
      notify("Photo selected successfully");
    };

    reader.onerror = () => {
      notify("Unable to read image. Please try again.");
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="page">
      <StatusBarTitle title="Report an issue" back={()=>go("Home")}/>

      <Label>01 / 03 &nbsp; CAPTURE EVIDENCE</Label>

            <div
        className="camera-placeholder"
        style={photo?.previewUrl ? { height: "auto", minHeight: "180px", padding: "12px" } : undefined}
      >
        {photo?.previewUrl ? (
          <>
            <img
              src={photo.previewUrl}
              alt="Selected report evidence"
              style={{
                width: "100%",
                maxHeight: "260px",
                objectFit: "contain",
                borderRadius: "9px"
              }}
            />
            <b>{photo.file?.name || "Selected evidence"}</b>
          </>
        ) : (
          <>
            <Camera size={32}/>
            <b>Capture a clear photo</b>
            <small>Keep the issue centred in the frame</small>
          </>
        )}
      </div>

      <Field label="ISSUE TITLE" value={issue} onChange={setIssue}/>

      <label className="field">
        <span>ISSUE DESCRIPTION</span>
        <textarea
          value={description}
          onChange={e=>setDescription(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="Describe the problem..."
        />
      </label>

      <Label>CATEGORY</Label>

      <div className="chip-wrap">
        {["Roads","Water","Waste","Street lighting","Other"].map(x=>(
          <button
            className={`chip ${category===x?"on":""}`}
            key={x}
            onClick={()=>setCategory(x)}
          >
            {x}
          </button>
        ))}
      </div>

      <Card>
        <div className="split">
          <b>
            {locationStatus === "success"
              ? [locationDetails?.locality, locationDetails?.city, locationDetails?.state, locationDetails?.country]
                  .filter((value, index, all) => value && all.indexOf(value) === index)
                  .join(", ") || "Current location detected"
              : locationStatus === "loading"
                ? "Detecting your location..."
                : "Location not detected"}
          </b>
          <MapPin size={16}/>
        </div>

        {userLocation ? (
          <small className="muted">
            {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
            {" · "}Accuracy ±{Math.round(userLocation.accuracy)} metres
          </small>
        ) : (
          <small className="muted">
            Your GPS location is needed to identify where the issue is.
          </small>
        )}

        <Button
          secondary
          disabled={locationStatus === "loading"}
          onClick={onLocate}
        >
          {locationStatus === "loading"
            ? "Detecting location..."
            : locationStatus === "success"
              ? "Refresh location"
              : "Detect my location"}
        </Button>
      </Card>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoSelect}
        style={{display:"none"}}
      />

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoSelect}
        style={{display:"none"}}
      />

      <Button onClick={()=>cameraInputRef.current?.click()}>
        Capture photo
      </Button>

      <Button secondary onClick={()=>galleryInputRef.current?.click()}>
        <ImageIcon size={15}/> Choose from gallery
      </Button>

      <p className="hint">
        Select an actual image from your camera or gallery. Maximum size: 10 MB.
      </p>

      <Button
        disabled={!canReview}
        onClick={() => go("Review report")}
      >
        Review your report
      </Button>

      {!canReview && (
        <p className="hint">
          Enter a valid title, write at least 10 description characters, add a photo, choose a category and detect your GPS location.
        </p>
      )}
    </div>
  );
}
function ReviewReport({issue,description,photo,category,severity,setSeverity,go,onCheckDuplicates,duplicateLoading}) {
  return <div className="page"><StatusBarTitle title="Review your report" back={()=>go("Capture report")}/><Label>02 / 03 &nbsp; REPORT REVIEW</Label><div className="camera-thumb">
  {photo?.previewUrl ? (
    <img
      src={photo.previewUrl}
      alt="Selected report evidence"
      style={{
        width:"100%",
        height:"100%",
        objectFit:"cover",
        borderRadius:"12px"
      }}
    />
  ) : (
    <>
      <Camera size={24}/>
      <small>No photo selected</small>
    </>
  )}
</div>
<Card>
  <div className="split">
    <b>AI image analysis</b>
    <span className="muted">Not connected</span>
  </div>
  <p>Automated image verification is not available yet.</p>
  <small className="muted">
    Please review your photo against the title, description and category.
    No AI detection or confidence score has been generated.
  </small>
</Card><Card><b>Issue title</b><p>{issue}</p><b>Category</b><p>{category}</p><b>Severity</b><div className="chip-wrap">{["Low","Medium","High"].map(x=><button className={`chip ${severity===x?"on":""}`} onClick={()=>setSeverity(x)} key={x}>{x}</button>)}</div>{description && <><b>Issue description</b><p>{description}</p></>}</Card><Button onClick={onCheckDuplicates} disabled={duplicateLoading}>{duplicateLoading ? "Checking nearby reports..." : "Check nearby duplicates"}</Button><Button secondary onClick={()=>go("Capture report")}>Retake photo</Button></div>;
}
function Duplicate({
  go,
  issue,
  matches = [],
  status,
  error,
  onRetry,
  onSubmitNew,
  newLoading,
  onAddEvidence,
  evidenceLoading
}) {
  return (
    <div className="page">
      <StatusBarTitle
        title="Check nearby reports"
        back={() => go("Review report")}
      />
      <Label>03 / 03 &nbsp; DUPLICATE CHECK</Label>
      <h1>Check before creating a new report.</h1>

      <Card>
        <b>Your report</b>
        <p>{issue || "Untitled report"}</p>
      </Card>

      {status === "loading" && (
        <Card>
          <b>Checking nearby reports...</b>
          <p className="muted">Searching for active reports in the same category within 50 metres.</p>
        </Card>
      )}

      {status === "error" && (
        <Card>
          <b>Could not check nearby reports</b>
          <p>{error || "Something went wrong while checking."}</p>
          <Button secondary onClick={onRetry}>Try again</Button>
        </Card>
      )}

      {status === "success" && matches.length === 0 && (
        <Card>
          <b>No nearby matches found</b>
          <p>No active reports in the same category were found within 50 metres.</p>
          <small className="muted">You can proceed with a new report.</small>
        </Card>
      )}

      {status === "success" && matches.length > 0 && (
        <>
          <h3>Potential nearby matches ({matches.length})</h3>
          <p className="muted">These reports share the same category and are within 50 metres. Please check whether they describe the same issue.</p>

          {matches.map((report) => (
            <Card key={report.id}>
              <div className="split">
                <b>Report #{report.report_number}</b>
                <span className="severity">{report.status}</span>
              </div>
              <h3>{report.title}</h3>
              <p>{report.category} · {report.severity} severity</p>
              <p className="muted">
                {Number.isFinite(Number(report.distance_m))
                  ? `${Math.round(Number(report.distance_m))} metres away`
                  : "Distance unavailable"}
              </p>
              <Button
                onClick={() => onAddEvidence(report)}
                disabled={evidenceLoading || newLoading}
              >
                {evidenceLoading ? "Adding evidence..." : "Add evidence to this issue"}
              </Button>
            </Card>
          ))}
        </>
      )}

      <Button
        onClick={onSubmitNew}
        disabled={newLoading || evidenceLoading || status === "loading"}
      >
        {newLoading ? "Submitting report..." : "Raise as a new report"}
      </Button>

      <Button secondary onClick={() => go("Review report")}>
        Back to review
      </Button>

      <p className="hint">
        Nearby matches are suggestions, not confirmed duplicates. Your report is not saved until you choose an action.
      </p>
    </div>
  );
}

function Submitted({go, report}) {
  const evidenceAdded = report?.evidenceAdded === true;
  const reportNumber = report?.report_number;

  return (
    <div className="page">
      <StatusBarTitle
        title="Your voice is on record"
        back={() => go("Home")}
      />
      <Card className="success-card">
        <CheckCircle2 size={38}/>
        <h2>{evidenceAdded ? "Evidence added." : "Report submitted."}</h2>
        <p>
          {evidenceAdded
            ? "Your evidence has been linked to existing report"
            : "Your new report has been saved as"}
          {reportNumber ? ` #${reportNumber}.` : "."}
        </p>
        {report?.title && <small className="muted">{report.title}</small>}
        {report?.status && <p className="muted">Current status: {report.status}</p>}
      </Card>
      <Card>
        <b>The next step is accountability.</b>
        <p>1 &nbsp; Evidence is recorded with the community report</p>
        <p>2 &nbsp; Responsible authority can be identified</p>
        <p>3 &nbsp; You can choose an official complaint handoff</p>
      </Card>
      <Button onClick={() => go("Home")}>Back to home</Button>
      <Button secondary onClick={() => go("Responsible authority")}>Find responsible authority</Button>
      <p className="hint">
        Saving a civic report does not mean a complaint has been filed with a government authority.
      </p>
    </div>
  );
}
function IssueDetails({go,issue}) {
  return <div className="page"><StatusBarTitle title="Issue #GN-2048" back={()=>go("Explore map")}/><Label>GN-2048 • MONITORING VERIFICATION</Label><h1>{issue}</h1><Card><b>12 people confirmed this</b><p>3 evidence photos • 240 m from you</p></Card><Card>{["12 Nov · Report received","13 Nov · Assigned to road maintenance","14 Nov · Repair requested / proof pending","15 Nov · Community review requested"].map(x=><p key={x}>• &nbsp;{x}</p>)}</Card><Button onClick={()=>go("GroundTruth AI")}>Check repair</Button><Button secondary onClick={()=>go("Responsible authority")}>Authority →</Button><Button secondary onClick={()=>go("Capture report")}>I still see this issue</Button></div>;
}
function GroundTruth({go}) {
  return <div className="page"><StatusBarTitle title="GroundTruth AI" back={()=>go("Issue details")}/><Label>EVIDENCE, NOT JUST A STATUS CHANGE</Label><h1>Was it actually fixed?</h1><p className="muted">Compare the claim with what's on the ground.</p><Card><small className="muted">BEFORE · 12 NOV</small><div className="evidence-box">Road damage detected</div><small className="muted">AFTER · 14 NOV</small><div className="evidence-box after">Latest image submitted</div><h3 className="green">Likely repaired · 88%</h3><p>Demo assessment only. Surface appears filled, but location match and durability need human review.</p><span className="severity">Pending</span></Card><Button onClick={()=>go("Capture report")}>Request on-site verification</Button><Button secondary onClick={()=>go("Issue details")}>Back to issue</Button><p className="hint">AI cannot certify a repair. A field review is required.</p></div>;
}
function Authority({go}) {
  return <div className="page"><StatusBarTitle title="Who owns this issue?" back={()=>go("Issue details")}/><Label>JURISDICTION MATCH • DEMO</Label><h1>The right desk.<br/>Not another dead end.</h1><Card><h3>Greater Noida Industrial Development Authority</h3><b className="green">Civil / Road Maintenance</b><p>Suggested for Alpha II internal roads based on location.</p><small className="muted">Jurisdiction confidence: 92% • Verify before submission</small></Card><Card><b>Ready to send</b><p>✓ GPS location & issue summary</p><p>✓ Timestamped photographic evidence</p><p>✓ Community confirmations</p></Card><Button onClick={()=>go("Complaint handoff")}>Prepare official complaint</Button><Button secondary onClick={()=>go("Reference tracking")}>Track an existing reference</Button></div>;
}
function Handoff({go,notify}) {
  return <div className="page"><StatusBarTitle title="Official complaint" back={()=>go("Responsible authority")}/><Label>REVIEW BEFORE YOU HAND OFF</Label><Card><b className="green">To: GNIDA · Road Maintenance</b><h3>Subject: Road damage near Alpha II market</h3><p>A deep pothole on Alpha II main road poses a risk to two-wheelers. Please inspect and repair the road surface.</p><small className="muted">Location: 28.4744, 77.5040</small></Card><Card><b>Share evidence and issue location</b><p className="muted">You will be redirected to the official portal for personal details, if required.</p></Card><Button onClick={()=>{notify("Demo handoff prepared");go("Reference tracking");}}>Simulate official handoff</Button><Button secondary onClick={()=>go("Responsible authority")}>Back to authority</Button><p className="hint">SIMULATED NOTIFICATION — no government portal connection.</p></div>;
}
function Tracking({go}) {
  return <div className="page"><StatusBarTitle title="Track your complaint" back={()=>go("Home")}/><Label>SAMPLE REFERENCE • NOT AN OFFICIAL RECEIPT</Label><Card><h2>DEMO/GN/2026/2048</h2><p>Road maintenance / Alpha II</p><small className="muted">Last synced: 15 Nov, 04:41 IST</small><span className="severity">Review due</span></Card><Card className="timeline">{["12 Nov · Civic report created","13 Nov · Assigned to maintenance","14 Nov · Repair claimed","15 Nov · Field review requested"].map((x,i)=><p key={x}><span className="green">{i===3?"◷":"✓"}</span> {x}</p>)}</Card><Button onClick={()=>go("GroundTruth AI")}>Check GroundTruth evidence</Button><Button secondary onClick={()=>go("Issue details")}>View original issue</Button><p className="hint">Status updates are illustrative, not live authority records.</p></div>;
}

function Weather({
  go,
  userLocation,
  locationDetails,
  weatherData,
  weatherStatus,
  weatherError
}) {
  const current = weatherData?.current;
  const hourly = weatherData?.hourly;
  const daily = weatherData?.daily;

  const weatherDescription = (code) => {
    const descriptions = {
      0: "Clear sky",
      1: "Mainly clear",
      2: "Partly cloudy",
      3: "Overcast",
      45: "Fog",
      48: "Depositing rime fog",
      51: "Light drizzle",
      53: "Moderate drizzle",
      55: "Dense drizzle",
      56: "Freezing drizzle",
      57: "Dense freezing drizzle",
      61: "Light rain",
      63: "Moderate rain",
      65: "Heavy rain",
      66: "Freezing rain",
      67: "Heavy freezing rain",
      71: "Light snow",
      73: "Moderate snow",
      75: "Heavy snow",
      77: "Snow grains",
      80: "Light rain showers",
      81: "Moderate rain showers",
      82: "Violent rain showers",
      85: "Snow showers",
      86: "Heavy snow showers",
      95: "Thunderstorm",
      96: "Thunderstorm with hail",
      99: "Heavy thunderstorm with hail"
    };

    return descriptions[code] || "Conditions unavailable";
  };

  const placeName = locationDetails
    ? [
        locationDetails.locality,
        locationDetails.city,
        locationDetails.state
      ].filter((value, index, array) =>
        value && array.indexOf(value) === index
      ).join(", ")
    : userLocation
      ? "Location detected"
      : "Location unavailable";

  const hourlyStart = hourly?.time && current?.time
    ? Math.max(0, hourly.time.findIndex(time => time >= current.time))
    : 0;

  const hourlyIndexes = hourly?.time
    ? Array.from({ length: 6 }, (_, i) => hourlyStart + i)
        .filter(i => i < hourly.time.length)
    : [];

  const dailyIndexes = daily?.time
    ? daily.time.slice(0, 3).map((_, i) => i)
    : [];

  const formatHour = (value, index) => {
    if (index === hourlyStart) return "NOW";

    return new Date(value).toLocaleTimeString([], {
      hour: "numeric"
    });
  };

  const formatDay = (value, index) => {
    if (index === 0) return "TODAY";

    return new Date(`${value}T12:00:00`).toLocaleDateString(
      undefined,
      { weekday: "short" }
    ).toUpperCase();
  };

  return (
    <div className="page">
      <StatusBarTitle title="Weather & air" back={() => go("Home")} />

      <Label>LIVE LOCAL WEATHER</Label>

      {!userLocation && (
        <Card>
          <b>Location required</b>
          <p className="muted">
            Detect your location on Explore map to load local weather.
          </p>
          <Button onClick={() => go("Explore map")}>
            Detect location
          </Button>
        </Card>
      )}

      {weatherStatus === "loading" && !weatherData && (
        <Card>
          <b>Loading live weather...</b>
          <p className="muted">Fetching conditions for your location.</p>
        </Card>
      )}

      {weatherStatus === "error" && (
        <Card>
          <b className="amber">Weather unavailable</b>
          <p className="muted">
            {weatherError || "Unable to retrieve the forecast."}
          </p>
        </Card>
      )}

      {current && (
        <>
          <Card className="weather-large">
            <div>
              <strong>
                {Math.round(current.temperature_2m)}°
              </strong>
              <p>{placeName}</p>
            </div>

            <div>
              <WeatherVisual
  code={current.weather_code}
  temperature={current.temperature_2m}
  isDay={current.is_day}
  size={44}
/>
              <small>
                {weatherDescription(current.weather_code)}
              </small>
              <small>
                Feels like {Math.round(current.apparent_temperature)}°
              </small>
            </div>
          </Card>

          <Card>
            <div className="split">
              <b>CURRENT CONDITIONS</b>
              <span className="green">LIVE</span>
            </div>

            <div className="metric-grid">
              <div>
                <strong>{current.relative_humidity_2m}%</strong>
                <small>Humidity</small>
              </div>

              <div>
                <strong>{current.wind_speed_10m}</strong>
                <small>Wind km/h</small>
              </div>

              <div>
                <strong>{current.precipitation} mm</strong>
                <small>Precipitation</small>
              </div>
            </div>
          </Card>

          <Label>HOURLY FORECAST</Label>

          {hourlyIndexes.length > 0 ? (
            <div className="forecast">
              {hourlyIndexes.map(index => (
                <div key={hourly.time[index]}>
                  <small>{formatHour(hourly.time[index], index)}</small>
                  <WeatherVisual
  code={hourly.weather_code[index]}
  temperature={hourly.temperature_2m[index]}
  isDay={current?.is_day}
  size={23}
/>
                  <b>
                    {Math.round(hourly.temperature_2m[index])}°
                  </b>
                  <small>
                    {hourly.precipitation_probability?.[index] ?? "—"}%
                    rain
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <Card>
              <p className="muted">Hourly forecast unavailable.</p>
            </Card>
          )}

          <Label>RAIN OUTLOOK</Label>

          <Card>
            <b>Precipitation forecast</b>
            <h2>
              {hourly?.precipitation_probability?.[hourlyStart] ?? "—"}%
            </h2>
            <p className="muted">
              Next forecast hour's rain probability
            </p>
            <p>
              Expected rainfall today:{" "}
              {daily?.precipitation_sum?.[0] ?? "—"} mm
            </p>
            <p>
              Maximum daily rain probability:{" "}
              {daily?.precipitation_probability_max?.[0] ?? "—"}%
            </p>
          </Card>

          <Label>3-DAY FORECAST</Label>

          {dailyIndexes.map(index => (
            <Card key={daily.time[index]}>
              <div className="split">
                <b>{formatDay(daily.time[index], index)}</b>
                <WeatherVisual
  code={daily.weather_code[index]}
  temperature={daily.temperature_2m_max[index]}
  size={26}
/>
                <b>
                  {Math.round(daily.temperature_2m_max[index])}° /{" "}
                  {Math.round(daily.temperature_2m_min[index])}°
                </b>
              </div>

              <p className="muted">
                {weatherDescription(daily.weather_code[index])}
              </p>

              <small>
                Rain probability:{" "}
                {daily.precipitation_probability_max[index] ?? "—"}%
                {" • "}
                Rainfall: {daily.precipitation_sum[index] ?? "—"} mm
              </small>
            </Card>
          ))}
        </>
      )}

      <Label>AIR QUALITY</Label>

      <Card>
        <b>AQI data connection pending</b>
        <p className="muted">
          Live monitoring-station readings will appear here
          with station distance and observation time.
        </p>
      </Card>

      <p className="hint">
        Weather forecast: Open-Meteo. Model-based forecast, not a
        direct neighbourhood weather-station observation.
        <br />
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Weather data by Open-Meteo
        </a>
      </p>

      {weatherStatus === "refreshing" && (
        <p className="hint">Updating weather data...</p>
      )}
    </div>
  );
}

function AskAI({go,query,setQuery}) {
  return <div className="page"><StatusBarTitle title="Ask NagrikAI" back={()=>go("Home")}/><Label>✦ CITY-AWARE AI</Label><div className="chat-bubble user">How should I get to Pari Chowk today?</div><Card><b className="green">Skip the jam. Keep the morning.</b><p>From Alpha II, take the Knowledge Park route, add 8 min but avoids the reported pothole and slow traffic near Pari Chowk.</p><p>Pari Chowk is auctioning for a parking lot. Let's skip the role.</p><small className="muted">Based on 2 reports • Sample traffic data</small></Card><Button onClick={()=>go("Civic navigation")}>Show safer route</Button><Button secondary onClick={()=>go("Weather & air")}>What is the air quality like?</Button><div className="chat-input"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ask about your city..."/><button onClick={()=>{setQuery("");}}><Send size={17}/></button></div><p className="hint">AI responses are simulated in this frontend prototype.</p></div>;
}
function Voice({recording,setRecording,go}) {
  return <div className="page"><StatusBarTitle title="Speak your city" back={()=>go("Ask NagrikAI")}/><Label>VOICE MODE • ENGLISH / हिन्दी</Label><h1>Go ahead.<br/>I'm listening.</h1><button className={`voice-orb ${recording?"recording":""}`} onClick={()=>setRecording(!recording)}><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/></button><p className="green center">{recording?"● Recording — tap to stop":"● Ready to review · 00:04"}</p><Card><b>TRANSCRIPT</b><p>“Alpha II se Pari Chowk jaane ka safer route batao.”</p></Card><Button onClick={()=>go("Civic navigation")}>Use this question</Button><Button secondary onClick={()=>setRecording(false)}>{recording?"Stop recording":"Cancel recording"}</Button><p className="hint">Microphone permission is not requested in this demo. Connect Web Speech API for live voice.</p></div>;
}
function NavigationScreen({go}) {
  return <div className="page"><StatusBarTitle title="Safer ways forward" back={()=>go("Explore map")}/><Card><small className="muted">FROM &nbsp; Alpha II market</small><b>TO &nbsp; Pari Chowk metro station</b></Card><MiniMap onClick={()=>go("Explore map")}/><Card><div className="split"><b>Via Knowledge Park • 4.6 km</b><b className="green">12 min</b></div><p className="muted">Avoids 1 pothole & a slow-traffic segment</p></Card><Card><div className="split"><b>Shortest · Alpha II road</b><span className="amber">18 min</span></div><p className="muted">3.0 km • 1 reported road hazard</p></Card><Button onClick={()=>go("Explore map")}>View hazards on route</Button><p className="hint">Routes and travel times are illustrative. Not for live navigation.</p></div>;
}
function Analytics({go}) {
  return <div className="page"><StatusBarTitle title="City intelligence" back={()=>go("Home")}/><Label>GREATER NOIDA / LAST 30 DAYS</Label><div className="metric-grid"><Card><strong>1,284</strong><small>Reports</small></Card><Card><strong>68%</strong><small>Resolved</small></Card><Card><strong>2.8d</strong><small>Median fix</small></Card></div><Card><div className="split"><b>REPORTS BY WEEK</b><span className="green">−18%</span></div><div className="bars">{[68,55,74,62].map((v,i)=><div key={i}><i style={{height:v+"%"}}/><small>W{i+1}</small></div>)}</div></Card><Card><b>Where the city needs attention</b><p>1 &nbsp; Pari Chowk <span className="right">86 reports</span></p><p>2 &nbsp; Alpha II <span className="right">54 reports</span></p><p>3 &nbsp; Surajpur <span className="right">39 reports</span></p></Card><p className="hint">Sample data • Not an official civic statistics source.</p></div>;
}
function Profile({go,reportCount}) {
  return <div className="page"><StatusBarTitle title="Your civic footprint" back={()=>go("Home")}/><Card className="profile-card"><div className="avatar">AS</div><h2>Aarav Sharma</h2><p>Alpha II, Greater Noida</p><small className="muted">Joined October 2026</small><span className="green">✦ Trusted contributor</span></Card><div className="metric-grid"><Card><strong>{reportCount}</strong><small>Reports</small></Card><Card><strong>5</strong><small>Resolved</small></Card><Card><strong>23</strong><small>Verifications</small></Card></div>{[["Your reports","Report history"],["Notifications","Notifications"],["Accessibility","Accessibility"],["Privacy & settings","Privacy & settings"],["Language / English & हिन्दी","Language"]].map(([x,y])=><button className="menu-row" key={x} onClick={()=>go(y)}>{x}<ChevronRight size={16}/></button>)}</div>;
}
function History({go}) {
  const [reports, setReports] = useState([]);
  const [loadStatus, setLoadStatus] = useState("loading");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    const loadReports = async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData?.user) throw new Error("Please sign in to view your reports.");

        const { data, error } = await supabase
          .from("reports")
          .select("id, report_number, title, category, status, created_at, locality")
          .eq("user_id", authData.user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (active) {
          setReports(Array.isArray(data) ? data : []);
          setLoadStatus("success");
        }
      } catch (error) {
        console.error("Report history loading failed:", error);
        if (active) {
          setLoadError(error.message || "Could not load your reports.");
          setLoadStatus("error");
        }
      }
    };

    loadReports();
    return () => { active = false; };
  }, []);

  const resolvedCount = reports.filter(report => report.status === "Resolved").length;
  const openCount = reports.length - resolvedCount;

  return (
    <div className="page">
      <StatusBarTitle title="Your reports" back={() => go("Profile")} />
      {loadStatus === "loading" && <p className="muted">Loading your reports...</p>}
      {loadStatus === "error" && (
        <Card>
          <b className="amber">Unable to load report history</b>
          <p className="muted">{loadError}</p>
        </Card>
      )}
      {loadStatus === "success" && (
        <>
          <Label>{reports.length} REPORTS · {resolvedCount} RESOLVED · {openCount} OPEN</Label>
          {reports.length === 0 ? (
            <div className="empty-state">
              <FileText size={34} />
              <h2>No reports yet.</h2>
              <p>Your submitted reports will appear here.</p>
            </div>
          ) : reports.map(report => (
            <Card key={report.id}>
              <b>{report.title}</b>
              <p className="muted">{report.category} · {report.locality || "Location not saved"}</p>
              <p className={report.status === "Resolved" ? "green" : "amber"}>{report.status}</p>
              <small className="muted">
                {new Date(report.created_at).toLocaleDateString("en-IN", {
                  day: "2-digit", month: "short", year: "numeric"
                })}
                {" · "}#GN-{report.report_number}
              </small>
            </Card>
          ))}
        </>
      )}
      <Button onClick={() => go("Capture report")}>Report something new</Button>
    </div>
  );
}
function Notifications({go,enabled,setEnabled}) {
  return <div className="page"><StatusBarTitle title="Notifications" back={()=>go("Profile")}/><Label>TODAY</Label>{[["Repair claimed. You decide.","New repair evidence for #GN-2048. Help verify it on the ground.","8 min ago"],["Your city briefing is ready","A clearer route, rising AQI, and the hazards near you.","34 min ago"],["Road hazard near Alpha II","A new community report is within 500 m of your saved area.","1 hour ago"]].map(([a,b,c])=><Card key={a}><b>{a}</b><p>{b}</p><small className="green">{c}</small></Card>)}<Card className="split"><b>Nearby alerts</b><button className={`switch ${enabled?"yes":""}`} onClick={()=>setEnabled(!enabled)}><i/></button></Card><p className="hint">Sample notifications • No push service connected</p></div>;
}
function Accessibility({go,values,setValues}) {
  const rows=[["text","Larger text","Adjust device's preferred text scale."],["motion","Reduce motion","Keep transitions and animations light."],["voice","Voice guidance","Read civic summaries and key actions aloud."],["contrast","High-contrast labels","Increase contrast on colour indicators."]];
  return <div className="page"><StatusBarTitle title="Made for everyone" back={()=>go("Profile")}/><h1>Comfort is not optional.</h1><p className="muted">Tune the interface to how you see, hear and move.</p>{rows.map(([id,title,desc])=><Card key={id}><div className="split"><b>{title}</b><button className={`switch ${values[id]?"yes":""}`} onClick={()=>setValues(v=>({...v,[id]:!v[id]}))}><i/></button></div><small className="muted">{desc}</small></Card>)}<Card><b>Road hazard ahead</b><p className="amber">High severity · 240 m away</p><small className="muted">Preview of an accessible alert card</small></Card></div>;
}
function Privacy({go,privacy,setPrivacy}) {
  return <div className="page"><StatusBarTitle title="Privacy & settings" back={()=>go("Profile")}/><Label>YOUR DATA, YOUR CALL</Label><Card><div className="split"><b>Precise location</b><button className={`switch ${privacy?"yes":""}`} onClick={()=>setPrivacy(!privacy)}><i/></button></div><p className="muted">Only while capturing a report or requesting a route.</p></Card><Card><div className="split"><b>Anonymous public reports</b><span className="green">On</span></div><p className="muted">Hide your name from the community.</p></Card><Card><div className="split"><b>Personalised AI suggestions</b><span className="muted">Off</span></div><p className="muted">Use saved areas and preferences, not private messages.</p></Card>{["Language / English & हिन्दी","Accessibility","Preview offline recovery"].map(x=><button className="menu-row" key={x} onClick={()=>go(x==="Accessibility"?x:"Language")}>{x}<ChevronRight size={16}/></button>)}<p className="hint">Prototype only. No real personal data is collected or transmitted.</p></div>;
}
function Loading({go}) {
  return <div className="page"><StatusBarTitle title="Syncing your city" back={()=>go("Home")}/><Label>GETTING THE LATEST CITY SNAPSHOT</Label>{[1,2,3].map(x=><Card key={x}><div className="skeleton long"/><div className="skeleton short"/><div className="skeleton medium"/></Card>)}<h3 className="green center">Connecting the dots...</h3><p className="muted center">Reports, weather and road conditions.<br/>Sample data for this prototype.</p><Button onClick={()=>go("Home")}>Continue to Home</Button></div>;
}
function Empty({go}) {
  return <div className="page"><StatusBarTitle title="Your reports" back={()=>go("Report history")}/><div className="empty-state"><FileText size={34}/><h2>No reports. Yet.</h2><p>A safer street can start with one well-documented report.</p></div><Button onClick={()=>go("Capture report")}>Make your first report</Button><Button secondary onClick={()=>go("Explore map")}>Explore issues near you</Button><Card><b>A useful report takes a minute.</b><p className="muted">Add a clear photo, confirm the location, and let AI help with the details.</p></Card></div>;
}
function Offline({go}) {
  return <div className="page"><StatusBarTitle title="You're offline" back={()=>go("Home")}/><div className="offline-icon"><WifiOff size={34}/></div><h1>Signal lost.<br/>Your voice isn't.</h1><p className="muted">I couldn't refresh your city feed. Check your connection and try again.</p><Card><b className="green">Last saved snapshot: 09:20 IST</b></Card><Button onClick={()=>go("Loading")}>Try again</Button><Button secondary onClick={()=>go("Home")}>View saved city snapshot</Button><Card><b>Your draft stays with you.</b><p className="muted">In the production app, pending reports are kept on-device until you reconnect.</p></Card></div>;
}

export default App;